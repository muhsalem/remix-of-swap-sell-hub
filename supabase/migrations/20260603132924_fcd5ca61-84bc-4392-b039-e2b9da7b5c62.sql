ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS shipping_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS expected_delivery date,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by_from boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by_to boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_proof_url text;

CREATE INDEX IF NOT EXISTS idx_trade_offers_tracking ON public.trade_offers(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_price_history_lookup ON public.price_history(category, title_key);