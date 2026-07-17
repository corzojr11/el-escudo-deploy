-- =============================================================================
-- EL ESCUDO — Fase 3: metas, hábitos y salud confiables
-- =============================================================================
-- 1. metrics: fecha explícita e idempotencia para progreso de metas.
-- 2. weight_logs: fecha explícita e idempotencia para registros de peso.
-- 3. habit_completions: tabla normalizada para toggles atómicos de hábitos.
-- 4. Migración idempotente de datos existentes.
-- =============================================================================

-- ─── 1. metrics: fecha explícita e idempotencia ─────────────────────────────
ALTER TABLE public.metrics
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Backfill date desde recorded_at (o created_at como fallback)
DO $$
DECLARE
    v_sql TEXT;
BEGIN
    SELECT format('UPDATE public.metrics SET date = COALESCE(%I::date, CURRENT_DATE) WHERE date IS NULL', column_name)
    INTO v_sql
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'metrics'
      AND column_name IN ('recorded_at', 'created_at')
    ORDER BY CASE column_name WHEN 'recorded_at' THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_sql IS NULL THEN
        v_sql := 'UPDATE public.metrics SET date = CURRENT_DATE WHERE date IS NULL';
    END IF;

    EXECUTE v_sql;
END $$;

CREATE INDEX IF NOT EXISTS idx_metrics_goal_date ON public.metrics(goal_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_user_idempotency ON public.metrics(user_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_metrics_user_idempotency_unique
  ON public.metrics(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── 2. weight_logs: fecha explícita e idempotencia ───────────────────────
ALTER TABLE public.weight_logs
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
DECLARE
    v_sql TEXT;
BEGIN
    SELECT format('UPDATE public.weight_logs SET date = COALESCE(%I::date, CURRENT_DATE) WHERE date IS NULL', column_name)
    INTO v_sql
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'weight_logs'
      AND column_name IN ('timestamp', 'created_at')
    ORDER BY CASE column_name WHEN 'timestamp' THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_sql IS NULL THEN
        v_sql := 'UPDATE public.weight_logs SET date = CURRENT_DATE WHERE date IS NULL';
    END IF;

    EXECUTE v_sql;
END $$;

CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON public.weight_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_idempotency ON public.weight_logs(user_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weight_logs_user_idempotency_unique
  ON public.weight_logs(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── 3. habit_completions: toggles atómicos ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habit_completions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id    UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(habit_id, date)
);

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_habit_completions_select ON public.habit_completions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_habit_completions_insert ON public.habit_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY p_habit_completions_delete ON public.habit_completions
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date ON public.habit_completions(habit_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_date ON public.habit_completions(user_id, date DESC);

-- Migrar completed_dates existentes a habit_completions (idempotente)
DO $$
DECLARE
    rec RECORD;
    d DATE;
BEGIN
    FOR rec IN
        SELECT id, user_id, unnest(completed_dates) AS completed_date
        FROM public.habits
        WHERE completed_dates IS NOT NULL AND array_length(completed_dates, 1) > 0
    LOOP
        BEGIN
            d := rec.completed_date::DATE;
            INSERT INTO public.habit_completions (habit_id, user_id, date)
            VALUES (rec.id, rec.user_id, d)
            ON CONFLICT (habit_id, date) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar fechas inválidas; no bloquear la migración
            NULL;
        END;
    END LOOP;
END $$;

-- =============================================================================
-- FIN DE 032_fase3_progress_health.sql
-- =============================================================================
