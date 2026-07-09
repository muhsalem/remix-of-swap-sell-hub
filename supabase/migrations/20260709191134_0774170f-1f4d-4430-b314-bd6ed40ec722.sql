
ALTER TABLE public.trade_offers
  ADD COLUMN IF NOT EXISTS shipment_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS from_city text,
  ADD COLUMN IF NOT EXISTS to_city text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS shipping_provider text,
  ADD COLUMN IF NOT EXISTS shipping_cost_sar numeric,
  ADD COLUMN IF NOT EXISTS shipment_booked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
  status text NOT NULL,
  description text,
  location text,
  event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipment_events_offer_idx ON public.shipment_events(offer_id, event_at);

GRANT SELECT ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipment_events TO service_role;

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can read shipment events"
  ON public.shipment_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_offers o
      WHERE o.id = shipment_events.offer_id
        AND (o.from_user = auth.uid() OR o.to_user = auth.uid())
    )
  );
