-- =============================================================================
-- EL ESCUDO — Fase 2: herramientas diarias confiables
-- Añade a finances: fecha explícita y clave de idempotencia.
-- Añade a shifts: índice de día (0=Lunes..6=Domingo) y flag activo.
-- =============================================================================

-- ─── 1. finances: fecha explícita e idempotencia ─────────────────────────────
ALTER TABLE public.finances
  ADD COLUMN IF NOT EXISTS date DATE,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Default today para filas existentes que no tengan fecha.
-- Producción usa `timestamp`; algunos entornos locales usan `created_at`.
-- El bloque detecta la columna disponible y no falla si falta alguna.
DO $$
DECLARE
    v_sql TEXT;
BEGIN
    SELECT format('UPDATE public.finances SET date = COALESCE(%I::date, CURRENT_DATE) WHERE date IS NULL', column_name)
    INTO v_sql
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'finances'
      AND column_name IN ('timestamp', 'created_at')
    ORDER BY CASE column_name WHEN 'timestamp' THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_sql IS NULL THEN
        v_sql := 'UPDATE public.finances SET date = CURRENT_DATE WHERE date IS NULL';
    END IF;

    EXECUTE v_sql;
END $$;

-- Índices para filtros por rango y clave única de idempotencia
CREATE INDEX IF NOT EXISTS idx_finances_user_date ON public.finances(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_finances_idempotency ON public.finances(user_id, idempotency_key);

-- Evitar duplicados exactos por usuario+clave si se envía una key
CREATE UNIQUE INDEX IF NOT EXISTS idx_finances_user_idempotency_unique
  ON public.finances(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ─── 2. shifts: índice de día, flag activo e idempotencia ─────────────────
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS day_index SMALLINT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Evitar duplicados exactos por usuario+clave en turnos
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_user_idempotency_unique
  ON public.shifts(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Función para calcular day_index desde el nombre del día en español
CREATE OR REPLACE FUNCTION public.compute_shift_day_index(p_day TEXT)
RETURNS SMALLINT AS $$
BEGIN
  RETURN CASE lower(p_day)
    WHEN 'lunes'     THEN 0
    WHEN 'martes'    THEN 1
    WHEN 'miercoles' THEN 2
    WHEN 'miércoles' THEN 2
    WHEN 'jueves'    THEN 3
    WHEN 'viernes'   THEN 4
    WHEN 'sabado'    THEN 5
    WHEN 'sábado'    THEN 5
    WHEN 'domingo'   THEN 6
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill: asignar day_index a turnos existentes
UPDATE public.shifts
  SET day_index = public.compute_shift_day_index(day)
  WHERE day_index IS NULL;

-- Trigger para mantener day_index sincronizado con day
CREATE OR REPLACE FUNCTION public.set_shift_day_index()
RETURNS TRIGGER AS $$
BEGIN
  NEW.day_index = public.compute_shift_day_index(NEW.day);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shifts_day_index ON public.shifts;
CREATE TRIGGER trg_shifts_day_index
  BEFORE INSERT OR UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_shift_day_index();

CREATE INDEX IF NOT EXISTS idx_shifts_user_day_index ON public.shifts(user_id, day_index);
CREATE INDEX IF NOT EXISTS idx_shifts_user_active ON public.shifts(user_id, is_active);

-- =============================================================================
-- FIN DE 031_fase2_daily_tools.sql
-- =============================================================================
