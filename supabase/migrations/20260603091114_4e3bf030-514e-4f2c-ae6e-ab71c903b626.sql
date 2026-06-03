
-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_self_read" ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "notif_self_update" ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "notif_self_insert" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_self_delete" ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ============ DISPUTES / ESCROW ============
CREATE TYPE public.dispute_status AS ENUM ('open','under_review','resolved','rejected');

CREATE TABLE public.disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  opened_by uuid NOT NULL,
  reason text NOT NULL,
  evidence text,
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_disputes_offer ON public.disputes(offer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disputes TO authenticated;
GRANT ALL ON public.disputes TO service_role;

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Parties of the offer can see and open disputes
CREATE POLICY "disputes_party_read" ON public.disputes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.trade_offers o
  WHERE o.id = disputes.offer_id AND (o.from_user = auth.uid() OR o.to_user = auth.uid())));

CREATE POLICY "disputes_party_insert" ON public.disputes FOR INSERT TO authenticated
WITH CHECK (auth.uid() = opened_by AND EXISTS (
  SELECT 1 FROM public.trade_offers o
  WHERE o.id = disputes.offer_id AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
));

CREATE POLICY "disputes_party_update" ON public.disputes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.trade_offers o
  WHERE o.id = disputes.offer_id AND (o.from_user = auth.uid() OR o.to_user = auth.uid())));

-- Add escrow state on trade_offers
ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS escrow_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escrow_released_at timestamptz;

-- ============ PRICE HISTORY (ORACLE) ============
CREATE TABLE public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title_key text NOT NULL,
  price numeric NOT NULL,
  source text NOT NULL DEFAULT 'listing',
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_price_history_lookup ON public.price_history(category, title_key, recorded_at DESC);

GRANT SELECT ON public.price_history TO anon, authenticated;
GRANT INSERT ON public.price_history TO authenticated;
GRANT ALL ON public.price_history TO service_role;

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_history_public_read" ON public.price_history FOR SELECT USING (true);
CREATE POLICY "price_history_auth_insert" ON public.price_history FOR INSERT TO authenticated
WITH CHECK (true);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ============ TRIGGERS ============
-- Touch updated_at on disputes
CREATE TRIGGER trg_disputes_touch
BEFORE UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-record listing price into oracle
CREATE OR REPLACE FUNCTION public.record_listing_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.price_history(category, title_key, price, source)
  VALUES (NEW.category, lower(trim(NEW.title)), NEW.market_price, 'listing');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_listing_price
AFTER INSERT OR UPDATE OF market_price ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.record_listing_price();

-- Auto-notify on new offer / status change
CREATE OR REPLACE FUNCTION public.notify_offer_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (NEW.to_user, 'offer_new', 'عرض مقايضة جديد', 'وصلك عرض مقايضة جديد',
            '/offers/' || NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (NEW.from_user, 'offer_status', 'تحديث على عرضك',
            'حالة عرضك أصبحت: ' || NEW.status, '/offers/' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_offer_notify
AFTER INSERT OR UPDATE ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_offer_event();

-- Auto-notify on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recipient uuid;
BEGIN
  SELECT CASE WHEN o.from_user = NEW.sender_id THEN o.to_user ELSE o.from_user END
    INTO recipient
  FROM public.trade_offers o WHERE o.id = NEW.offer_id;
  IF recipient IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (recipient, 'message', 'رسالة جديدة', substring(NEW.body, 1, 80),
            '/offers/' || NEW.offer_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
