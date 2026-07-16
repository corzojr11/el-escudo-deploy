-- =============================================================================
-- EL ESCUDO — routines: columnas faltantes del backend (027)
-- =============================================================================
-- backend/routers/routines.py escribe objective, estimated_minutes y notes.
-- Esta migración es idempotente: si public.routines no existe, la crea completa
-- con RLS, políticas, índice y trigger; si existe, añade solo columnas faltantes.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'routines'
  ) THEN
    CREATE TABLE public.routines (
      id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id           UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      day_index         SMALLINT     NOT NULL,
      day_name          TEXT         NOT NULL,
      exercises         JSONB        NOT NULL DEFAULT '[]'::jsonb,
      objective         TEXT,
      estimated_minutes INTEGER      CHECK (estimated_minutes BETWEEN 5 AND 240),
      notes             TEXT[]       DEFAULT '{}',
      completed_at      TIMESTAMPTZ  NULL,
      created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      CONSTRAINT routines_user_day_unique UNIQUE (user_id, day_index)
    );

    ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

    CREATE POLICY p_routines_select ON public.routines
      FOR SELECT USING (user_id = auth.uid());
    CREATE POLICY p_routines_insert ON public.routines
      FOR INSERT WITH CHECK (user_id = auth.uid());
    CREATE POLICY p_routines_update ON public.routines
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY p_routines_delete ON public.routines
      FOR DELETE USING (user_id = auth.uid());

    CREATE INDEX IF NOT EXISTS idx_routines_user_day ON public.routines(user_id, day_index);

  ELSE
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
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'routines'
  ) THEN
    DROP TRIGGER IF EXISTS trg_routines_updated_at ON public.routines;
    CREATE TRIGGER trg_routines_updated_at
      BEFORE UPDATE ON public.routines
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- =============================================================================
-- FIN DE 027_routines_columns.sql
-- =============================================================================
