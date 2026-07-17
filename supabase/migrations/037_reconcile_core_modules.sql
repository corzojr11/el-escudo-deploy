-- =============================================================================
-- EL ESCUDO — 037: conciliacion de esquema para Salud, Logros y Turnos
-- =============================================================================
-- Idempotente y no destructiva: crea solo lo que falta, nunca borra.
-- Ejecutar en Supabase SQL Editor. Puede ejecutarse multiples veces.
-- =============================================================================

-- ─── 1. shifts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shifts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day             TEXT NOT NULL,
  start           TEXT NOT NULL,
  end             TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  idempotency_key TEXT,
  day_index       SMALLINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='shifts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shifts' AND column_name='is_active') THEN
      ALTER TABLE public.shifts ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shifts' AND column_name='idempotency_key') THEN
      ALTER TABLE public.shifts ADD COLUMN idempotency_key TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shifts' AND column_name='day_index') THEN
      ALTER TABLE public.shifts ADD COLUMN day_index SMALLINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shifts' AND column_name='updated_at') THEN
      ALTER TABLE public.shifts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Unique constraint requerida por upsert on_conflict='user_id,day,start,end'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.conname = 'shifts_user_day_start_end_unique'
  ) THEN
    ALTER TABLE public.shifts ADD CONSTRAINT shifts_user_day_start_end_unique UNIQUE (user_id, day, start, end);
  END IF;
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

ALTER TABLE IF EXISTS public.shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shifts' AND policyname='p_shifts_select') THEN
    CREATE POLICY p_shifts_select ON public.shifts FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shifts' AND policyname='p_shifts_insert') THEN
    CREATE POLICY p_shifts_insert ON public.shifts FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shifts' AND policyname='p_shifts_update') THEN
    CREATE POLICY p_shifts_update ON public.shifts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shifts' AND policyname='p_shifts_delete') THEN
    CREATE POLICY p_shifts_delete ON public.shifts FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shifts_user ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_day ON public.shifts(user_id, day);
CREATE INDEX IF NOT EXISTS idx_shifts_user_active ON public.shifts(user_id, is_active);

-- ─── 2. user_bio_settings ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_bio_settings (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  chronotype        TEXT NOT NULL DEFAULT 'intermedio',
  t_wake_target     TEXT NOT NULL DEFAULT '06:00',
  t_sleep_target    TEXT NOT NULL DEFAULT '22:30',
  cycle_duration    INTEGER NOT NULL DEFAULT 90,
  sleep_debt_hours  NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  t_last_meal       TEXT DEFAULT '20:00',
  t_last_caffeine   TEXT DEFAULT '16:00',
  sunlight_offset   INTEGER DEFAULT 30,
  commute_minutes   SMALLINT DEFAULT 35,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_bio_settings') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_bio_settings' AND column_name='commute_minutes') THEN
      ALTER TABLE public.user_bio_settings ADD COLUMN commute_minutes SMALLINT DEFAULT 35;
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.user_bio_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_bio_settings' AND policyname='p_bio_select') THEN
    CREATE POLICY p_bio_select ON public.user_bio_settings FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_bio_settings' AND policyname='p_bio_insert') THEN
    CREATE POLICY p_bio_insert ON public.user_bio_settings FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_bio_settings' AND policyname='p_bio_update') THEN
    CREATE POLICY p_bio_update ON public.user_bio_settings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bio_settings_user ON public.user_bio_settings(user_id);

-- ─── 3. sleep_logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  bed_time        TEXT NOT NULL,
  wake_time       TEXT NOT NULL,
  cycles          SMALLINT DEFAULT 5,
  quality_score   SMALLINT DEFAULT 3,
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.sleep_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sleep_logs' AND policyname='p_sleep_select') THEN
    CREATE POLICY p_sleep_select ON public.sleep_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sleep_logs' AND policyname='p_sleep_insert') THEN
    CREATE POLICY p_sleep_insert ON public.sleep_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sleep_logs' AND policyname='p_sleep_update') THEN
    CREATE POLICY p_sleep_update ON public.sleep_logs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sleep_logs' AND policyname='p_sleep_delete') THEN
    CREATE POLICY p_sleep_delete ON public.sleep_logs FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sleep_logs_user ON public.sleep_logs(user_id, date DESC);

-- ─── 4. weight_logs ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weight_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight          NUMERIC(6,2) NOT NULL,
  date            DATE,
  notes           TEXT DEFAULT '',
  timestamp       TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='weight_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='weight_logs' AND column_name='date') THEN
      ALTER TABLE public.weight_logs ADD COLUMN date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='weight_logs' AND column_name='timestamp') THEN
      ALTER TABLE public.weight_logs ADD COLUMN timestamp TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='weight_logs' AND column_name='notes') THEN
      ALTER TABLE public.weight_logs ADD COLUMN notes TEXT DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='weight_logs' AND column_name='idempotency_key') THEN
      ALTER TABLE public.weight_logs ADD COLUMN idempotency_key TEXT;
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.weight_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weight_logs' AND policyname='p_weight_select') THEN
    CREATE POLICY p_weight_select ON public.weight_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weight_logs' AND policyname='p_weight_insert') THEN
    CREATE POLICY p_weight_insert ON public.weight_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weight_logs' AND policyname='p_weight_update') THEN
    CREATE POLICY p_weight_update ON public.weight_logs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='weight_logs' AND policyname='p_weight_delete') THEN
    CREATE POLICY p_weight_delete ON public.weight_logs FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_weight_logs_user ON public.weight_logs(user_id, date DESC);

