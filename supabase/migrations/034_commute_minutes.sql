-- =============================================================================
-- EL ESCUDO — commute_minutes en bio_settings para plan diario (034)
-- =============================================================================
-- Idempotente: no falla si la columna ya existe o la tabla no existe.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_bio_settings'
  ) THEN
    RAISE NOTICE '034_commute_minutes: user_bio_settings no existe. Aplica 002_bio_settings primero.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_bio_settings' AND column_name = 'commute_minutes'
  ) THEN
    ALTER TABLE public.user_bio_settings ADD COLUMN commute_minutes SMALLINT DEFAULT 35 CHECK (commute_minutes >= 0 AND commute_minutes <= 180);
  END IF;
END $$;

-- =============================================================================
-- FIN DE 034_commute_minutes.sql
-- =============================================================================
