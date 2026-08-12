CREATE TABLE IF NOT EXISTS public.listing_image_hashes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  phash text not null check (phash ~ '^[0-9a-f]{16}$'),
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS listing_image_hashes_phash_idx ON public.listing_image_hashes (phash);
CREATE INDEX IF NOT EXISTS listing_image_hashes_owner_idx ON public.listing_image_hashes (owner_id);
CREATE INDEX IF NOT EXISTS listing_image_hashes_created_idx ON public.listing_image_hashes (created_at DESC);
GRANT SELECT ON public.listing_image_hashes TO authenticated;
GRANT ALL ON public.listing_image_hashes TO service_role;
ALTER TABLE public.listing_image_hashes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own image hashes" ON public.listing_image_hashes;
CREATE POLICY "own image hashes" ON public.listing_image_hashes FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  kind text not null,
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS fraud_signals_user_idx ON public.fraud_signals (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_signals_kind_idx ON public.fraud_signals (kind, created_at DESC);
GRANT SELECT ON public.fraud_signals TO authenticated;
GRANT ALL ON public.fraud_signals TO service_role;
ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read fraud signals" ON public.fraud_signals;
CREATE POLICY "admins read fraud signals" ON public.fraud_signals FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));