-- ─── 5. focus_status ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.focus_status (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  focus_streak     INTEGER NOT NULL DEFAULT 0,
  focus_best       INTEGER NOT NULL DEFAULT 0,
  urge_count       INTEGER NOT NULL DEFAULT 0,
  last_check_date  DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.focus_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='focus_status' AND policyname='p_focus_select') THEN
    CREATE POLICY p_focus_select ON public.focus_status FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='focus_status' AND policyname='p_focus_insert') THEN
    CREATE POLICY p_focus_insert ON public.focus_status FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='focus_status' AND policyname='p_focus_update') THEN
    CREATE POLICY p_focus_update ON public.focus_status FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_focus_status_user ON public.focus_status(user_id);

-- ─── 6. exercises_logs ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exercises_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name   TEXT NOT NULL,
  weight          NUMERIC(6,2) DEFAULT 0,
  reps            INTEGER DEFAULT 0,
  sets            INTEGER DEFAULT 0,
  rpe             INTEGER DEFAULT 8,
  date            DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.exercises_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercises_logs' AND policyname='p_exercises_select') THEN
    CREATE POLICY p_exercises_select ON public.exercises_logs FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exercises_logs' AND policyname='p_exercises_insert') THEN
    CREATE POLICY p_exercises_insert ON public.exercises_logs FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercises_logs_user ON public.exercises_logs(user_id);

-- ─── 7. personal_records ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.personal_records (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_name   TEXT NOT NULL,
  max_weight      NUMERIC(6,2) NOT NULL DEFAULT 0,
  date            DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.personal_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_records' AND policyname='p_pr_select') THEN
    CREATE POLICY p_pr_select ON public.personal_records FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_records' AND policyname='p_pr_insert') THEN
    CREATE POLICY p_pr_insert ON public.personal_records FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='personal_records' AND policyname='p_pr_update') THEN
    CREATE POLICY p_pr_update ON public.personal_records FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_personal_records_user ON public.personal_records(user_id);

-- ─── 8. achievements ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.achievements (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='achievements' AND policyname='p_ach_select') THEN
    CREATE POLICY p_ach_select ON public.achievements FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='achievements' AND policyname='p_ach_insert') THEN
    CREATE POLICY p_ach_insert ON public.achievements FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_achievements_user ON public.achievements(user_id);

-- ─── 9. routines ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.routines (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_index         SMALLINT NOT NULL,
  day_name          TEXT NOT NULL,
  exercises         JSONB NOT NULL DEFAULT '[]'::jsonb,
  objective         TEXT,
  estimated_minutes INTEGER,
  notes             TEXT[] DEFAULT '{}',
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT routines_user_day_unique UNIQUE (user_id, day_index)
);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='routines') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='routines' AND column_name='objective') THEN
      ALTER TABLE public.routines ADD COLUMN objective TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='routines' AND column_name='estimated_minutes') THEN
      ALTER TABLE public.routines ADD COLUMN estimated_minutes INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='routines' AND column_name='notes') THEN
      ALTER TABLE public.routines ADD COLUMN notes TEXT[] DEFAULT '{}';
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.routines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routines' AND policyname='p_routines_select') THEN
    CREATE POLICY p_routines_select ON public.routines FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routines' AND policyname='p_routines_insert') THEN
    CREATE POLICY p_routines_insert ON public.routines FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routines' AND policyname='p_routines_update') THEN
    CREATE POLICY p_routines_update ON public.routines FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routines' AND policyname='p_routines_delete') THEN
    CREATE POLICY p_routines_delete ON public.routines FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_routines_user_day ON public.routines(user_id, day_index);

-- ─── 10. routine_completions ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.routine_completions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_index       SMALLINT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  completed_date  DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day_index, completed_date)
);

ALTER TABLE IF EXISTS public.routine_completions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routine_completions' AND policyname='p_rc_select') THEN
    CREATE POLICY p_rc_select ON public.routine_completions FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routine_completions' AND policyname='p_rc_insert') THEN
    CREATE POLICY p_rc_insert ON public.routine_completions FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='routine_completions' AND policyname='p_rc_delete') THEN
    CREATE POLICY p_rc_delete ON public.routine_completions FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- ─── 11. profiles — columnas faltantes ─────────────────────────────────────

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='name') THEN
      ALTER TABLE public.profiles ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email') THEN
      ALTER TABLE public.profiles ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='xp') THEN
      ALTER TABLE public.profiles ADD COLUMN xp INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='level') THEN
      ALTER TABLE public.profiles ADD COLUMN level INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='xp_to_next_level') THEN
      ALTER TABLE public.profiles ADD COLUMN xp_to_next_level INTEGER DEFAULT 100;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='streak') THEN
      ALTER TABLE public.profiles ADD COLUMN streak INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='birth_date') THEN
      ALTER TABLE public.profiles ADD COLUMN birth_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='height_cm') THEN
      ALTER TABLE public.profiles ADD COLUMN height_cm SMALLINT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='health_goal') THEN
      ALTER TABLE public.profiles ADD COLUMN health_goal TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='onboarding_completed_at') THEN
      ALTER TABLE public.profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='equipment') THEN
      ALTER TABLE public.profiles ADD COLUMN equipment TEXT[] DEFAULT '{}'::TEXT[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='monthly_budget') THEN
      ALTER TABLE public.profiles ADD COLUMN monthly_budget NUMERIC(12,2);
    END IF;
  END IF;
END $$;

-- =============================================================================
-- FIN DE 037_reconcile_core_modules.sql
-- =============================================================================
