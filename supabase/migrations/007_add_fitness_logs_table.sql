-- =============================================================================
-- EL ESCUDO — Fitness Logs Schema v7
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fitness_logs (
  id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE            NOT NULL DEFAULT CURRENT_DATE,
  steps           INTEGER,
  calories_burned NUMERIC(8,2),
  distance_km     NUMERIC(6,2),
  active_minutes  INTEGER,
  source          TEXT            NOT NULL DEFAULT 'manual',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fitness_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_fitness_logs_select ON public.fitness_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_fitness_logs_insert ON public.fitness_logs FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_fitness_logs_delete ON public.fitness_logs FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_fitness_logs_user_date ON public.fitness_logs(user_id, date DESC);
