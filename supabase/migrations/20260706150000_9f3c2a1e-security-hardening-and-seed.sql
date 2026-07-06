-- Security hardening + launch seed
-- 1) Move sensitive contact/KYC data out of publicly readable `profiles`
-- 2) Guard privileged profile columns from self-service edits
-- 3) Seed platform_config and region_settings
-- 4) Index rate_limits for the server-side rate limiter

-- ============================================================
-- 1) Private profile data (contact + KYC) — never publicly readable
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_phone text,
  whatsapp text,
  commercial_register text,
  company_kyc_doc_url text,
  company_kyc_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "private_self_or_admin_read" ON public.profiles_private
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "private_self_or_admin_insert" ON public.profiles_private
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "private_self_or_admin_update" ON public.profiles_private
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER profiles_private_touch_updated_at
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Migrate any existing data before dropping the exposed columns
INSERT INTO public.profiles_private (user_id, contact_phone, whatsapp, commercial_register, company_kyc_doc_url, company_kyc_notes)
SELECT id, contact_phone, whatsapp, commercial_register, company_kyc_doc_url, company_kyc_notes
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- get_peer_contact now reads from profiles_private (same signature & gating)
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

-- Every new user gets a private row alongside the public profile
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

-- ============================================================
-- 2) Guard privileged profile columns (badges, rating, KYC status)
--    Blocks direct self-service edits via the API while allowing
--    SECURITY DEFINER flows (purchase_verification, rating triggers)
--    and admins.
-- ============================================================
CREATE OR REPLACE FUNCTION public.profiles_privileged_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- current_user stays 'authenticated'/'anon' only for direct API writes;
  -- SECURITY DEFINER functions run as the table owner and pass through.
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

-- ============================================================
-- 3) Seed platform configuration (idempotent)
--    di_enabled=false: المرحلة الثانية — تُفعَّل من لوحة الإدارة
-- ============================================================
INSERT INTO public.platform_config (key, value) VALUES
  ('pricing', '{"featured_7d_di": 4, "featured_30d_di": 12, "pinned_7d_di": 6, "boost_di": 2, "verify_individual_year_di": 20, "sub_merchant_month_di": 30, "sub_store_month_di": 60}'::jsonb),
  ('commission_enabled', 'true'::jsonb),
  ('di_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.region_settings (country_code, di_enabled, cash_only, note) VALUES
  ('SAR', true,  false, 'السعودية — الوضع الافتراضي'),
  ('AED', true,  false, 'الإمارات'),
  ('KWD', true,  false, 'الكويت'),
  ('QAR', true,  false, 'قطر'),
  ('BHD', true,  false, 'البحرين'),
  ('OMR', true,  false, 'عُمان'),
  ('EGP', false, true,  'مصر — وضع نقدي فقط (قيود تنظيمية)'),
  ('JOD', false, true,  'الأردن — وضع نقدي فقط (قيود تنظيمية)'),
  ('TND', false, true,  'تونس — وضع نقدي فقط (قيود تنظيمية)'),
  ('MAD', false, true,  'المغرب — وضع نقدي فقط (قيود تنظيمية)')
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================
-- 4) Rate limiter support index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action_created
  ON public.rate_limits (user_id, action, created_at DESC);
