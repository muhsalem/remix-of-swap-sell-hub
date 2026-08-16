CREATE TABLE public.dispute_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL DEFAULT '',
  attachments text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispute_messages_dispute ON public.dispute_messages(dispute_id, created_at);

GRANT SELECT, INSERT ON public.dispute_messages TO authenticated;
GRANT ALL ON public.dispute_messages TO service_role;

ALTER TABLE public.dispute_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY dispute_messages_party_read ON public.dispute_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.disputes d
    JOIN public.trade_offers o ON o.id = d.offer_id
    WHERE d.id = dispute_messages.dispute_id
      AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderator')
);

CREATE POLICY dispute_messages_party_insert ON public.dispute_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_system = false
  AND (
    EXISTS (
      SELECT 1 FROM public.disputes d
      JOIN public.trade_offers o ON o.id = d.offer_id
      WHERE d.id = dispute_messages.dispute_id
        AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
        AND d.status IN ('open','under_review')
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  )
);

CREATE OR REPLACE FUNCTION public.dispute_status_system_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.dispute_messages (dispute_id, sender_id, body, is_system)
    VALUES (NEW.id, NULL, 'تغيّرت حالة النزاع إلى: ' || NEW.status::text ||
      COALESCE(CASE WHEN NEW.resolution IS NOT NULL AND NEW.resolution <> '' THEN ' — ' || NEW.resolution ELSE '' END, ''), true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispute_status_system_message ON public.disputes;
CREATE TRIGGER trg_dispute_status_system_message
AFTER UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.dispute_status_system_message();

REVOKE EXECUTE ON FUNCTION public.dispute_status_system_message() FROM PUBLIC, anon, authenticated;