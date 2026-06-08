
-- 1) LISTINGS: block promo fields from owner update via trigger
CREATE OR REPLACE FUNCTION public.listings_owner_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.featured_until IS DISTINCT FROM OLD.featured_until
     OR NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
     OR NEW.pinned_until IS DISTINCT FROM OLD.pinned_until
     OR NEW.boost_count IS DISTINCT FROM OLD.boost_count
     OR NEW.last_boosted_at IS DISTINCT FROM OLD.last_boosted_at
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'promotion_fields_locked: use purchase_listing_promotion';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS listings_owner_update_guard_trg ON public.listings;
CREATE TRIGGER listings_owner_update_guard_trg
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_owner_update_guard();

-- 2) TRADE_OFFERS: block system fields from party updates via trigger
CREATE OR REPLACE FUNCTION public.trade_offers_party_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.from_user IS DISTINCT FROM OLD.from_user
     OR NEW.to_user IS DISTINCT FROM OLD.to_user
     OR NEW.from_listing IS DISTINCT FROM OLD.from_listing
     OR NEW.to_listing IS DISTINCT FROM OLD.to_listing
     OR NEW.cash_balance IS DISTINCT FROM OLD.cash_balance
     OR NEW.fee_paid_at IS DISTINCT FROM OLD.fee_paid_at THEN
    RAISE EXCEPTION 'protected_fields_locked: state transitions must go through server functions';
  END IF;
  -- escrow_locked / escrow_released_at columns (block if present)
  BEGIN
    IF NEW.escrow_locked IS DISTINCT FROM OLD.escrow_locked
       OR NEW.escrow_released_at IS DISTINCT FROM OLD.escrow_released_at THEN
      RAISE EXCEPTION 'protected_fields_locked: escrow fields are managed by server';
    END IF;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trade_offers_party_update_guard_trg ON public.trade_offers;
CREATE TRIGGER trade_offers_party_update_guard_trg
  BEFORE UPDATE ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.trade_offers_party_update_guard();

-- 3) SUBSCRIPTIONS: remove client write access entirely
DROP POLICY IF EXISTS subs_self_update ON public.subscriptions;
DROP POLICY IF EXISTS subs_self_insert ON public.subscriptions;

-- Admin-only update (server uses service_role which bypasses RLS)
CREATE POLICY subs_admin_update ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
