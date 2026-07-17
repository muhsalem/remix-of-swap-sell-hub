
CREATE TABLE public.waitlist_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  role TEXT,
  city TEXT,
  interest TEXT,
  referral_code TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  landing_path TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  invited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_signups TO authenticated;
GRANT INSERT ON public.waitlist_signups TO anon;
GRANT ALL ON public.waitlist_signups TO service_role;

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can insert their own signup
CREATE POLICY "waitlist_public_insert" ON public.waitlist_signups
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read the list
CREATE POLICY "waitlist_admin_select" ON public.waitlist_signups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update (mark invited)
CREATE POLICY "waitlist_admin_update" ON public.waitlist_signups
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER waitlist_touch_updated_at
  BEFORE UPDATE ON public.waitlist_signups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX waitlist_signups_created_at_idx ON public.waitlist_signups(created_at DESC);
CREATE INDEX waitlist_signups_utm_campaign_idx ON public.waitlist_signups(utm_campaign);
CREATE INDEX waitlist_signups_country_idx ON public.waitlist_signups(country);
