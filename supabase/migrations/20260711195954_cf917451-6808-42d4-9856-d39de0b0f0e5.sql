
-- Revoke EXECUTE on trigger-only and cron-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_trade_badges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_fee_before_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_privileged_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_referral_reward() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_listing_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_offer_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_promotions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manage_escrow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_trade_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_wishlist_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.disputes_party_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.listings_owner_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trade_offers_party_update_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Restrict RPC-callable definer functions to authenticated only (block anon)
REVOKE EXECUTE ON FUNCTION public.di_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_peer_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pay_platform_fee(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_verification() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_subscription(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_listing_promotion(uuid, promotion_kind, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.di_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_peer_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_platform_fee(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_verification() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_subscription(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_listing_promotion(uuid, promotion_kind, integer) TO authenticated;

-- has_role / get_public_reviews / get_follow_counts stay public-readable (used in RLS and public profile pages)
