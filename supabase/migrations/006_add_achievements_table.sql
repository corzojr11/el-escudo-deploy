-- =============================================================================
-- EL ESCUDO — Achievements Schema v6
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.achievements (
  id          BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT            NOT NULL,
  unlocked_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_achievements_select ON public.achievements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_achievements_insert ON public.achievements FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_achievements_delete ON public.achievements FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievements(user_id);
