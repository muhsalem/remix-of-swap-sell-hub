
DROP VIEW IF EXISTS public.leaderboard_weekly;
CREATE VIEW public.leaderboard_weekly
WITH (security_invoker = on) AS
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
WHERE COALESCE(p.trades_count, 0) > 0;

GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;
