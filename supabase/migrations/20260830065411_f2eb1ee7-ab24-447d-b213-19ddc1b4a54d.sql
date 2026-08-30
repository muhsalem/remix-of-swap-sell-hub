-- restrict badge reads to signed-in users
DROP POLICY IF EXISTS "Badges are public readable" ON public.user_badges;
CREATE POLICY "Badges readable by signed-in users" ON public.user_badges
  FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.user_badges FROM anon;
GRANT SELECT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;

-- owners may insert their own image hashes; no client updates/deletes
CREATE POLICY "own image hashes insert" ON public.listing_image_hashes
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "admins manage image hashes" ON public.listing_image_hashes
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
REVOKE ALL ON public.listing_image_hashes FROM anon;
GRANT SELECT, INSERT ON public.listing_image_hashes TO authenticated;
GRANT ALL ON public.listing_image_hashes TO service_role;

-- email queue stays service-only for writes
REVOKE ALL ON public.email_queue FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.email_queue FROM authenticated;
GRANT SELECT ON public.email_queue TO authenticated;
GRANT ALL ON public.email_queue TO service_role;