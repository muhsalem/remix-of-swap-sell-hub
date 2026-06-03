-- Platform fees ledger
CREATE TYPE public.fee_status AS ENUM ('due','paid','waived');

CREATE TABLE public.platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  amount_sar numeric(12,2) NOT NULL CHECK (amount_sar >= 0),
  rate numeric(5,4) NOT NULL DEFAULT 0.03,
  status public.fee_status NOT NULL DEFAULT 'due',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_fees TO authenticated;
GRANT ALL ON public.platform_fees TO service_role;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY fees_self_read ON public.platform_fees FOR SELECT TO authenticated
  USING (payer_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY fees_admin_write ON public.platform_fees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX idx_platform_fees_payer ON public.platform_fees(payer_id);
CREATE INDEX idx_platform_fees_offer ON public.platform_fees(offer_id);

-- Wallet ledger (DI accounting)
CREATE TYPE public.ledger_entry_type AS ENUM (
  'welcome_bonus','trade_completed','fee_charge','manual_adjust','refund'
);

CREATE TABLE public.wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_type public.ledger_entry_type NOT NULL,
  amount_di numeric(12,2) NOT NULL,
  reference_offer uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wallet_ledger TO authenticated;
GRANT ALL ON public.wallet_ledger TO service_role;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY ledger_self_read ON public.wallet_ledger FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY ledger_admin_write ON public.wallet_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE INDEX idx_ledger_user ON public.wallet_ledger(user_id, created_at DESC);

-- Auto-create fee + ledger entries on completed trade
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
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Base = larger of cash_balance and a flat 50 SAR floor
    base_value := GREATEST(cash, 50);
    fee_amount := ROUND(base_value * fee_rate, 2);

    INSERT INTO public.platform_fees(offer_id, payer_id, amount_sar, rate)
    VALUES (NEW.id, NEW.from_user, fee_amount, fee_rate);

    -- Reward both parties with 50 DI for completing the trade
    INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
    VALUES
      (NEW.from_user, 'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة'),
      (NEW.to_user,   'trade_completed', 50, NEW.id, 'مكافأة إكمال صفقة');

    -- Charge fee from initiator
    INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
    VALUES (NEW.from_user, 'fee_charge', -ROUND(fee_amount/5,2), NEW.id,
            'عمولة منصة ' || fee_amount || ' ر.س');
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.on_trade_completed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_on_trade_completed ON public.trade_offers;
CREATE TRIGGER trg_on_trade_completed
  AFTER UPDATE ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.on_trade_completed();