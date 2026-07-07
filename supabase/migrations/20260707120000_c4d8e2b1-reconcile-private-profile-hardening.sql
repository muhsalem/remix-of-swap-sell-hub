-- Reconciliation: completes the partial profiles_private migration (20260707064733)
-- to match the full security-hardening design (20260706150000).
-- All statements are idempotent; this file documents the state already applied
-- to the live database on 2026-07-07.

-- 1) Complete the private table schema
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS commercial_register text,
  ADD COLUMN IF NOT EXISTS company_kyc_doc_url text;

-- Direct FK to profiles so PostgREST can embed profiles_private from profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_private_user_id_profiles_fkey'
      AND conrelid = 'public.profiles_private'::regclass
  ) THEN
    ALTER TABLE public.profiles_private
      ADD CONSTRAINT profiles_private_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Admins may upsert private rows (KYC notes) in addition to the self-only insert policy
DROP POLICY IF EXISTS "private_admin_insert" ON public.profiles_private;
CREATE POLICY "private_admin_insert" ON public.profiles_private
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2) Migrate remaining sensitive data out of profiles, then drop the columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='contact_phone'
  ) THEN
    INSERT INTO public.profiles_private (user_id, contact_phone, whatsapp, commercial_register, company_kyc_doc_url, company_kyc_notes)
    SELECT id, contact_phone, whatsapp, commercial_register, company_kyc_doc_url, company_kyc_notes
    FROM public.profiles
    ON CONFLICT (user_id) DO UPDATE SET
      contact_phone       = COALESCE(profiles_private.contact_phone, EXCLUDED.contact_phone),
      whatsapp            = COALESCE(profiles_private.whatsapp, EXCLUDED.whatsapp),
      commercial_register = COALESCE(profiles_private.commercial_register, EXCLUDED.commercial_register),
      company_kyc_doc_url = COALESCE(profiles_private.company_kyc_doc_url, EXCLUDED.company_kyc_doc_url),
      company_kyc_notes   = COALESCE(profiles_private.company_kyc_notes, EXCLUDED.company_kyc_notes);
  END IF;
END $$;

-- get_peer_contact reads from the private table (same offer-gated behavior)
CREATE OR REPLACE FUNCTION public.get_peer_contact(_offer_id uuid)
 RETURNS TABLE(user_id uuid, display_name text, contact_phone text, whatsapp text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _from uuid; _to uuid; _status text; _me uuid := auth.uid();
  _peer uuid;
BEGIN
  SELECT o.from_user, o.to_user, o.status::text INTO _from, _to, _status
  FROM public.trade_offers o WHERE o.id = _offer_id;
  IF _me IS NULL OR (_me <> _from AND _me <> _to) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF _status NOT IN ('accepted','completed') THEN
    RAISE EXCEPTION 'contact_locked';
  END IF;
  _peer := CASE WHEN _me = _from THEN _to ELSE _from END;
  RETURN QUERY
    SELECT p.id, p.display_name, pp.contact_phone, pp.whatsapp
    FROM public.profiles p
    LEFT JOIN public.profiles_private pp ON pp.user_id = p.id
    WHERE p.id = _peer;
END $function$;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS whatsapp,
  DROP COLUMN IF EXISTS commercial_register,
  DROP COLUMN IF EXISTS company_kyc_doc_url,
  DROP COLUMN IF EXISTS company_kyc_notes;

-- 3) Every new user gets a private row alongside the public profile
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

  INSERT INTO public.profiles_private (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 4) Guard privileged profile columns from self-service edits.
--    current_user stays 'authenticated'/'anon' only for direct API writes;
--    SECURITY DEFINER functions run as the table owner and pass through.
CREATE OR REPLACE FUNCTION public.profiles_privileged_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF NEW.verified_badge IS DISTINCT FROM OLD.verified_badge
       OR NEW.verified_until IS DISTINCT FROM OLD.verified_until
       OR NEW.company_verified IS DISTINCT FROM OLD.company_verified
       OR NEW.company_kyc_status IS DISTINCT FROM OLD.company_kyc_status
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.trades_count IS DISTINCT FROM OLD.trades_count THEN
      RAISE EXCEPTION 'privileged_profile_fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_privileged_guard ON public.profiles;
CREATE TRIGGER profiles_privileged_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_privileged_guard();

-- 5) Rate limiter support index
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_created
  ON public.rate_limits (user_id, action, created_at DESC);
