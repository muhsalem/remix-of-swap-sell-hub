ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.listings ADD CONSTRAINT listings_city_check CHECK (city IS NULL OR char_length(city) BETWEEN 2 AND 60);
CREATE INDEX IF NOT EXISTS listings_city_idx ON public.listings (city, status) WHERE status = 'active'::listing_status;