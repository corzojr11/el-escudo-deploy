-- =============================================================================
-- EL ESCUDO — Moods Schema v13
-- =============================================================================
-- Registro de estado de ánimo del usuario (escala 1-10).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.moods (
  id            UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood          INT             NOT NULL CHECK (mood BETWEEN 1 AND 10),
  notes         TEXT,
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.moods ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_moods_select ON public.moods
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_moods_insert ON public.moods
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY p_moods_update ON public.moods
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_moods_delete ON public.moods
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_moods_user_created ON public.moods(user_id, created_at DESC);
