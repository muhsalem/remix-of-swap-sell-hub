
-- 1) reward type enum
DO $$ BEGIN
  CREATE TYPE public.referral_reward_type AS ENUM ('free_featured_7d','welcome_discount_10','free_verify_month');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.referral_reward_status AS ENUM ('active','used','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) rewards table
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reward_type public.referral_reward_type NOT NULL,
  status public.referral_reward_status NOT NULL DEFAULT 'active',
  source_referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  role_in_referral text CHECK (role_in_referral IN ('referrer','referred')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_on_listing uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  note text
);
CREATE INDEX IF NOT EXISTS referral_rewards_user_idx ON public.referral_rewards(user_id, status);

GRANT SELECT ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rewards_self_read" ON public.referral_rewards;
CREATE POLICY "rewards_self_read" ON public.referral_rewards
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

-- 3) trial flag
INSERT INTO public.platform_config(key, value)
VALUES ('referrals_trial_enabled', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4) rewrite grant_referral_reward trigger fn to grant coupons during trial
CREATE OR REPLACE FUNCTION public.grant_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref record; di_on boolean; trial_on boolean;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT (value)::boolean INTO di_on   FROM public.platform_config WHERE key='di_enabled';
    SELECT (value)::boolean INTO trial_on FROM public.platform_config WHERE key='referrals_trial_enabled';

    FOR ref IN
      SELECT * FROM public.referrals
      WHERE referred_user IN (NEW.from_user, NEW.to_user)
        AND reward_pending = true
        AND rewarded = false
    LOOP
      IF COALESCE(di_on,false) THEN
        -- legacy DI reward path
        INSERT INTO public.wallet_ledger(user_id, amount_di, entry_type, note)
        VALUES
          (ref.referrer_id,   ref.reward_di, 'trade_completed', 'مكافأة إحالة ناجحة'),
          (ref.referred_user, ref.reward_di, 'trade_completed', 'مكافأة تسجيل عبر إحالة');
      ELSIF COALESCE(trial_on,false) THEN
        -- trial coupon path: free 7-day featured listing for both parties
        INSERT INTO public.referral_rewards(user_id, reward_type, source_referral_id, role_in_referral, note)
        VALUES
          (ref.referrer_id,   'free_featured_7d', ref.id, 'referrer', 'إعلان مميز 7 أيام مجاناً — مكافأة إحالة'),
          (ref.referred_user, 'free_featured_7d', ref.id, 'referred', 'إعلان مميز 7 أيام مجاناً — انضممت عبر إحالة');
      END IF;

      UPDATE public.referrals
        SET rewarded = true, reward_pending = false, redeemed_at = now()
        WHERE id = ref.id;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$;

-- 5) welcome coupon on redeem: RPC used by redeemReferral (below via server fn)
--    grants immediate welcome_discount_10 to the referred user.
CREATE OR REPLACE FUNCTION public.grant_welcome_referral_coupon(_referral_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ref record; trial_on boolean;
BEGIN
  SELECT (value)::boolean INTO trial_on FROM public.platform_config WHERE key='referrals_trial_enabled';
  IF NOT COALESCE(trial_on,false) THEN RETURN; END IF;

  SELECT * INTO _ref FROM public.referrals WHERE id = _referral_id;
  IF _ref.referred_user IS NULL THEN RETURN; END IF;

  -- idempotent: only insert if not already granted
  IF NOT EXISTS (
    SELECT 1 FROM public.referral_rewards
    WHERE source_referral_id = _ref.id AND reward_type = 'welcome_discount_10'
  ) THEN
    INSERT INTO public.referral_rewards(user_id, reward_type, source_referral_id, role_in_referral, note, expires_at)
    VALUES (_ref.referred_user, 'welcome_discount_10', _ref.id, 'referred',
            'خصم ترحيبي 10% على أول ترقية إعلان', now() + interval '30 days');
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.grant_welcome_referral_coupon(uuid) TO authenticated, service_role;
