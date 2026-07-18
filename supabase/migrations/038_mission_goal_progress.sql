-- =============================================================================
-- EL ESCUDO - Mission-to-goal progress (038)
-- =============================================================================
-- A mission may contribute a confirmed amount to one active goal.
-- The RPC is atomic: completing the same mission again cannot add progress twice.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'missions'
  ) THEN
    RAISE NOTICE '038: public.missions does not exist. Nothing to migrate.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'goal_id'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN goal_id UUID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'progress_increment'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN progress_increment NUMERIC NOT NULL DEFAULT 0 CHECK (progress_increment >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'progress_applied_at'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN progress_applied_at TIMESTAMPTZ;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_missions_user_goal_id ON public.missions(user_id, goal_id);
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'goals'
  ) THEN
    RAISE NOTICE '038: public.goals does not exist. Apply the goals migration before linking missions.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'current_value'
  ) THEN
    ALTER TABLE public.goals ADD COLUMN current_value NUMERIC NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.goals ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'missions'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'goals'
  ) THEN
    RAISE NOTICE '038: missions or goals is missing. The progress function was not created.';
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.apply_mission_goal_progress(
    p_mission_id UUID,
    p_user_id UUID
  )
  RETURNS TABLE(linked_goal_id UUID, new_value NUMERIC, applied_increment NUMERIC)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  DECLARE
    v_goal_id UUID;
    v_increment NUMERIC;
    v_current_value NUMERIC;
  BEGIN
    SELECT goal_id, COALESCE(progress_increment, 0)
    INTO v_goal_id, v_increment
    FROM public.missions
    WHERE id = p_mission_id
      AND user_id = p_user_id
      AND status = 'completed'
      AND progress_applied_at IS NULL
    FOR UPDATE;

    IF NOT FOUND OR v_goal_id IS NULL OR v_increment <= 0 THEN
      RETURN;
    END IF;

    SELECT COALESCE(current_value, 0)
    INTO v_current_value
    FROM public.goals
    WHERE id = v_goal_id AND user_id = p_user_id AND status <> 'archived'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'GOAL_NOT_FOUND';
    END IF;

    UPDATE public.goals
    SET current_value = v_current_value + v_increment
    WHERE id = v_goal_id AND user_id = p_user_id;

    UPDATE public.missions
    SET progress_applied_at = NOW()
    WHERE id = p_mission_id AND user_id = p_user_id AND progress_applied_at IS NULL;

    RETURN QUERY SELECT v_goal_id, v_current_value + v_increment, v_increment;
  END;
  $function$;

  REVOKE ALL ON FUNCTION public.apply_mission_goal_progress(UUID, UUID) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.apply_mission_goal_progress(UUID, UUID) FROM anon;
  REVOKE EXECUTE ON FUNCTION public.apply_mission_goal_progress(UUID, UUID) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.apply_mission_goal_progress(UUID, UUID) TO service_role;
END $$;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END 038_mission_goal_progress.sql
-- =============================================================================
