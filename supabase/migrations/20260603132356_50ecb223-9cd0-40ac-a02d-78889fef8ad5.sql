-- 1) Terms acceptance + KYC fields
DO $$ BEGIN
  CREATE TYPE public.kyc_status AS ENUM ('none','pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS company_kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS company_kyc_doc_url text,
  ADD COLUMN IF NOT EXISTS company_kyc_notes text;

-- 2) Admin can update any profile (for KYC verification)
DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Update handle_new_user to set company kyc pending automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _account_type public.account_type;
  _kyc public.kyc_status;
BEGIN
  _account_type := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'account_type','individual') = 'company'
      THEN 'company'::public.account_type
    ELSE 'individual'::public.account_type
  END;
  _kyc := CASE WHEN _account_type = 'company' THEN 'pending'::public.kyc_status ELSE 'none'::public.kyc_status END;

  INSERT INTO public.profiles (id, display_name, avatar_url, account_type, company_name, company_kyc_status, terms_accepted_at, terms_version)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    _account_type,
    NULLIF(NEW.raw_user_meta_data->>'company_name',''),
    _kyc,
    CASE WHEN (NEW.raw_user_meta_data->>'terms_accepted') = 'true' THEN now() ELSE NULL END,
    NULLIF(NEW.raw_user_meta_data->>'terms_version','')
  );
  RETURN NEW;
END;
$function$;