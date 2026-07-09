-- =============================================================================
-- EL ESCUDO — Habits Schema v11
-- =============================================================================
-- Persiste hábitos del usuario con tracking de rachas y fechas completadas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.habits (
  id                UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT            NOT NULL,
  frequency         TEXT            NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  streak            INT             NOT NULL DEFAULT 0,
  completed_dates   TEXT[]          NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_habits_select ON public.habits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_habits_insert ON public.habits
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY p_habits_update ON public.habits
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_habits_delete ON public.habits
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits(user_id);

-- ─── Trigger: updated_at automático ────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_habits_updated_at ON public.habits;
CREATE TRIGGER trg_habits_updated_at
  BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
