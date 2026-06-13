ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS anchor_price_sar numeric(12,2),
  ADD COLUMN IF NOT EXISTS anchor_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_trade_offers_anchor_expires
  ON public.trade_offers (anchor_expires_at)
  WHERE anchor_expires_at IS NOT NULL;