
-- 1) Audit log table (append-only)
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users can read entries where they are the actor; admins can read all
CREATE POLICY audit_log_self_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can append their own actions
CREATE POLICY audit_log_self_insert ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

-- Prevent ANY update or delete (append-only) — no UPDATE/DELETE policies created.

CREATE INDEX audit_log_actor_idx ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX audit_log_entity_idx ON public.audit_log(entity_type, entity_id);

-- 2) Reserve snapshots table (Proof of Reserve)
CREATE TABLE public.reserve_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_di_outstanding numeric NOT NULL DEFAULT 0,
  reserve_sar numeric NOT NULL DEFAULT 0,
  reserve_ratio numeric GENERATED ALWAYS AS (
    CASE WHEN total_di_outstanding > 0
      THEN ROUND((reserve_sar / (total_di_outstanding * 5))::numeric, 4)
      ELSE 1
    END
  ) STORED,
  note text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.reserve_snapshots TO anon, authenticated;
GRANT ALL ON public.reserve_snapshots TO service_role;

ALTER TABLE public.reserve_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserve_public_read ON public.reserve_snapshots
  FOR SELECT TO public USING (true);

CREATE POLICY reserve_admin_write ON public.reserve_snapshots
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed an initial snapshot so the public page renders
INSERT INTO public.reserve_snapshots (total_di_outstanding, reserve_sar, note)
VALUES (0, 0, 'تأسيس المنصة — لا يوجد DI مُصدَر بعد.');
