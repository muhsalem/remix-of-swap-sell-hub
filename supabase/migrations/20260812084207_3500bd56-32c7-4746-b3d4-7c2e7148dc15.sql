ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid;

ALTER TABLE public.fraud_signals
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.fraud_signals
  DROP CONSTRAINT IF EXISTS fraud_signals_review_status_chk;
ALTER TABLE public.fraud_signals
  ADD CONSTRAINT fraud_signals_review_status_chk
  CHECK (review_status IN ('pending','cleared','confirmed_fraud','needs_info'));

CREATE INDEX IF NOT EXISTS fraud_signals_review_idx ON public.fraud_signals(review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_signals_user_idx ON public.fraud_signals(user_id);

-- admins can review signals
DROP POLICY IF EXISTS "Admins update fraud signals" ON public.fraud_signals;
CREATE POLICY "Admins update fraud signals"
  ON public.fraud_signals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
GRANT UPDATE ON public.fraud_signals TO authenticated;

-- protect suspension fields from self-service edits
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
       OR NEW.trades_count IS DISTINCT FROM OLD.trades_count
       OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
       OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
       OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
       OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by THEN
      RAISE EXCEPTION 'privileged_profile_fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- suspended users cannot publish new listings
CREATE OR REPLACE FUNCTION public.block_suspended_listing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.owner_id AND is_suspended) THEN
    RAISE EXCEPTION 'account_suspended: الحساب معلّق حالياً، لا يمكن نشر إعلانات جديدة';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS block_suspended_listing_trg ON public.listings;
CREATE TRIGGER block_suspended_listing_trg
  BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.block_suspended_listing();