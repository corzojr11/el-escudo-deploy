-- =============================================================================
-- EL ESCUDO — Añade XP y level a profiles v12
-- =============================================================================
-- La tabla profiles (creada por Supabase Auth trigger) necesita columnas
-- de gamificación para persistir experiencia y nivel del jugador.
-- =============================================================================

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS xp     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level  INTEGER NOT NULL DEFAULT 1;
