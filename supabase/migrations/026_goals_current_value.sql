-- =============================================================================
-- EL ESCUDO — goals.current_value para contrato reproducible (026)
-- =============================================================================
-- El backend (OMNI handlers) y el frontend esperan poder leer/escribir
-- goals.current_value. Esta migración añade la columna de forma idempotente
-- y la sincroniza con la última métrica registrada cuando está vacía.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'current_value'
  ) THEN
    ALTER TABLE public.goals ADD COLUMN current_value NUMERIC;
  END IF;
END $$;

-- Sincronizar current_value con la métrica más reciente del goal
UPDATE public.goals g
SET current_value = sub.latest_value
FROM (
  SELECT goal_id, value AS latest_value
  FROM (
    SELECT goal_id, value,
           ROW_NUMBER() OVER (PARTITION BY goal_id ORDER BY recorded_at DESC, created_at DESC) AS rn
    FROM public.metrics
  ) ranked
  WHERE rn = 1
) sub
WHERE g.id = sub.goal_id
  AND g.current_value IS NULL;

-- =============================================================================
-- FIN DE 026_goals_current_value.sql
-- =============================================================================
