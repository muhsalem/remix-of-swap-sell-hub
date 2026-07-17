
INSERT INTO public.platform_config(key, value)
VALUES ('cash_pricing', jsonb_build_object(
  'currency','SAR',
  'verify_individual', 50,
  'verify_company', 200,
  'listing_featured_7d', 30,
  'listing_featured_30d', 100,
  'listing_pinned_7d', 50,
  'listing_boost', 10,
  'sub_merchant_month', 75,
  'sub_store_month', 200
))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

DO $$ BEGIN
  CREATE TYPE public.payment_purpose AS ENUM (
    'verify_individual','verify_company',
    'listing_featured_7d','listing_featured_30d','listing_pinned_7d','listing_boost',
    'sub_merchant_month','sub_store_month'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','expired','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'fawaterak',
  provider_invoice_id text,
  provider_invoice_key text,
  purpose public.payment_purpose NOT NULL,
  target_id uuid,
  duration_days int,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  status public.payment_status NOT NULL DEFAULT 'pending',
  checkout_url text,
  raw_request jsonb,
  raw_callback jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_provider_invoice_idx ON public.payments(provider, provider_invoice_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments(status);

GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payments_owner_select ON public.payments;
CREATE POLICY payments_owner_select ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS payments_admin_all ON public.payments;
CREATE POLICY payments_admin_all ON public.payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS payments_touch_updated ON public.payments;
CREATE TRIGGER payments_touch_updated
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.apply_paid_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status <> 'paid' OR OLD.status = 'paid' THEN RETURN NEW; END IF;

  IF NEW.purpose IN ('verify_individual','verify_company') THEN
    UPDATE public.profiles
      SET verified_badge = true,
          verified_until = GREATEST(COALESCE(verified_until, now()), now()) + interval '1 year'
      WHERE id = NEW.user_id;

  ELSIF NEW.purpose = 'listing_featured_7d' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.listings
      SET is_featured = true,
          featured_until = GREATEST(COALESCE(featured_until, now()), now()) + interval '7 days'
      WHERE id = NEW.target_id;

  ELSIF NEW.purpose = 'listing_featured_30d' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.listings
      SET is_featured = true,
          featured_until = GREATEST(COALESCE(featured_until, now()), now()) + interval '30 days'
      WHERE id = NEW.target_id;

  ELSIF NEW.purpose = 'listing_pinned_7d' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.listings
      SET is_pinned = true,
          pinned_until = GREATEST(COALESCE(pinned_until, now()), now()) + interval '7 days'
      WHERE id = NEW.target_id;

  ELSIF NEW.purpose = 'listing_boost' AND NEW.target_id IS NOT NULL THEN
    UPDATE public.listings
      SET boost_count = COALESCE(boost_count,0) + 1,
          last_boosted_at = now(),
          updated_at = now()
      WHERE id = NEW.target_id;

  ELSIF NEW.purpose = 'sub_merchant_month' THEN
    INSERT INTO public.subscriptions(user_id, tier, status, price_sar, renews_at)
    VALUES (NEW.user_id, 'merchant'::subscription_tier, 'active'::subscription_status,
            NEW.amount, now() + interval '30 days');

  ELSIF NEW.purpose = 'sub_store_month' THEN
    INSERT INTO public.subscriptions(user_id, tier, status, price_sar, renews_at)
    VALUES (NEW.user_id, 'store'::subscription_tier, 'active'::subscription_status,
            NEW.amount, now() + interval '30 days');
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payments_apply_entitlement ON public.payments;
CREATE TRIGGER payments_apply_entitlement
AFTER UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.apply_paid_payment();
