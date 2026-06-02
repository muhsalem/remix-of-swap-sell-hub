-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  trades_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============= LISTINGS =============
CREATE TYPE public.listing_condition AS ENUM ('new','like-new','excellent','good','fair');
CREATE TYPE public.listing_status AS ENUM ('active','pending','traded','closed');

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT CHECK (char_length(description) <= 2000),
  category TEXT NOT NULL,
  condition public.listing_condition NOT NULL,
  age_months INTEGER NOT NULL DEFAULT 0 CHECK (age_months >= 0 AND age_months <= 360),
  market_price NUMERIC(12,2) NOT NULL CHECK (market_price > 0),
  wants TEXT NOT NULL CHECK (char_length(wants) BETWEEN 2 AND 200),
  images TEXT[] NOT NULL DEFAULT '{}',
  status public.listing_status NOT NULL DEFAULT 'active',
  -- shariah riba warning flag (ribawi items: gold/silver/dates/wheat/barley/salt)
  is_ribawi BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX listings_status_idx ON public.listings(status, created_at DESC);
CREATE INDEX listings_owner_idx ON public.listings(owner_id);
CREATE INDEX listings_category_idx ON public.listings(category);

GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings_public_read" ON public.listings FOR SELECT USING (true);
CREATE POLICY "listings_owner_insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "listings_owner_update" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "listings_owner_delete" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- ============= TRADE OFFERS =============
CREATE TYPE public.offer_status AS ENUM ('pending','accepted','rejected','cancelled','completed');

CREATE TABLE public.trade_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offered_listing UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  requested_listing UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  fairness_score INTEGER,
  cash_balance NUMERIC(12,2) DEFAULT 0,
  message TEXT CHECK (char_length(message) <= 1000),
  status public.offer_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX offers_to_user_idx ON public.trade_offers(to_user, status);
CREATE INDEX offers_from_user_idx ON public.trade_offers(from_user, status);

GRANT SELECT, INSERT, UPDATE ON public.trade_offers TO authenticated;
GRANT ALL ON public.trade_offers TO service_role;

ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offers_party_read" ON public.trade_offers FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "offers_from_insert" ON public.trade_offers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user);
CREATE POLICY "offers_party_update" ON public.trade_offers FOR UPDATE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- ============= TIMESTAMP TRIGGER =============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER listings_touch BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER offers_touch BEFORE UPDATE ON public.trade_offers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============= AUTO-CREATE PROFILE =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();