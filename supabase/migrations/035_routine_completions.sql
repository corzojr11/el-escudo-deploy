-- =============================================================================
-- EL ESCUDO — routine_completions: persistencia diaria idempotente (035)
-- =============================================================================
-- Guarda una completitud por usuario, fecha Bogota y day_index de rutina.
-- Idempotente: no duplica registros. Aislada por user_id con RLS.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.routine_completions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_index   SMALLINT NOT NULL CHECK (day_index BETWEEN 0 AND 6),
  completed_date DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day_index, completed_date)
);

ALTER TABLE IF EXISTS public.routine_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_rc_select ON public.routine_completions;
CREATE POLICY p_rc_select ON public.routine_completions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS p_rc_insert ON public.routine_completions;
CREATE POLICY p_rc_insert ON public.routine_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS p_rc_delete ON public.routine_completions;
CREATE POLICY p_rc_delete ON public.routine_completions
  FOR DELETE USING (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_bio_settings') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'equipment'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN equipment TEXT[] DEFAULT '{}'::TEXT[];
    END IF;
  END IF;
END $$;
