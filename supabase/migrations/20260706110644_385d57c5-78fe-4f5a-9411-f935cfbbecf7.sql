
-- Fix follows_public_read: restrict social graph reads to authenticated users
DROP POLICY IF EXISTS "Follows are public readable" ON public.follows;
CREATE POLICY "follows_authenticated_read" ON public.follows
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.follows FROM anon;

-- Fix profiles_admin_update_missing_check: add WITH CHECK to admin update policy
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fix reviews_public_read_comments: hide review comments from anonymous public;
-- expose rating aggregate via profiles.rating (updated by trigger).
DROP POLICY IF EXISTS reviews_public_read ON public.reviews;
CREATE POLICY reviews_authenticated_read ON public.reviews
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.reviews FROM anon;
