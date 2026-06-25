
-- 1) Lock down SECURITY DEFINER function execution
-- Revoke from PUBLIC/anon/authenticated everywhere, then grant only what clients actually need.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant only the RPCs that the signed-in app calls directly:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.di_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_peer_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_listing_promotion(uuid, promotion_kind, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_subscription(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_verification() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_platform_fee(uuid, numeric, numeric) TO authenticated;

-- 2) Profiles: explicit column-level revokes for sensitive fields from anon
REVOKE SELECT (contact_phone, whatsapp, company_kyc_doc_url, company_kyc_notes,
               commercial_register, terms_accepted_at, terms_version)
  ON public.profiles FROM anon;

-- Also restrict anon to only safe columns explicitly
GRANT SELECT (id, display_name, avatar_url, rating, trades_count, account_type,
              company_name, verified_badge, verified_until, created_at, updated_at)
  ON public.profiles TO anon;

-- 3) Disputes: prevent parties from writing status/resolution at the column-privilege layer
REVOKE UPDATE (status, resolution, opened_by, offer_id, reason) ON public.disputes FROM authenticated;
GRANT  UPDATE (evidence) ON public.disputes TO authenticated;
-- Admins/service still have full access via service_role and the existing guard trigger.
