-- =============================================================================
-- EL ESCUDO — Core Schema v1 (Generic Goals + Metrics + RLS)
-- =============================================================================
-- Ejecutar en: Supabase SQL Editor
-- Orden recomendado:
--   1. Extensiones (si no existen)
--   2. Enum types
--   3. Tablas con RLS
--   4. Políticas RLS
--   5. Índices
--   6. Triggers (updated_at)
-- =============================================================================

-- ─── 1. Extensiones ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"   WITH SCHEMA extensions;

-- ─── 2. Enum Types ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE goal_type AS ENUM (
    'weight',       -- Pérdida/ganancia de peso (kg)
    'finance_savings',  -- Ahorro financiero ($)
    'finance_debt',     -- Liquidación de deuda ($)
    'fitness',          -- Frecuencia/volumen de entrenamiento
    'habit',            -- Hábito diario/semanal
    'sleep',            -- Horas de sueño
    'nutrition',        -- Plan nutricional
    'custom'            -- Definido por el usuario
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE goal_status AS ENUM (
    'active',
    'completed',
    'archived',
    'paused'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Tablas con RLS ────────────────────────────────────────────────────────

-- ── 3a. profiles (existente, se refuerza con RLS) ─────────────────────────────
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- ── 3b. goals (genérico) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT        DEFAULT '',
  goal_type     goal_type   NOT NULL DEFAULT 'custom',
  status        goal_status NOT NULL DEFAULT 'active',
  target_value  NUMERIC,
  unit          TEXT                   DEFAULT '',       -- 'kg', 'COP', 'hours', 'sessions'
  deadline      DATE,
  priority      SMALLINT    NOT NULL DEFAULT 2,          -- 1 (alta) / 2 (media) / 3 (baja)
  config        JSONB       NOT NULL DEFAULT '{}',       -- { "frequency": "daily", "remind_at": "08:00" }
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- ── 3c. metrics (time-series) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.metrics (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id       UUID         NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value         NUMERIC      NOT NULL,
  unit          TEXT         DEFAULT '',                 -- denormalizado de goals para consultas rápidas
  notes         TEXT         DEFAULT '',
  recorded_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

-- ── 3d. finances (existente) ─────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.finances ENABLE ROW LEVEL SECURITY;

-- ── 3e. missions (existente) ─────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.missions ENABLE ROW LEVEL SECURITY;

-- ── 3f. shifts (existente) ───────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.shifts ENABLE ROW LEVEL SECURITY;

-- ── 3g. weight_logs (existente) ──────────────────────────────────────────────
ALTER TABLE IF EXISTS public.weight_logs ENABLE ROW LEVEL SECURITY;

-- ── 3h. debts (existente) ────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.debts ENABLE ROW LEVEL SECURITY;

-- ── 3i. fixed_expenses (existente) ──────────────────────────────────────────
ALTER TABLE IF EXISTS public.fixed_expenses ENABLE ROW LEVEL SECURITY;

-- ── 3j. exercises_logs (existente) ──────────────────────────────────────────
ALTER TABLE IF EXISTS public.exercises_logs ENABLE ROW LEVEL SECURITY;

-- ── 3k. personal_records (existente) ────────────────────────────────────────
ALTER TABLE IF EXISTS public.personal_records ENABLE ROW LEVEL SECURITY;

-- ─── 4. Políticas RLS ─────────────────────────────────────────────────────────
-- Nota: todas las tablas existentes asumen columna user_id (UUID).
-- Si alguna tabla usa user_id como TEXT, ajustar el tipo en el WHERE.

-- ── 4a. Helper: política genérica de aislamiento por usuario ──────────────────
-- Se aplica a todas las tablas que tienen columna user_id.
-- Patrón único: se crea una política por operación por tabla.

-- ===== profiles ===============================================================
CREATE POLICY p_profiles_select ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_profiles_update ON public.profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_profiles_delete ON public.profiles
  FOR DELETE USING (user_id = auth.uid());

-- ===== goals ==================================================================
CREATE POLICY p_goals_select ON public.goals
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_goals_insert ON public.goals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_goals_update ON public.goals
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_goals_delete ON public.goals
  FOR DELETE USING (user_id = auth.uid());

-- ===== metrics ================================================================
CREATE POLICY p_metrics_select ON public.metrics
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_metrics_insert ON public.metrics
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_metrics_update ON public.metrics
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_metrics_delete ON public.metrics
  FOR DELETE USING (user_id = auth.uid());

-- ===== finances ===============================================================
CREATE POLICY p_finances_select ON public.finances
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_finances_insert ON public.finances
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_finances_update ON public.finances
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_finances_delete ON public.finances
  FOR DELETE USING (user_id = auth.uid());

-- ===== missions ===============================================================
CREATE POLICY p_missions_select ON public.missions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_missions_insert ON public.missions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_missions_update ON public.missions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_missions_delete ON public.missions
  FOR DELETE USING (user_id = auth.uid());

-- ===== shifts =================================================================
CREATE POLICY p_shifts_select ON public.shifts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_shifts_insert ON public.shifts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_shifts_update ON public.shifts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_shifts_delete ON public.shifts
  FOR DELETE USING (user_id = auth.uid());

-- ===== weight_logs ============================================================
CREATE POLICY p_weight_logs_select ON public.weight_logs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_weight_logs_insert ON public.weight_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_weight_logs_update ON public.weight_logs
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_weight_logs_delete ON public.weight_logs
  FOR DELETE USING (user_id = auth.uid());

-- ===== debts ==================================================================
CREATE POLICY p_debts_select ON public.debts
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_debts_insert ON public.debts
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_debts_update ON public.debts
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_debts_delete ON public.debts
  FOR DELETE USING (user_id = auth.uid());

-- ===== fixed_expenses =========================================================
CREATE POLICY p_fixed_expenses_select ON public.fixed_expenses
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_fixed_expenses_insert ON public.fixed_expenses
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_fixed_expenses_update ON public.fixed_expenses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_fixed_expenses_delete ON public.fixed_expenses
  FOR DELETE USING (user_id = auth.uid());

-- ===== exercises_logs =========================================================
CREATE POLICY p_exercises_logs_select ON public.exercises_logs
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_exercises_logs_insert ON public.exercises_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_exercises_logs_update ON public.exercises_logs
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_exercises_logs_delete ON public.exercises_logs
  FOR DELETE USING (user_id = auth.uid());

-- ===== personal_records =======================================================
CREATE POLICY p_personal_records_select ON public.personal_records
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_personal_records_insert ON public.personal_records
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_personal_records_update ON public.personal_records
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_personal_records_delete ON public.personal_records
  FOR DELETE USING (user_id = auth.uid());

-- ─── 5. Índices de Rendimiento ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_goals_user_id      ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_type         ON public.goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_goals_status       ON public.goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_user_type    ON public.goals(user_id, goal_type);

CREATE INDEX IF NOT EXISTS idx_metrics_goal_id    ON public.metrics(goal_id);
CREATE INDEX IF NOT EXISTS idx_metrics_user_id    ON public.metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded   ON public.metrics(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_goal_date  ON public.metrics(goal_id, recorded_at DESC);

-- Índices existentes (reforzar si no existen)
CREATE INDEX IF NOT EXISTS idx_finances_user      ON public.finances(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_user      ON public.missions(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user        ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user   ON public.weight_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_user         ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON public.fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_logs_user ON public.exercises_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_records_user ON public.personal_records(user_id);

-- ─── 6. Trigger: updated_at automático ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_goals_updated_at'
  ) THEN
    CREATE TRIGGER trg_goals_updated_at
      BEFORE UPDATE ON public.goals
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- =============================================================================
-- FIN DE 001_core_schema.sql
-- =============================================================================
