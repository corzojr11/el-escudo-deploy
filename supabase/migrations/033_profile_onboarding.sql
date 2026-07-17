-- =============================================================================
-- EL ESCUDO — Perfil, onboarding e hidratación (033)
-- =============================================================================
-- Añade birth_date, height_cm, health_goal y onboarding_completed_at a
-- public.profiles. Totalmente idempotente: no rompe si las columnas ya existen.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN birth_date DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'height_cm'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN height_cm SMALLINT CHECK (height_cm BETWEEN 100 AND 250);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'health_goal'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN health_goal TEXT CHECK (health_goal IN ('ganar_musculo', 'perder_grasa', 'energia_bienestar'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- =============================================================================
-- FIN DE 033_profile_onboarding.sql
-- =============================================================================
