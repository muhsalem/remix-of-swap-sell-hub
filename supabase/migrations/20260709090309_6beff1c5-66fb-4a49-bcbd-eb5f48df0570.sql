
-- ============ 1) tighten follows/reviews RLS ============
DROP POLICY IF EXISTS "follows_authenticated_read" ON public.follows;
CREATE POLICY "follows_own_read" ON public.follows
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());

DROP POLICY IF EXISTS "reviews_authenticated_read" ON public.reviews;
-- Reviewer or reviewed party can see privately; public reads go via a SECURITY DEFINER function
CREATE POLICY "reviews_party_read" ON public.reviews
  FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR reviewed_user = auth.uid());

-- Public projection of reviews (no comment leakage, capped)
CREATE OR REPLACE FUNCTION public.get_public_reviews(_user uuid, _limit int DEFAULT 20)
RETURNS TABLE(rating int, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rating, created_at FROM public.reviews
  WHERE reviewed_user = _user
  ORDER BY created_at DESC LIMIT LEAST(_limit, 100)
$$;
REVOKE ALL ON FUNCTION public.get_public_reviews(uuid,int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(uuid,int) TO anon, authenticated;

-- Public follower counts
CREATE OR REPLACE FUNCTION public.get_follow_counts(_user uuid)
RETURNS TABLE(followers bigint, following bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.follows WHERE following_id = _user),
    (SELECT count(*) FROM public.follows WHERE follower_id  = _user)
$$;
REVOKE ALL ON FUNCTION public.get_follow_counts(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_follow_counts(uuid) TO anon, authenticated;

-- ============ 2) KYC AI fields ============
ALTER TABLE public.profiles_private
  ADD COLUMN IF NOT EXISTS kyc_ai_score numeric,
  ADD COLUMN IF NOT EXISTS kyc_ai_report jsonb,
  ADD COLUMN IF NOT EXISTS kyc_ai_at timestamptz;

-- ============ 3) Leaderboard view ============
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
  p.id AS user_id,
  p.display_name,
  p.avatar_url,
  p.verified_badge,
  COALESCE(p.rating, 0) AS rating,
  COALESCE(p.trades_count, 0) AS total_trades,
  COALESCE((
    SELECT COUNT(*) FROM public.trade_offers o
    WHERE o.status = 'completed'
      AND (o.from_user = p.id OR o.to_user = p.id)
      AND o.updated_at > now() - interval '7 days'
  ), 0) AS weekly_trades,
  (SELECT COUNT(*) FROM public.user_badges b WHERE b.user_id = p.id) AS badges_count
FROM public.profiles p
WHERE COALESCE(p.trades_count, 0) > 0
ORDER BY weekly_trades DESC, rating DESC, total_trades DESC
LIMIT 100;

GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;

-- ============ 4) Analytics events ============
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  path text,
  referrer text,
  user_id uuid,
  session_id text,
  country text,
  device text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO service_role;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (rate-limited server-side), only admins can read
CREATE POLICY "analytics_insert_anyone" ON public.analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (event_name IS NOT NULL AND char_length(event_name) <= 60);

CREATE POLICY "analytics_admin_read" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_analytics_created ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event   ON public.analytics_events (event_name, created_at DESC);

-- ============ 5) Referral: reward on first completed trade ============
-- Drop premature reward from redeemReferral by tracking pending state.
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS reward_pending boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.grant_referral_reward()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref record; di_on boolean;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT (value)::boolean INTO di_on FROM public.platform_config WHERE key='di_enabled';
    IF NOT COALESCE(di_on,false) THEN RETURN NEW; END IF;

    FOR ref IN
      SELECT * FROM public.referrals
      WHERE referred_user IN (NEW.from_user, NEW.to_user)
        AND reward_pending = true
        AND rewarded = false
    LOOP
      INSERT INTO public.wallet_ledger(user_id, amount_di, entry_type, note)
      VALUES
        (ref.referrer_id,  ref.reward_di, 'trade_completed', 'مكافأة إحالة ناجحة'),
        (ref.referred_user, ref.reward_di, 'trade_completed', 'مكافأة تسجيل عبر إحالة');
      UPDATE public.referrals
        SET rewarded = true, reward_pending = false, redeemed_at = now()
        WHERE id = ref.id;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_referral_reward ON public.trade_offers;
CREATE TRIGGER trg_referral_reward
  AFTER UPDATE ON public.trade_offers
  FOR EACH ROW EXECUTE FUNCTION public.grant_referral_reward();

-- ============ 6) Performance indexes ============
CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON public.listings (status, created_at DESC)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_owner
  ON public.listings (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_offers_from
  ON public.trade_offers (from_user, status);
CREATE INDEX IF NOT EXISTS idx_trade_offers_to
  ON public.trade_offers (to_user, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user
  ON public.wallet_ledger (user_id, created_at DESC);
