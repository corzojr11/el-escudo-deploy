-- =============================================================================
-- EL ESCUDO — OMNI propuestas idempotentes y auditoría (029)
-- =============================================================================
-- Almacena propuestas de acción generadas por OMNI antes de ejecutarlas.
-- Permite preview -> confirmar -> ejecutar una sola vez -> auditar.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.omni_proposals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  command       TEXT NOT NULL,
  intent        TEXT NOT NULL,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_text  TEXT NOT NULL,
  actions       JSONB NOT NULL DEFAULT '[]'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending',
  result        JSONB,
  cost_cop      NUMERIC(12,4) DEFAULT 0,
  trm           NUMERIC(12,4) DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes'
);

ALTER TABLE public.omni_proposals ENABLE ROW LEVEL SECURITY;

-- Solo lectura para el propietario; inserción/actualización solo desde backend (service role)
DROP POLICY IF EXISTS p_omni_proposals_select_own ON public.omni_proposals;
DROP POLICY IF EXISTS p_omni_proposals_insert_service ON public.omni_proposals;
DROP POLICY IF EXISTS p_omni_proposals_update_service ON public.omni_proposals;

CREATE POLICY p_omni_proposals_select_own ON public.omni_proposals
  FOR SELECT USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_omni_proposals_user_status ON public.omni_proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_omni_proposals_session ON public.omni_proposals(session_id);
CREATE INDEX IF NOT EXISTS idx_omni_proposals_expires ON public.omni_proposals(expires_at)
  WHERE status = 'pending';

-- =============================================================================
-- FIN DE 029_omni_proposals.sql
-- =============================================================================
