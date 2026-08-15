-- 1) DI gap coverage on trade offers
ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS di_balance numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.trade_offers
  DROP CONSTRAINT IF EXISTS trade_offers_di_balance_nonneg;
ALTER TABLE public.trade_offers
  ADD CONSTRAINT trade_offers_di_balance_nonneg CHECK (di_balance >= 0 AND di_balance <= 1000000);

CREATE OR REPLACE FUNCTION public.validate_offer_di_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _di_on boolean;
  _bal numeric;
BEGIN
  IF COALESCE(NEW.di_balance,0) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT (value)::boolean INTO _di_on FROM public.platform_config WHERE key='di_enabled';
  IF NOT COALESCE(_di_on,false) THEN
    RAISE EXCEPTION 'di_disabled';
  END IF;

  SELECT public.di_balance(NEW.from_user) INTO _bal;
  IF COALESCE(_bal,0) < NEW.di_balance THEN
    RAISE EXCEPTION 'insufficient_di_balance';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_offer_di_balance ON public.trade_offers;
CREATE TRIGGER trg_validate_offer_di_balance
  BEFORE INSERT ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.validate_offer_di_balance();

-- 2) Settle the DI gap when the trade completes (ledger is source of truth)
CREATE OR REPLACE FUNCTION public.settle_offer_di_gap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _di_on boolean;
  _bal numeric;
  _amt numeric := COALESCE(NEW.di_balance,0);
BEGIN
  IF NEW.status <> 'completed' OR OLD.status IS NOT DISTINCT FROM 'completed' THEN
    RETURN NEW;
  END IF;
  IF _amt <= 0 THEN RETURN NEW; END IF;

  SELECT (value)::boolean INTO _di_on FROM public.platform_config WHERE key='di_enabled';
  IF NOT COALESCE(_di_on,false) THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.wallet_ledger
    WHERE reference_offer = NEW.id AND entry_type = 'di_gap_out'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT public.di_balance(NEW.from_user) INTO _bal;
  IF COALESCE(_bal,0) < _amt THEN
    RAISE EXCEPTION 'insufficient_di_balance';
  END IF;

  INSERT INTO public.wallet_ledger(user_id, entry_type, amount_di, reference_offer, note)
  VALUES
    (NEW.from_user, 'di_gap_out', -_amt, NEW.id, 'تغطية فرق القيمة بعملة DI'),
    (NEW.to_user,   'di_gap_in',   _amt, NEW.id, 'استلام فرق القيمة بعملة DI');

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_settle_offer_di_gap ON public.trade_offers;
CREATE TRIGGER trg_settle_offer_di_gap
  AFTER UPDATE OF status ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.settle_offer_di_gap();

-- 3) Wishlist alerts: normalized Arabic matching, fires on publish and on re-activation
CREATE OR REPLACE FUNCTION public.notify_wishlist_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  hay text;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  hay := public.ar_normalize(
    coalesce(NEW.title,'') || ' ' || coalesce(NEW.category,'') || ' ' ||
    coalesce(NEW.description,'') || ' ' || coalesce(NEW.wants,'')
  );

  FOR r IN
    SELECT w.id, w.user_id, w.search_term,
           public.ar_normalize(w.search_term) AS norm
    FROM public.wishlist_alerts w
    WHERE w.fulfilled = false
      AND w.user_id <> NEW.owner_id
      AND (
        position(public.ar_normalize(w.search_term) in hay) > 0
        OR similarity(public.ar_normalize(w.search_term), hay) > 0.28
      )
    ORDER BY similarity(public.ar_normalize(w.search_term), hay) DESC
    LIMIT 50
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (
      r.user_id,
      'wishlist_match',
      'توفّر ما كنت تبحث عنه',
      'تم نشر إعلان يطابق "' || r.search_term || '": ' || NEW.title,
      '/listings/' || NEW.id::text
    );
    UPDATE public.wishlist_alerts
      SET fulfilled = true, fulfilled_at = now(), fulfilled_listing_id = NEW.id
      WHERE id = r.id;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_wishlist_matches ON public.listings;
CREATE TRIGGER trg_notify_wishlist_matches
  AFTER INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_matches();

DROP TRIGGER IF EXISTS trg_notify_wishlist_matches_upd ON public.listings;
CREATE TRIGGER trg_notify_wishlist_matches_upd
  AFTER UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.notify_wishlist_matches();