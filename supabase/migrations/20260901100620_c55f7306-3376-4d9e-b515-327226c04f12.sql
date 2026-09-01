DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Re-grant only the RPCs the app actually calls
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(uuid, integer) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.di_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.di_statement(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_peer_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_platform_fee(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_listing_promotion(uuid, promotion_kind, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_subscription(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_verification() TO authenticated;
