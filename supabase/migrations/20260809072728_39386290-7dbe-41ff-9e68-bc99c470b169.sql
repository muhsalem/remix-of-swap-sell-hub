ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS price_input_sar numeric,
  ADD COLUMN IF NOT EXISTS price_reference_sar numeric,
  ADD COLUMN IF NOT EXISTS price_source text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS price_deviation_pct numeric;

DO $$ BEGIN
  ALTER TABLE public.listings
    ADD CONSTRAINT listings_price_source_chk
    CHECK (price_source IN ('user','user_clamped','fmv_reference','ai_estimate'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.listings.price_input_sar IS 'السعر كما أدخله المستخدم قبل التطبيع';
COMMENT ON COLUMN public.listings.price_reference_sar IS 'مرجع Fair Market Value وقت النشر';
COMMENT ON COLUMN public.listings.price_source IS 'مصدر السعر النهائي';
COMMENT ON COLUMN public.listings.price_deviation_pct IS 'نسبة انحراف مدخل المستخدم عن المرجع';