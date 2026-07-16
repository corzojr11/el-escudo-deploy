-- =============================================================================
-- EL ESCUDO — Deprecación del flujo inseguro de recuperación de contraseña (024)
-- =============================================================================
-- El flujo legacy de códigos numéricos expuestos ya no se usa. El producto
-- ahora se apoya en Supabase Auth (resetPasswordForEmail / magic link).
-- Esta migración desactiva de forma segura la tabla legacy:
--   1. Revoca políticas RLS permisivas (USING TRUE).
--   2. Trunca códigos temporales viejos.
--   3. Elimina la tabla para evitar filtraciones futuras.
-- =============================================================================

DO $$
BEGIN
  -- Eliminar políticas permisivas si existen
  DROP POLICY IF EXISTS p_password_reset_select ON public.password_reset_codes;
  DROP POLICY IF EXISTS p_password_reset_insert ON public.password_reset_codes;
  DROP POLICY IF EXISTS p_password_reset_update ON public.password_reset_codes;

  -- Truncar datos sensibles temporales antes de eliminar la tabla
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'password_reset_codes'
  ) THEN
    EXECUTE 'TRUNCATE TABLE public.password_reset_codes RESTART IDENTITY';
  END IF;
END $$;

-- Finalmente eliminar la tabla
DROP TABLE IF EXISTS public.password_reset_codes;

-- =============================================================================
-- FIN DE 024_password_reset_deprecation.sql
-- =============================================================================
