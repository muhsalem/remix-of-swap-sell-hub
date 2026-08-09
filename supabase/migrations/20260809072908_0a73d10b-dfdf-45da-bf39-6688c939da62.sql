CREATE OR REPLACE FUNCTION public.listings_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NEW.price_input_sar IS DISTINCT FROM OLD.price_input_sar
     OR NEW.price_reference_sar IS DISTINCT FROM OLD.price_reference_sar
     OR NEW.price_source IS DISTINCT FROM OLD.price_source
     OR NEW.price_deviation_pct IS DISTINCT FROM OLD.price_deviation_pct THEN
    RAISE EXCEPTION 'price_provenance_locked: price source fields are system-managed';
  END IF;
  RETURN NEW;
END
$$;