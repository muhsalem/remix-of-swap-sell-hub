
CREATE TABLE IF NOT EXISTS public.profiles_private (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone TEXT,
  whatsapp TEXT,
  company_kyc_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles_private TO authenticated;
GRANT ALL ON public.profiles_private TO service_role;

ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_private_select" ON public.profiles_private;
CREATE POLICY "own_private_select" ON public.profiles_private
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "own_private_upsert" ON public.profiles_private;
CREATE POLICY "own_private_upsert" ON public.profiles_private
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_private_update" ON public.profiles_private;
CREATE POLICY "own_private_update" ON public.profiles_private
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER profiles_private_touch
  BEFORE UPDATE ON public.profiles_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill from existing profiles data (contact_phone, whatsapp) if present.
INSERT INTO public.profiles_private (user_id, contact_phone, whatsapp)
SELECT id, contact_phone, whatsapp
FROM public.profiles
WHERE contact_phone IS NOT NULL OR whatsapp IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
