
-- Rate limits
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_hash text,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_rate_limits_lookup ON public.rate_limits(user_id, action, window_start DESC);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service only" ON public.rate_limits FOR ALL USING (false);

-- Error logs
CREATE TABLE public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  route text,
  fn_name text,
  message text NOT NULL,
  stack text,
  context jsonb,
  severity text NOT NULL DEFAULT 'error',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_error_logs_created ON public.error_logs(created_at DESC);
GRANT ALL ON public.error_logs TO service_role;
GRANT SELECT ON public.error_logs TO authenticated;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read errors" ON public.error_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Escrow holds
CREATE TABLE public.escrow_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL,
  payee_id uuid NOT NULL,
  amount_sar numeric NOT NULL CHECK (amount_sar >= 0),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded','disputed')),
  held_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  note text
);
CREATE UNIQUE INDEX uniq_escrow_offer ON public.escrow_holds(offer_id);
GRANT SELECT ON public.escrow_holds TO authenticated;
GRANT ALL ON public.escrow_holds TO service_role;
ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read escrow" ON public.escrow_holds FOR SELECT TO authenticated
  USING (payer_id = auth.uid() OR payee_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Economic indicators (CPI)
CREATE TABLE public.economic_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  indicator text NOT NULL,
  value numeric NOT NULL,
  period date NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_indicator ON public.economic_indicators(country_code, indicator, period);
GRANT SELECT ON public.economic_indicators TO anon, authenticated;
GRANT ALL ON public.economic_indicators TO service_role;
ALTER TABLE public.economic_indicators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read indicators" ON public.economic_indicators FOR SELECT USING (true);

-- Seed initial SA CPI baseline
INSERT INTO public.economic_indicators(country_code, indicator, value, period, source) VALUES
  ('SA', 'CPI', 1.000, '2025-01-01', 'baseline'),
  ('SA', 'CPI', 1.022, '2026-01-01', 'estimate'),
  ('SA', 'CPI', 1.034, '2026-06-01', 'estimate');

-- Escrow trigger: hold on accept, release on complete, refund on cancel/reject
CREATE OR REPLACE FUNCTION public.manage_escrow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND COALESCE(NEW.cash_balance,0) > 0 THEN
    INSERT INTO public.escrow_holds(offer_id, payer_id, payee_id, amount_sar, note)
    VALUES (NEW.id, NEW.from_user, NEW.to_user, NEW.cash_balance, 'حُجز عند القبول')
    ON CONFLICT (offer_id) DO NOTHING;
  ELSIF NEW.status = 'completed' AND OLD.status = 'accepted' THEN
    UPDATE public.escrow_holds
      SET status = 'released', released_at = now(), note = 'حُرّر بإتمام الصفقة'
      WHERE offer_id = NEW.id AND status = 'held';
  ELSIF NEW.status IN ('cancelled','rejected') THEN
    UPDATE public.escrow_holds
      SET status = 'refunded', released_at = now(), note = 'استُرد بإلغاء/رفض الصفقة'
      WHERE offer_id = NEW.id AND status = 'held';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_manage_escrow ON public.trade_offers;
CREATE TRIGGER trg_manage_escrow
AFTER UPDATE OF status ON public.trade_offers
FOR EACH ROW EXECUTE FUNCTION public.manage_escrow();
