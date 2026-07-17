
-- Enums
CREATE TYPE public.ticket_status AS ENUM ('open','pending','waiting_user','resolved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.ticket_category AS ENUM ('payment','listing','dispute','account','shipping','technical','other');

-- Tickets
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category ticket_category NOT NULL DEFAULT 'other',
  priority ticket_priority NOT NULL DEFAULT 'normal',
  status ticket_status NOT NULL DEFAULT 'open',
  related_offer_id UUID,
  related_listing_id UUID,
  related_payment_id UUID,
  assigned_admin UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_due_at TIMESTAMPTZ NOT NULL,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_user_idx ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status, sla_due_at);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_owner_select" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "tickets_owner_insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "tickets_owner_update" ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- SLA + updated_at trigger
CREATE OR REPLACE FUNCTION public.support_tickets_before_ins()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.sla_due_at := NEW.created_at + CASE NEW.priority
    WHEN 'urgent' THEN interval '2 hours'
    WHEN 'high'   THEN interval '8 hours'
    WHEN 'normal' THEN interval '24 hours'
    WHEN 'low'    THEN interval '72 hours'
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER support_tickets_before_ins
BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_tickets_before_ins();

CREATE OR REPLACE FUNCTION public.support_tickets_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- Guard: user can't change status to admin-only states or reassign
  IF NOT public.has_role(auth.uid(),'admin'::app_role) THEN
    IF NEW.assigned_admin IS DISTINCT FROM OLD.assigned_admin
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.first_response_at IS DISTINCT FROM OLD.first_response_at
       OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
       OR NEW.sla_due_at IS DISTINCT FROM OLD.sla_due_at THEN
      RAISE EXCEPTION 'support_ticket_admin_only_fields';
    END IF;
    -- user can only move open<->waiting_user and close their own
    IF NEW.status NOT IN ('open','waiting_user','closed') THEN
      RAISE EXCEPTION 'support_ticket_status_forbidden';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER support_tickets_touch
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch();

-- Messages
CREATE TABLE public.support_ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  template_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages(ticket_id, created_at);

GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_msg_participant_select" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    (
      is_internal = false
      AND EXISTS (SELECT 1 FROM public.support_tickets t
                  WHERE t.id = ticket_id AND t.user_id = auth.uid())
    )
    OR public.has_role(auth.uid(),'admin'::app_role)
  );
CREATE POLICY "ticket_msg_participant_insert" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      (
        is_internal = false
        AND EXISTS (SELECT 1 FROM public.support_tickets t
                    WHERE t.id = ticket_id AND t.user_id = auth.uid())
      )
      OR public.has_role(auth.uid(),'admin'::app_role)
    )
  );

-- After-insert: set first_response_at & bump ticket status
CREATE OR REPLACE FUNCTION public.support_msg_after_ins()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner UUID; _is_admin BOOLEAN;
BEGIN
  SELECT user_id INTO _owner FROM public.support_tickets WHERE id = NEW.ticket_id;
  _is_admin := public.has_role(NEW.sender_id, 'admin'::app_role);

  IF _is_admin AND NEW.is_internal = false THEN
    UPDATE public.support_tickets
      SET first_response_at = COALESCE(first_response_at, now()),
          status = CASE WHEN status IN ('open','pending') THEN 'waiting_user'::ticket_status ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (_owner, 'support_reply', 'رد جديد من الدعم',
            substring(NEW.body,1,120), '/support/' || NEW.ticket_id);
  ELSIF NEW.sender_id = _owner THEN
    UPDATE public.support_tickets
      SET status = CASE WHEN status IN ('waiting_user','resolved') THEN 'pending'::ticket_status ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER support_msg_after_ins
AFTER INSERT ON public.support_ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.support_msg_after_ins();

-- Reply templates
CREATE TABLE public.support_reply_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category ticket_category NOT NULL DEFAULT 'other',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_reply_templates TO authenticated;
GRANT ALL ON public.support_reply_templates TO service_role;
ALTER TABLE public.support_reply_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_read_admin" ON public.support_reply_templates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "templates_manage_admin" ON public.support_reply_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER support_templates_touch
BEFORE UPDATE ON public.support_reply_templates
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed initial templates
INSERT INTO public.support_reply_templates(key,title,body,category) VALUES
('greeting','رد ترحيبي','مرحباً، شكراً لتواصلك مع فريق الدعم في منصة بدل. سنراجع طلبك ونعود إليك في أقرب وقت.','other'),
('payment_pending','دفعة معلّقة','نرى أن الدفعة لا تزال في حالة انتظار. يرجى إعادة تحميل صفحة الدفع بعد دقيقتين، وإن استمرت المشكلة أرسل لنا لقطة شاشة للفاتورة.','payment'),
('payment_failed','فشل الدفع','عذراً، لم تكتمل عملية الدفع. تحقّق من صلاحية البطاقة أو جرّب طريقة دفع أخرى، ثم أعِد المحاولة من صفحة الترقية.','payment'),
('kyc_incomplete','نقص في وثائق التوثيق','وثائق التوثيق التي أُرسلت غير مكتملة. يرجى إعادة رفع صورة واضحة للسجل التجاري/الوثيقة الرسمية.','account'),
('listing_review','مراجعة إعلان','تمت مراجعة إعلانك وسنعود إليك بالتفاصيل خلال المدة المحددة في اتفاقية الخدمة.','listing'),
('resolved','إغلاق التذكرة','تم حل المشكلة. سنغلق التذكرة الآن، ويمكنك فتحها من جديد إن احتجت.','other');

-- Realtime
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;
ALTER TABLE public.support_ticket_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_messages;
