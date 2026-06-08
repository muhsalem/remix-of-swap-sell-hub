-- Add di_enabled flag (Phase 2 gate). Default OFF.
INSERT INTO public.platform_config(key, value)
VALUES ('di_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Gate DI-spending RPCs behind the flag
CREATE OR REPLACE FUNCTION public.purchase_listing_promotion(_listing_id uuid, _kind promotion_kind, _duration_days integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _owner uuid; _cost numeric; _balance numeric; _ends timestamptz; _pricing jsonb;
  _di_on boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT (value)::boolean INTO _di_on FROM public.platform_config WHERE key='di_enabled';
  IF NOT COALESCE(_di_on,false) THEN RAISE EXCEPTION 'di_disabled'; END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.purchase_verification()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _cost numeric; _balance numeric; _ends timestamptz; _di_on boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT (value)::boolean INTO _di_on FROM public.platform_config WHERE key='di_enabled';
  IF NOT COALESCE(_di_on,false) THEN RAISE EXCEPTION 'di_disabled'; END IF;

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
END $function$;

CREATE OR REPLACE FUNCTION public.purchase_subscription(_tier text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _cost numeric; _balance numeric; _ends timestamptz; _kind promotion_kind; _di_on boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  SELECT (value)::boolean INTO _di_on FROM public.platform_config WHERE key='di_enabled';
  IF NOT COALESCE(_di_on,false) THEN RAISE EXCEPTION 'di_disabled'; END IF;
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
END $function$;

-- Fee payment: don't allow DI portion when disabled
CREATE OR REPLACE FUNCTION public.pay_platform_fee(_offer_id uuid, _di_amount numeric, _cash_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _from uuid; _to uuid; _status text; _cash numeric; _base numeric; _fee numeric;
  _di_balance numeric; _di_value_sar numeric; _di_on boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF COALESCE(_di_amount,0) < 0 OR COALESCE(_cash_amount,0) < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT (value)::boolean INTO _di_on FROM public.platform_config WHERE key='di_enabled';
  IF NOT COALESCE(_di_on,false) AND COALESCE(_di_amount,0) > 0 THEN
    RAISE EXCEPTION 'di_disabled';
  END IF;

  SELECT from_user, to_user, status::text, COALESCE(cash_balance,0)
    INTO _from, _to, _status, _cash
  FROM public.trade_offers WHERE id = _offer_id;
  IF _from IS NULL THEN RAISE EXCEPTION 'offer_not_found'; END IF;
  IF _me <> _from THEN RAISE EXCEPTION 'only_initiator_pays'; END IF;
  IF _status <> 'accepted' THEN RAISE EXCEPTION 'fee_only_after_accept'; END IF;

  IF EXISTS (SELECT 1 FROM public.platform_fees WHERE offer_id = _offer_id AND status = 'paid'::fee_status) THEN
    RAISE EXCEPTION 'fee_already_paid';
  END IF;

  _base := GREATEST(_cash, 50);
  _fee := ROUND(_base * 0.03, 2);

  _di_value_sar := COALESCE(_di_amount,0) * 5;
  IF ROUND(_di_value_sar + COALESCE(_cash_amount,0), 2) < _fee THEN
    RAISE EXCEPTION 'insufficient_total: needed % SAR', _fee;
  END IF;

  IF _di_amount > 0 THEN
    SELECT COALESCE(SUM(amount_di),0) INTO _di_balance
      FROM public.wallet_ledger WHERE user_id = _me;
    IF _di_balance < _di_amount THEN
      RAISE EXCEPTION 'insufficient_di_balance';
    END IF;
    INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
    VALUES (_me, 'fee_charge', -_di_amount, _offer_id, 'دفع عمولة منصة (DI)');
  END IF;

  INSERT INTO public.platform_fees(offer_id, payer_id, amount_sar, rate, status, paid_at, paid_di, paid_cash_sar)
  VALUES (_offer_id, _me, _fee, 0.03, 'paid'::fee_status, now(), COALESCE(_di_amount,0), COALESCE(_cash_amount,0))
  ON CONFLICT (offer_id) DO UPDATE
    SET status='paid'::fee_status, paid_at=now(),
        paid_di = EXCLUDED.paid_di, paid_cash_sar = EXCLUDED.paid_cash_sar;

  UPDATE public.trade_offers SET fee_paid_at = now() WHERE id = _offer_id;
  RETURN jsonb_build_object('ok', true, 'fee_sar', _fee);
END $function$;

-- Trade completion: skip DI rewards/charges when DI is off
CREATE OR REPLACE FUNCTION public.on_trade_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fee_rate numeric := 0.03;
  cash numeric := COALESCE(NEW.cash_balance, 0);
  base_value numeric;
  fee_amount numeric;
  already_paid boolean;
  commission_on boolean;
  di_on boolean;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT (value)::boolean INTO commission_on FROM public.platform_config WHERE key='commission_enabled';
    commission_on := COALESCE(commission_on, true);
    SELECT (value)::boolean INTO di_on FROM public.platform_config WHERE key='di_enabled';
    di_on := COALESCE(di_on, false);

    IF di_on THEN
      INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
      VALUES
        (NEW.from_user, 'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة'),
        (NEW.to_user,   'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة');
    END IF;

    IF commission_on THEN
      SELECT EXISTS(SELECT 1 FROM public.platform_fees WHERE offer_id = NEW.id AND status = 'paid'::fee_status) INTO already_paid;
      base_value := GREATEST(cash, 50);
      fee_amount := ROUND(base_value * fee_rate, 2);
      IF NOT already_paid THEN
        INSERT INTO public.platform_fees(offer_id, payer_id, amount_sar, rate)
        VALUES (NEW.id, NEW.from_user, fee_amount, fee_rate)
        ON CONFLICT (offer_id) DO NOTHING;
        IF di_on THEN
          INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
          VALUES (NEW.from_user, 'fee_charge', -ROUND(fee_amount/5,2), NEW.id,
                  'عمولة منصة ' || fee_amount || ' ر.س');
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;