
-- Follow system
CREATE TABLE public.follows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id <> following_id)
);

GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;
GRANT ALL ON public.follows TO service_role;

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are public readable" ON public.follows
  FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.follows
  FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id);

-- Badges system: derived from profile stats. We store granted badges for fast lookup.
CREATE TYPE public.badge_kind AS ENUM (
  'verified_id',      -- KYC complete
  'first_trade',      -- Completed 1+ trade
  'trusted_trader',   -- 5+ trades, rating >= 4
  'top_trader',       -- 25+ trades
  'fast_responder',   -- Replies < 1h avg
  'shariah_champion', -- 10+ shariah-compliant trades
  'early_adopter'     -- Joined in first 1000
);

CREATE TABLE public.user_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge badge_kind NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge)
);

GRANT SELECT ON public.user_badges TO authenticated, anon;
GRANT ALL ON public.user_badges TO service_role;

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Badges are public readable" ON public.user_badges
  FOR SELECT USING (true);

CREATE INDEX idx_user_badges_user ON public.user_badges(user_id);

-- Auto-award trade-based badges when trade_offers reaches completed
CREATE OR REPLACE FUNCTION public.award_trade_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  trade_count INT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    FOREACH uid IN ARRAY ARRAY[NEW.sender_id, NEW.receiver_id]
    LOOP
      SELECT COUNT(*) INTO trade_count
      FROM trade_offers
      WHERE status = 'completed'
        AND (sender_id = uid OR receiver_id = uid);
      
      IF trade_count >= 1 THEN
        INSERT INTO user_badges(user_id, badge) VALUES (uid, 'first_trade')
        ON CONFLICT DO NOTHING;
      END IF;
      IF trade_count >= 5 THEN
        INSERT INTO user_badges(user_id, badge) VALUES (uid, 'trusted_trader')
        ON CONFLICT DO NOTHING;
      END IF;
      IF trade_count >= 25 THEN
        INSERT INTO user_badges(user_id, badge) VALUES (uid, 'top_trader')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_award_trade_badges
AFTER UPDATE OF status ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.award_trade_badges();
