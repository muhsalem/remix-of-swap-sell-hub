
REVOKE EXECUTE ON FUNCTION public.record_listing_price() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_offer_event() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM public, anon, authenticated;

DROP POLICY IF EXISTS "price_history_auth_insert" ON public.price_history;
CREATE POLICY "price_history_auth_insert" ON public.price_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
