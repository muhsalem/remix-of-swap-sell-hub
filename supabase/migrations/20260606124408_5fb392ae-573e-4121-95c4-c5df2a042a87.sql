
-- 1) Contact fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text;

-- 2) Post-match fields on trade_offers
ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS meetup_location text,
  ADD COLUMN IF NOT EXISTS meetup_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS fee_paid_at timestamptz;

-- 3) Track payment split on platform_fees
ALTER TABLE public.platform_fees
  ADD COLUMN IF NOT EXISTS paid_di numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_cash_sar numeric NOT NULL DEFAULT 0;

-- 4) Peer contact view (only when offer accepted/completed and caller is party)
CREATE OR REPLACE FUNCTION public.get_peer_contact(_offer_id uuid)
RETURNS TABLE(user_id uuid, display_name text, contact_phone text, whatsapp text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from uuid; _to uuid; _status text; _me uuid := auth.uid();
  _peer uuid;
BEGIN
  SELECT o.from_user, o.to_user, o.status::text INTO _from, _to, _status
  FROM public.trade_offers o WHERE o.id = _offer_id;
  IF _me IS NULL OR (_me <> _from AND _me <> _to) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _status NOT IN ('accepted','completed') THEN
    RAISE EXCEPTION 'contact_locked';
  END IF;
  _peer := CASE WHEN _me = _from THEN _to ELSE _from END;
  RETURN QUERY
    SELECT p.id, p.display_name, p.contact_phone, p.whatsapp
    FROM public.profiles p WHERE p.id = _peer;
END $$;

GRANT EXECUTE ON FUNCTION public.get_peer_contact(uuid) TO authenticated;

-- 5) Pay platform fee with DI + cash mix
CREATE OR REPLACE FUNCTION public.pay_platform_fee(_offer_id uuid, _di_amount numeric, _cash_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _from uuid; _to uuid; _status text; _cash numeric; _base numeric; _fee numeric;
  _di_needed numeric; _di_balance numeric; _di_value_sar numeric;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  IF COALESCE(_di_amount,0) < 0 OR COALESCE(_cash_amount,0) < 0 THEN
    RAISE EXCEPTION 'invalid_amount';
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

  -- 1 DI = 5 SAR (matches existing trigger convention)
  _di_value_sar := COALESCE(_di_amount,0) * 5;
  IF ROUND(_di_value_sar + COALESCE(_cash_amount,0), 2) < _fee THEN
    RAISE EXCEPTION 'insufficient_total: needed % SAR', _fee;
  END IF;

  -- Check DI balance
  IF _di_amount > 0 THEN
    SELECT COALESCE(SUM(amount_di),0) INTO _di_balance
      FROM public.wallet_ledger WHERE user_id = _me;
    IF _di_balance < _di_amount THEN
      RAISE EXCEPTION 'insufficient_di_balance';
    END IF;
    INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
    VALUES (_me, 'fee_charge', -_di_amount, _offer_id, 'دفع عمولة منصة (DI)');
  END IF;

  -- Upsert fee record
  INSERT INTO public.platform_fees(offer_id, payer_id, amount_sar, rate, status, paid_at, paid_di, paid_cash_sar)
  VALUES (_offer_id, _me, _fee, 0.03, 'paid'::fee_status, now(), COALESCE(_di_amount,0), COALESCE(_cash_amount,0))
  ON CONFLICT (offer_id) DO UPDATE
    SET status='paid'::fee_status, paid_at=now(),
        paid_di = EXCLUDED.paid_di, paid_cash_sar = EXCLUDED.paid_cash_sar;

  UPDATE public.trade_offers SET fee_paid_at = now() WHERE id = _offer_id;
  RETURN jsonb_build_object('ok', true, 'fee_sar', _fee);
END $$;

GRANT EXECUTE ON FUNCTION public.pay_platform_fee(uuid, numeric, numeric) TO authenticated;

-- Need unique constraint for upsert above
CREATE UNIQUE INDEX IF NOT EXISTS platform_fees_offer_id_unique ON public.platform_fees(offer_id);

-- 6) Update completion trigger to skip fee charge if already paid
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
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT EXISTS(SELECT 1 FROM public.platform_fees WHERE offer_id = NEW.id AND status = 'paid'::fee_status) INTO already_paid;

    base_value := GREATEST(cash, 50);
    fee_amount := ROUND(base_value * fee_rate, 2);

    -- Only create due fee if none paid yet
    IF NOT already_paid THEN
      INSERT INTO public.platform_fees(offer_id, payer_id, amount_sar, rate)
      VALUES (NEW.id, NEW.from_user, fee_amount, fee_rate)
      ON CONFLICT (offer_id) DO NOTHING;
    END IF;

    -- Reward both parties with 50 DI
    INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
    VALUES
      (NEW.from_user, 'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة'),
      (NEW.to_user,   'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة');

    -- Only auto-charge DI if fee wasn't prepaid
    IF NOT already_paid THEN
      INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
      VALUES (NEW.from_user, 'fee_charge', -ROUND(fee_amount/5,2), NEW.id,
              'عمولة منصة ' || fee_amount || ' ر.س');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 7) Block status->completed if fee not paid AND cash_balance > 0 (lenient: only require for cash deals)
CREATE OR REPLACE FUNCTION public.require_fee_before_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_paid boolean;
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' AND COALESCE(NEW.cash_balance,0) > 0 THEN
    SELECT EXISTS(SELECT 1 FROM public.platform_fees WHERE offer_id = NEW.id AND status='paid'::fee_status) INTO has_paid;
    IF NOT has_paid THEN
      RAISE EXCEPTION 'يجب دفع عمولة المنصة قبل إكمال الصفقة النقدية';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_require_fee ON public.trade_offers;
CREATE TRIGGER trg_require_fee
  BEFORE UPDATE ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.require_fee_before_complete();
