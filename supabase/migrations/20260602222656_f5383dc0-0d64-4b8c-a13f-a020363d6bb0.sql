-- إضافة حالة completed لجدول العروض
ALTER TYPE offer_status ADD VALUE IF NOT EXISTS 'completed';

-- جدول الرسائل
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_offer ON public.messages(offer_id, created_at);

GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_party_read ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_offers o
    WHERE o.id = offer_id AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
  ));

CREATE POLICY messages_party_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.trade_offers o
      WHERE o.id = offer_id AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
    )
  );

-- جدول التقييمات
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  reviewed_user uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (char_length(comment) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, reviewer_id)
);

CREATE INDEX idx_reviews_user ON public.reviews(reviewed_user);

GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY reviews_public_read ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY reviews_insert_completed ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.trade_offers o
      WHERE o.id = offer_id
        AND o.status = 'completed'
        AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
        AND (o.from_user = reviewed_user OR o.to_user = reviewed_user)
        AND reviewed_user <> auth.uid()
    )
  );

-- دالة تحديث متوسط تقييم المستخدم
CREATE OR REPLACE FUNCTION public.update_profile_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 2)
    FROM public.reviews
    WHERE reviewed_user = NEW.reviewed_user
  ), 0),
  trades_count = COALESCE((
    SELECT COUNT(*) FROM public.reviews WHERE reviewed_user = NEW.reviewed_user
  ), 0)
  WHERE id = NEW.reviewed_user;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_profile_rating
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_profile_rating();
