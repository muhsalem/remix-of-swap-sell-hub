
-- Missing triggers (functions existed but no triggers attached)
DROP TRIGGER IF EXISTS trg_on_trade_completed ON public.trade_offers;
CREATE TRIGGER trg_on_trade_completed
AFTER UPDATE ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.on_trade_completed();

DROP TRIGGER IF EXISTS trg_update_profile_rating ON public.reviews;
CREATE TRIGGER trg_update_profile_rating
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_profile_rating();

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

DROP TRIGGER IF EXISTS trg_notify_offer_event ON public.trade_offers;
CREATE TRIGGER trg_notify_offer_event
AFTER INSERT OR UPDATE ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.notify_offer_event();

DROP TRIGGER IF EXISTS trg_record_listing_price ON public.listings;
CREATE TRIGGER trg_record_listing_price
AFTER INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.record_listing_price();

-- Vision usage tracking (per-user daily quota for AI image analysis)
CREATE TABLE IF NOT EXISTS public.vision_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date
);

CREATE INDEX IF NOT EXISTS idx_vision_usage_user_day ON public.vision_usage(user_id, day);

GRANT SELECT, INSERT ON public.vision_usage TO authenticated;
GRANT ALL ON public.vision_usage TO service_role;

ALTER TABLE public.vision_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY vision_usage_self_read ON public.vision_usage
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY vision_usage_self_insert ON public.vision_usage
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
