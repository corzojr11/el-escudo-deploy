-- =============================================================================
-- EL ESCUDO — Bio Settings Schema v2 (Circadian Rhythm)
-- =============================================================================
-- Ejecutar en: Supabase SQL Editor. Requiere 001_core_schema.sql first.
-- =============================================================================

-- ─── 1. Enum ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE bio_chronotype AS ENUM ('madrugador', 'intermedio', 'nocturno');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. user_bio_settings ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_bio_settings (
  id                UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  chronotype        bio_chronotype  NOT NULL DEFAULT 'intermedio',
  t_wake_target     TIME            NOT NULL DEFAULT '06:00',
  t_sleep_target    TIME            NOT NULL DEFAULT '22:30',
  cycle_duration    INTEGER         NOT NULL DEFAULT 90,
  sleep_debt_hours  NUMERIC(5,2)    NOT NULL DEFAULT 0.00,
  t_last_meal       TIME            DEFAULT '20:00',
  t_last_caffeine   TIME            DEFAULT '16:00',
  sunlight_offset   INTEGER         DEFAULT 30,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_bio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_bio_select ON public.user_bio_settings FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_bio_insert ON public.user_bio_settings FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_bio_update ON public.user_bio_settings FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_bio_delete ON public.user_bio_settings FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_bio_settings_user ON public.user_bio_settings(user_id);

-- ─── 3. sleep_logs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sleep_logs (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date            DATE        NOT NULL,
  bed_time        TIME        NOT NULL,
  wake_time       TIME        NOT NULL,
  cycles          SMALLINT    DEFAULT 5,
  quality_score   SMALLINT    DEFAULT 3,
  notes           TEXT        DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_sleep_select ON public.sleep_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_sleep_insert ON public.sleep_logs FOR INSERT WITH CHECK    USING (user_id = auth.uid());
CREATE POLICY p_sleep_update ON public.sleep_logs FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_sleep_delete ON public.sleep_logs FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idxs.user_id ON public.sleep_logs(user_id, date DESC);

-- ─── 4. Trigger updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_bio_updated_at ON public.user_bio_settings;
CREATE TRIGGER trg_bio_updated_id_at
  BEFORE UPDATE ON public.user_bio_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- FIN DE 002_bio_settings.sql
-- =============================================================================