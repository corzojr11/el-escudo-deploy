-- =============================================================================
-- EL ESCUDO — Corrección de SQL inválido en 002_bio_settings.sql (028)
-- =============================================================================
-- La migración 002 contenía dos errores:
--   1. CREATE POLICY p_sleep_insert ... FOR INSERT WITH CHECK USING (...)
--      es sintaxis inválida. Debe ser WITH CHECK (...).
--   2. CREATE INDEX IF NOT EXISTS idxs.user_id ... tiene un punto en el nombre
--      de índice, lo cual es inválido sin comillas dobles.
-- Esta migración corrige ambos problemas de forma idempotente sin reescribir
-- la migración histórica.
-- =============================================================================

-- 1. Recrear la política INSERT de sleep_logs con sintaxis correcta
DROP POLICY IF EXISTS p_sleep_insert ON public.sleep_logs;
CREATE POLICY p_sleep_insert ON public.sleep_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. Eliminar índice con nombre inválido (si existe) y crear el correcto
DO $$
BEGIN
  -- idxs.user_id es un nombre con punto; lo intentamos eliminar si existe.
  -- Postgres lo habría creado solo si la migración fue manualmente editada,
  -- porque la sintaxis original es inválida. Usar IF EXISTS es seguro.
  DROP INDEX IF EXISTS "idxs.user_id";
  DROP INDEX IF EXISTS idx_sleep_logs_user_date;
END $$;

CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date
  ON public.sleep_logs(user_id, date DESC);

-- 3. Renombrar trigger erróneo si existe (trg_bio_updated_id_at → trg_bio_updated_at)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bio_updated_id_at' AND tgrelid = 'public.user_bio_settings'::regclass
  ) THEN
    EXECUTE 'ALTER TRIGGER trg_bio_updated_id_at ON public.user_bio_settings RENAME TO trg_bio_updated_at';
  END IF;
END $$;

-- 4. Asegurar que el trigger correcto exista
DROP TRIGGER IF EXISTS trg_bio_updated_at ON public.user_bio_settings;
CREATE TRIGGER trg_bio_updated_at
  BEFORE UPDATE ON public.user_bio_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- FIN DE 028_bio_settings_fix.sql
-- =============================================================================
