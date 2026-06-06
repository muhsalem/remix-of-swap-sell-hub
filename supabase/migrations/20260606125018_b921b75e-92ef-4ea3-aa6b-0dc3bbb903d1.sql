
-- 1) Platform config (feature flags + pricing)
CREATE TABLE public.platform_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_config TO anon, authenticated;
GRANT ALL ON public.platform_config TO service_role;
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_public_read" ON public.platform_config FOR SELECT TO public USING (true);
CREATE POLICY "config_admin_write" ON public.platform_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.platform_config(key, value) VALUES
  ('commission_enabled', 'false'::jsonb),
  ('pricing', jsonb_build_object(
    'featured_7d_di', 6,
    'featured_30d_di', 20,
    'pinned_7d_di', 10,
    'boost_di', 2,
    'verify_individual_year_di', 20,
    'sub_merchant_month_di', 40,
    'sub_store_month_di', 100
  ));

-- 2) Listings promo columns
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_until timestamptz,
  ADD COLUMN IF NOT EXISTS boost_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_boosted_at timestamptz;
CREATE INDEX IF NOT EXISTS listings_featured_idx ON public.listings(is_featured, featured_until) WHERE is_featured;
CREATE INDEX IF NOT EXISTS listings_pinned_idx ON public.listings(is_pinned, pinned_until) WHERE is_pinned;

-- 3) Profile verification badge
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_badge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_until timestamptz;

-- 4) Extend subscription tiers
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'merchant';
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'store';

-- 5) Promotions ledger
CREATE TYPE promotion_kind AS ENUM ('featured','pinned','boost','verify_individual','sub_merchant','sub_store');

CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid,
  kind promotion_kind NOT NULL,
  cost_di numeric NOT NULL,
  duration_days integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_self_read" ON public.promotions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "promo_admin_write" ON public.promotions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 6) Update trade completion to respect commission flag
CREATE OR REPLACE FUNCTION public.on_trade_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fee_rate numeric := 0.03;
  cash numeric := COALESCE(NEW.cash_balance, 0);
  base_value numeric;
  fee_amount numeric;
  already_paid boolean;
  commission_on boolean;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT (value)::boolean INTO commission_on
      FROM public.platform_config WHERE key='commission_enabled';
    commission_on := COALESCE(commission_on, true);

    -- Always reward both parties
    INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
    VALUES
      (NEW.from_user, 'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة'),
      (NEW.to_user,   'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة');

    IF commission_on THEN
      SELECT EXISTS(SELECT 1 FROM public.platform_fees WHERE offer_id = NEW.id AND status = 'paid'::fee_status) INTO already_paid;
      base_value := GREATEST(cash, 50);
      fee_amount := ROUND(base_value * fee_rate, 2);

      IF NOT already_paid THEN
        INSERT INTO public.platform_fees(offer_id, payer_id, amount_sar, rate)
        VALUES (NEW.id, NEW.from_user, fee_amount, fee_rate)
        ON CONFLICT (offer_id) DO NOTHING;

        INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
        VALUES (NEW.from_user, 'fee_charge', -ROUND(fee_amount/5,2), NEW.id,
                'عمولة منصة ' || fee_amount || ' ر.س');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Skip fee gate when commission is disabled
CREATE OR REPLACE FUNCTION public.require_fee_before_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  has_paid boolean;
  commission_on boolean;
BEGIN
  SELECT (value)::boolean INTO commission_on
    FROM public.platform_config WHERE key='commission_enabled';
  commission_on := COALESCE(commission_on, true);

  IF NOT commission_on THEN RETURN NEW; END IF;

  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND COALESCE(NEW.cash_balance,0) > 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.platform_fees WHERE offer_id = NEW.id AND status='paid'::fee_status) INTO has_paid;
    IF NOT has_paid THEN
      RAISE EXCEPTION 'يجب دفع عمولة المنصة قبل إكمال الصفقة النقدية';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 7) DI balance helper
