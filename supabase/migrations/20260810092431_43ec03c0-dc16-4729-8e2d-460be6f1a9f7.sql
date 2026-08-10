DROP POLICY IF EXISTS config_public_read ON public.platform_config;
CREATE POLICY config_public_read ON public.platform_config
FOR SELECT TO anon, authenticated
USING (key IN ('di_enabled','commission_enabled','pricing','cash_pricing','referrals_trial_enabled'));