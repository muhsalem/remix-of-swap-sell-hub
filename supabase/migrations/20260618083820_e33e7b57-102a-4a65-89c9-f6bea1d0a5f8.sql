DO $$ BEGIN
  CREATE TYPE public.listing_type AS ENUM ('item','service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS listing_type public.listing_type NOT NULL DEFAULT 'item';

UPDATE public.listings
SET listing_type = 'service'
WHERE listing_type = 'item'
  AND (category ~* 'خدم|استشار|تعليم|تدريب|service');

CREATE INDEX IF NOT EXISTS idx_listings_type_status
  ON public.listings (listing_type, status) WHERE status = 'active';