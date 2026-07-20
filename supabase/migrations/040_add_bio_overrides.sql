-- EL ESCUDO - Añadir estado de hoy (descanso manual, viaje) e override de fecha
ALTER TABLE public.user_bio_settings
  ADD COLUMN IF NOT EXISTS today_override_status TEXT DEFAULT 'normal' CHECK (today_override_status IN ('normal', 'rest', 'travel')),
  ADD COLUMN IF NOT EXISTS today_override_date DATE;
