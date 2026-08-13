-- Arabic text normalization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.ar_normalize(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
    translate(
      regexp_replace(lower(coalesce(_t, '')), '[\u064B-\u0652\u0640]', '', 'g'),
      'أإآٱىئؤةڤگچپ',
      'اااايياهفكجب'
    ),
    '\s+', ' ', 'g'))
$$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS search_norm text
  GENERATED ALWAYS AS (
    public.ar_normalize(coalesce(title,'') || ' ' || coalesce(category,'') || ' ' || coalesce(description,'') || ' ' || coalesce(wants,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS listings_search_norm_trgm
  ON public.listings USING gin (search_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS listings_status_created_idx
  ON public.listings (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.search_listings_ar(_q text, _limit integer DEFAULT 40)
RETURNS SETOF public.listings
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.*
  FROM public.listings l
  WHERE l.status = 'active'
    AND (
      public.ar_normalize(_q) = '' OR
      l.search_norm ILIKE '%' || public.ar_normalize(_q) || '%' OR
      similarity(l.search_norm, public.ar_normalize(_q)) > 0.2
    )
  ORDER BY similarity(l.search_norm, public.ar_normalize(_q)) DESC, l.created_at DESC
  LIMIT least(coalesce(_limit, 40), 100)
$$;

GRANT EXECUTE ON FUNCTION public.search_listings_ar(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ar_normalize(text) TO anon, authenticated;

-- Blind reveal for reviews: visible after both sides reviewed, or 14 days
CREATE OR REPLACE FUNCTION public.get_public_reviews(_user uuid, _limit integer DEFAULT 10)
RETURNS TABLE(rating integer, created_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.rating, r.created_at
  FROM public.reviews r
  WHERE r.reviewed_user = _user
    AND (
      r.created_at < now() - interval '14 days'
      OR EXISTS (
        SELECT 1 FROM public.reviews r2
        WHERE r2.offer_id = r.offer_id
          AND r2.reviewer_id = r.reviewed_user
          AND r2.reviewed_user = r.reviewer_id
      )
    )
  ORDER BY r.created_at DESC
  LIMIT least(coalesce(_limit, 10), 50)
$$;