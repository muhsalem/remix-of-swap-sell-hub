-- C7: allow-list public reads on platform_config
DROP POLICY IF EXISTS config_public_read ON public.platform_config;
CREATE POLICY config_public_read ON public.platform_config
FOR SELECT TO anon, authenticated
USING (key IN ('di_enabled','commission_enabled','pricing','referrals_trial_enabled'));

-- C4: enforce riba rules at the database level
CREATE OR REPLACE FUNCTION public.enforce_riba_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a RECORD; b RECORD;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT is_ribawi, category, market_price INTO a
    FROM public.listings WHERE id = NEW.offered_listing;
  SELECT is_ribawi, category, market_price INTO b
    FROM public.listings WHERE id = NEW.requested_listing;

  IF COALESCE(a.is_ribawi,false) OR COALESCE(b.is_ribawi,false) THEN
    -- التقابض الفوري: تأكيد الطرفين للتسليم
    IF NOT (NEW.delivery_confirmed_by_from AND NEW.delivery_confirmed_by_to) THEN
      RAISE EXCEPTION 'riba_requires_immediate_exchange: يجب تأكيد التسليم من الطرفين (تقابض فوري) قبل إتمام صفقة ربوية';
    END IF;

    -- لا فارق نقدي في الصفقات الربوية
    IF COALESCE(NEW.cash_balance,0) <> 0 THEN
      RAISE EXCEPTION 'riba_cash_difference_forbidden: لا يجوز فارق نقدي في مبادلة الأصناف الربوية';
    END IF;

    -- تماثل الصنف يوجب تماثل القيمة (مثلاً بمثل)
    IF COALESCE(a.is_ribawi,false) AND COALESCE(b.is_ribawi,false)
       AND lower(trim(a.category)) = lower(trim(b.category))
       AND COALESCE(a.market_price,0) <> COALESCE(b.market_price,0) THEN
      RAISE EXCEPTION 'riba_value_mismatch: عند اتحاد الصنف الربوي يجب تساوي القيمة (مثلاً بمثل)';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_riba_rules ON public.trade_offers;
CREATE TRIGGER trg_enforce_riba_rules
BEFORE UPDATE ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.enforce_riba_rules();