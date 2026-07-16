ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_country text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_country_chk
  CHECK (preferred_country IS NULL OR preferred_country IN ('SAR','EGP'));