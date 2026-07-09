-- =============================================================================
-- EL ESCUDO — OMNI Messages Schema v10
-- =============================================================================
-- Persiste el historial de conversación del asistente OMNI para
-- que los mensajes sobrevivan entre sesiones de la app.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.omni_messages (
  id          UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id  UUID,
  role        TEXT            NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT            NOT NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.omni_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_omni_messages_select ON public.omni_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_omni_messages_insert ON public.omni_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_omni_messages_user_session
  ON public.omni_messages(user_id, session_id, created_at DESC);
