
CREATE TABLE IF NOT EXISTS public.consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  doc_type text NOT NULL,        -- 'terms' | 'privacy' | 'barter' | 'refund' etc.
  doc_version text NOT NULL,     -- e.g. '2026-07-SA'
  context text NOT NULL,         -- 'create_offer' | 'complete_order' | 'signup'
  offer_id uuid REFERENCES public.trade_offers(id) ON DELETE SET NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  user_agent text,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consent_log TO authenticated;
GRANT ALL ON public.consent_log TO service_role;

ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own consents" ON public.consent_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users insert own consents" ON public.consent_log
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND doc_type IN ('terms','privacy','barter','refund','fees','sla','riba')
    AND context IN ('create_offer','complete_order','signup','payment','listing')
    AND country_code IN ('SA','EG')
  );

CREATE INDEX IF NOT EXISTS consent_log_user_idx ON public.consent_log(user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS consent_log_offer_idx ON public.consent_log(offer_id) WHERE offer_id IS NOT NULL;