CREATE OR REPLACE FUNCTION public.di_balance(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(SUM(amount_di),0) FROM public.wallet_ledger WHERE user_id = _user_id $$;

-- 8) Purchase listing promotion
CREATE OR REPLACE FUNCTION public.purchase_listing_promotion(
  _listing_id uuid, _kind promotion_kind, _duration_days integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _owner uuid; _cost numeric; _balance numeric; _ends timestamptz; _pricing jsonb; _key text;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT owner_id INTO _owner FROM public.listings WHERE id=_listing_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'listing_not_found'; END IF;
  IF _owner <> _me THEN RAISE EXCEPTION 'not_owner'; END IF;

  SELECT value INTO _pricing FROM public.platform_config WHERE key='pricing';

  IF _kind = 'featured' THEN
    IF COALESCE(_duration_days,7) = 30 THEN
      _cost := (_pricing->>'featured_30d_di')::numeric; _ends := now() + interval '30 days';
    ELSE
      _cost := (_pricing->>'featured_7d_di')::numeric; _ends := now() + interval '7 days';
      _duration_days := 7;
    END IF;
  ELSIF _kind = 'pinned' THEN
    _cost := (_pricing->>'pinned_7d_di')::numeric; _ends := now() + interval '7 days';
    _duration_days := 7;
  ELSIF _kind = 'boost' THEN
    _cost := (_pricing->>'boost_di')::numeric; _ends := NULL;
  ELSE
    RAISE EXCEPTION 'invalid_kind_for_listing';
  END IF;

  SELECT public.di_balance(_me) INTO _balance;
  IF _balance < _cost THEN RAISE EXCEPTION 'insufficient_di: needed %', _cost; END IF;

  INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, note)
  VALUES (_me, 'fee_charge', -_cost, 'ترقية إعلان: ' || _kind::text);

  INSERT INTO public.promotions(user_id, listing_id, kind, cost_di, duration_days, ends_at)
  VALUES (_me, _listing_id, _kind, _cost, _duration_days, _ends);

  IF _kind = 'featured' THEN
    UPDATE public.listings SET is_featured=true,
      featured_until = GREATEST(COALESCE(featured_until, now()), _ends)
      WHERE id=_listing_id;
  ELSIF _kind = 'pinned' THEN
    UPDATE public.listings SET is_pinned=true,
      pinned_until = GREATEST(COALESCE(pinned_until, now()), _ends)
      WHERE id=_listing_id;
  ELSIF _kind = 'boost' THEN
    UPDATE public.listings SET boost_count = boost_count + 1,
      last_boosted_at = now(), updated_at = now()
      WHERE id=_listing_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'cost_di', _cost, 'ends_at', _ends);
END $$;

-- 9) Purchase individual verification
CREATE OR REPLACE FUNCTION public.purchase_verification()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _cost numeric; _balance numeric; _ends timestamptz;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT (value->>'verify_individual_year_di')::numeric INTO _cost
    FROM public.platform_config WHERE key='pricing';
  SELECT public.di_balance(_me) INTO _balance;
  IF _balance < _cost THEN RAISE EXCEPTION 'insufficient_di: needed %', _cost; END IF;

  _ends := GREATEST(COALESCE((SELECT verified_until FROM public.profiles WHERE id=_me), now()), now()) + interval '1 year';

  INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, note)
  VALUES (_me, 'fee_charge', -_cost, 'توثيق حساب سنوي');

  INSERT INTO public.promotions(user_id, kind, cost_di, duration_days, ends_at)
  VALUES (_me, 'verify_individual', _cost, 365, _ends);

  UPDATE public.profiles SET verified_badge=true, verified_until=_ends WHERE id=_me;
  RETURN jsonb_build_object('ok', true, 'cost_di', _cost, 'ends_at', _ends);
END $$;

-- 10) Purchase merchant subscription
CREATE OR REPLACE FUNCTION public.purchase_subscription(_tier text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _cost numeric; _balance numeric; _ends timestamptz; _kind promotion_kind;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF _tier NOT IN ('merchant','store') THEN RAISE EXCEPTION 'invalid_tier'; END IF;

  IF _tier='merchant' THEN
    SELECT (value->>'sub_merchant_month_di')::numeric INTO _cost FROM public.platform_config WHERE key='pricing';
    _kind := 'sub_merchant';
  ELSE
    SELECT (value->>'sub_store_month_di')::numeric INTO _cost FROM public.platform_config WHERE key='pricing';
    _kind := 'sub_store';
  END IF;

  SELECT public.di_balance(_me) INTO _balance;
  IF _balance < _cost THEN RAISE EXCEPTION 'insufficient_di: needed %', _cost; END IF;

  _ends := GREATEST(COALESCE((SELECT renews_at FROM public.subscriptions WHERE user_id=_me AND status='active'::subscription_status ORDER BY renews_at DESC NULLS LAST LIMIT 1), now()), now()) + interval '30 days';

  INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, note)
  VALUES (_me, 'fee_charge', -_cost, 'اشتراك ' || _tier || ' شهري');

  INSERT INTO public.promotions(user_id, kind, cost_di, duration_days, ends_at)
  VALUES (_me, _kind, _cost, 30, _ends);

  INSERT INTO public.subscriptions(user_id, tier, status, price_sar, renews_at)
  VALUES (_me, _tier::subscription_tier, 'active'::subscription_status, _cost*5, _ends);

  RETURN jsonb_build_object('ok', true, 'cost_di', _cost, 'ends_at', _ends);
END $$;

-- 11) Auto-expire promo flags (call from a cron later if needed)
CREATE OR REPLACE FUNCTION public.expire_promotions()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.listings SET is_featured=false WHERE is_featured AND featured_until < now();
  UPDATE public.listings SET is_pinned=false WHERE is_pinned AND pinned_until < now();
  UPDATE public.profiles SET verified_badge=false WHERE verified_badge AND verified_until < now();
$$;
