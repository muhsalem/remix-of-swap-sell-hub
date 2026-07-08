-- Restrict profile UPDATE grants so authenticated users cannot self-escalate
-- (e.g. flip verified_badge=true or company_kyc_status='verified' via REST).
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  display_name,
  avatar_url,
  bio,
  account_type,
  company_name,
  terms_accepted_at,
  terms_version
) ON public.profiles TO authenticated;

-- service_role keeps ALL privileges for admin-side operations (KYC review, etc.)
GRANT ALL ON public.profiles TO service_role;