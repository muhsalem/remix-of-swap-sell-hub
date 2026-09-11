ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS area_sqm numeric;
ALTER TABLE public.listing_image_hashes ADD COLUMN IF NOT EXISTS csig text;
ALTER TABLE public.listing_image_hashes ADD COLUMN IF NOT EXISTS esig text;