
CREATE TABLE IF NOT EXISTS public.market_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  title_key text NOT NULL,
  country text NOT NULL DEFAULT 'SA',
  price_sar numeric NOT NULL CHECK (price_sar > 0),
  price_min_sar numeric,
  price_max_sar numeric,
  source text NOT NULL DEFAULT 'ai-gateway',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  ttl_minutes integer NOT NULL DEFAULT 1440,
  UNIQUE (category, title_key, country)
);
CREATE INDEX IF NOT EXISTS idx_mpc_lookup ON public.market_price_cache (category, title_key, country);

GRANT SELECT ON public.market_price_cache TO authenticated, anon;
GRANT ALL ON public.market_price_cache TO service_role;

ALTER TABLE public.market_price_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read cached market prices" ON public.market_price_cache
  FOR SELECT USING (true);
