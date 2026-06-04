
-- ============================================================
-- 1. SUBSCRIPTIONS (revenue source alternative to DI fees)
-- ============================================================
CREATE TYPE public.subscription_tier AS ENUM ('free','plus','pro');
CREATE TYPE public.subscription_status AS ENUM ('active','canceled','past_due','trialing');

CREATE TABLE public.subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL UNIQUE,
  tier        public.subscription_tier NOT NULL DEFAULT 'free',
  status      public.subscription_status NOT NULL DEFAULT 'active',
  started_at  timestamptz NOT NULL DEFAULT now(),
  renews_at   timestamptz,
  canceled_at timestamptz,
  price_sar   numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subs_self_read ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY subs_self_insert ON public.subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY subs_self_update ON public.subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER subs_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============================================================
-- 2. REFERRALS
-- ============================================================
CREATE TABLE public.referrals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL,
  code            text NOT NULL UNIQUE,
  referred_user   uuid UNIQUE,
  rewarded        boolean NOT NULL DEFAULT false,
  reward_di       numeric NOT NULL DEFAULT 25,
  created_at      timestamptz NOT NULL DEFAULT now(),
  redeemed_at     timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY referrals_self_read ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user = auth.uid());
CREATE POLICY referrals_self_insert ON public.referrals FOR INSERT TO authenticated
  WITH CHECK (referrer_id = auth.uid());
CREATE POLICY referrals_self_update ON public.referrals FOR UPDATE TO authenticated
  USING (referrer_id = auth.uid() OR referred_user = auth.uid())
  WITH CHECK (referrer_id = auth.uid() OR referred_user = auth.uid());

-- ============================================================
-- 3. REGION SETTINGS (cash-only mode by country)
-- ============================================================
CREATE TABLE public.region_settings (
  country_code  text PRIMARY KEY,
  di_enabled    boolean NOT NULL DEFAULT true,
  cash_only     boolean NOT NULL DEFAULT false,
  note          text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.region_settings TO anon, authenticated;
GRANT ALL ON public.region_settings TO service_role;
ALTER TABLE public.region_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY region_public_read ON public.region_settings FOR SELECT TO public USING (true);
CREATE POLICY region_admin_write ON public.region_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Seed countries where DI is disabled by default
INSERT INTO public.region_settings(country_code, di_enabled, cash_only, note) VALUES
  ('EGP', false, true, 'البنك المركزي المصري يقيد العملات الرقمية — وضع نقدي فقط'),
  ('JOD', false, true, 'تقييد محلي على العملات الرقمية'),
  ('TND', false, true, 'تقييد محلي على العملات الرقمية'),
  ('MAD', false, true, 'تقييد محلي على العملات الرقمية'),
  ('SAR', true,  false, NULL),
  ('AED', true,  false, NULL),
  ('KWD', true,  false, NULL),
  ('QAR', true,  false, NULL),
  ('BHD', true,  false, NULL),
  ('OMR', true,  false, NULL)
ON CONFLICT (country_code) DO NOTHING;
