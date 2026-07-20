-- EL ESCUDO - Añadir tipo de día en el horario semanal (trabajo, descanso, viaje)
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'work' CHECK (type IN ('work', 'rest', 'travel'));
