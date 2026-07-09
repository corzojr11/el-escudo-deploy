-- =============================================================================
-- EL ESCUDO — Leaderboard / Player ID v14
-- =============================================================================
-- Añade player_id a profiles para exponer en rankings sin revelar user_id UUID.
-- =============================================================================

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS player_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

UPDATE public.profiles SET player_id = gen_random_uuid()::TEXT WHERE player_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_xp_desc ON public.profiles(xp DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_level_xp ON public.profiles(level DESC, xp DESC);
