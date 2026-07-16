-- =============================================================================
-- EL ESCUDO — routines: columnas faltantes del backend (027)
-- =============================================================================
-- backend/routers/routines.py escribe objective, estimated_minutes y notes.
-- Esta migración añade esas columnas de forma idempotente.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'objective'
  ) THEN
    ALTER TABLE public.routines ADD COLUMN objective TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'estimated_minutes'
  ) THEN
    ALTER TABLE public.routines ADD COLUMN estimated_minutes INTEGER CHECK (estimated_minutes BETWEEN 5 AND 240);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'routines' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.routines ADD COLUMN notes TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Trigger updated_at para routines
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_routines_updated_at ON public.routines;
CREATE TRIGGER trg_routines_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- FIN DE 027_routines_columns.sql
-- =============================================================================
