
-- 1) PROFILES: column-level grants, sensitive cols hidden
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, bio, rating, trades_count, created_at, updated_at, account_type, company_name, company_verified, verified_badge, verified_until, terms_version)
  ON public.profiles TO anon, authenticated;
GRANT UPDATE, INSERT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- 2) AUDIT LOG: remove client insert
DROP POLICY IF EXISTS audit_log_self_insert ON public.audit_log;

-- 3) NOTIFICATIONS: remove client insert (server/triggers only)
DROP POLICY IF EXISTS notif_self_insert ON public.notifications;

-- 4) PRICE HISTORY: remove client insert
DROP POLICY IF EXISTS price_history_auth_insert ON public.price_history;

-- 5) REFERRALS: remove client update entirely
DROP POLICY IF EXISTS referrals_self_update ON public.referrals;

-- 6) DISPUTES: parties may only update `evidence`; status/resolution locked to admin
DROP POLICY IF EXISTS disputes_party_update ON public.disputes;

CREATE OR REPLACE FUNCTION public.disputes_party_update_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.resolution IS DISTINCT FROM OLD.resolution
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.offer_id IS DISTINCT FROM OLD.offer_id
     OR NEW.opened_by IS DISTINCT FROM OLD.opened_by THEN
    RAISE EXCEPTION 'only_evidence_editable_by_parties';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS disputes_party_update_guard_trg ON public.disputes;
CREATE TRIGGER disputes_party_update_guard_trg
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.disputes_party_update_guard();

CREATE POLICY disputes_party_update_evidence ON public.disputes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trade_offers o
                 WHERE o.id = disputes.offer_id
                   AND (o.from_user = auth.uid() OR o.to_user = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trade_offers o
                      WHERE o.id = disputes.offer_id
                        AND (o.from_user = auth.uid() OR o.to_user = auth.uid())));

-- 7) SECURITY DEFINER functions: revoke broad EXECUTE
REVOKE EXECUTE ON FUNCTION public.update_profile_rating() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_listing_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.require_fee_before_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_offer_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.manage_escrow() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_wishlist_matches() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_trade_completed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_promotions() FROM PUBLIC, anon, authenticated;

-- Keep user-callable RPCs accessible to authenticated only (revoke anon)
REVOKE EXECUTE ON FUNCTION public.pay_platform_fee(uuid, numeric, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_verification() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_listing_promotion(uuid, promotion_kind, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_subscription(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_peer_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.di_balance(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
