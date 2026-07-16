-- =============================================================================
-- EL ESCUDO — OMNI idempotencia real mediante claim atómico (030)
-- =============================================================================
-- Garantiza que confirmar una propuesta OMNI sea realmente idempotente entre
-- procesos e instancias de Render. El claim pasa de pending -> processing de
-- forma atómica con UPDATE ... WHERE status = 'pending'. Solo la sesión que
-- obtiene el claim ejecuta los efectos; las demás observan el estado final.
-- =============================================================================

-- Añadir timestamp de claim para auditoría
ALTER TABLE public.omni_proposals
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Índice útil para buscar propuestas en procesamiento
CREATE INDEX IF NOT EXISTS idx_omni_proposals_user_processing
  ON public.omni_proposals(user_id, status)
  WHERE status = 'processing';

-- Función RPC atómica: reclama una propuesta pendiente y la pasa a processing.
-- Retorna la fila reclamada; si no retorna filas, otra sesión ya la reclamó
-- o la propuesta no existe / no está disponible.
CREATE OR REPLACE FUNCTION public.claim_omni_proposal(
  proposal_uuid UUID,
  user_uuid UUID
)
RETURNS SETOF public.omni_proposals
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.omni_proposals
  SET status = 'processing',
      claimed_at = NOW()
  WHERE id = proposal_uuid
    AND user_id = user_uuid
    AND status = 'pending'
    AND expires_at > NOW()
  RETURNING *;
$$;

-- =============================================================================
-- FIN DE 030_omni_idempotency.sql
-- =============================================================================
