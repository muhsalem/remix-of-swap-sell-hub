
-- Fix award_trade_badges: correct column names (from_user / to_user)
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
    FOREACH uid IN ARRAY ARRAY[NEW.from_user, NEW.to_user]
    LOOP
      SELECT COUNT(*) INTO trade_count
      FROM public.trade_offers
      WHERE status = 'completed'
        AND (from_user = uid OR to_user = uid);

      IF trade_count >= 1 THEN
        INSERT INTO public.user_badges(user_id, badge) VALUES (uid, 'first_trade')
        ON CONFLICT DO NOTHING;
      END IF;
      IF trade_count >= 5 THEN
        INSERT INTO public.user_badges(user_id, badge) VALUES (uid, 'trusted_trader')
        ON CONFLICT DO NOTHING;
      END IF;
      IF trade_count >= 25 THEN
        INSERT INTO public.user_badges(user_id, badge) VALUES (uid, 'top_trader')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Award early adopter badge to first 1000 existing profiles (by created_at)
INSERT INTO public.user_badges(user_id, badge)
SELECT id, 'early_adopter'::badge_kind
FROM public.profiles
ORDER BY created_at ASC
LIMIT 1000
ON CONFLICT DO NOTHING;

-- Also award verified_id badge to anyone already verified
INSERT INTO public.user_badges(user_id, badge)
SELECT id, 'verified_id'::badge_kind
FROM public.profiles
WHERE verified_badge = true
ON CONFLICT DO NOTHING;
