ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS day TEXT;

COMMENT ON COLUMN public.shifts.day IS 'Día de la semana del turno (ej. "Lunes", "Martes"). Usado por el optimizador de sueño y estado de turno.';
