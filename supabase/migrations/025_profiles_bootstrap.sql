-- =============================================================================
-- EL ESCUDO — Perfiles reproducibles y bootstrap confiable (025)
-- =============================================================================
-- 1. Garantiza que `public.profiles` existe con el contrato completo que usa
--    el backend y el frontend.
-- 2. Crea función y trigger en `auth.users` para crear el perfil automáticamente
--    al registrarse un usuario (fallback seguro si Supabase no lo hace).
-- 3. Rellena perfiles faltantes para usuarios ya existentes.
-- 4. Todas las operaciones son idempotentes y no destruyen datos existentes.
-- =============================================================================

-- ─── 1. Crear tabla profiles si no existe ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            TEXT,
  name             TEXT,
  avatar_url       TEXT,
  level            INTEGER NOT NULL DEFAULT 1,
  xp               INTEGER NOT NULL DEFAULT 0,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  player_id        TEXT,
  streak           INTEGER NOT NULL DEFAULT 0,
  title            TEXT,
  ai_cost_cop      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asegurar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Añadir columnas faltantes de forma idempotente (no falla si ya existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'xp_to_next_level'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN xp_to_next_level INTEGER NOT NULL DEFAULT 100;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'streak'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN streak INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'title'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN title TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'ai_cost_cop'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN ai_cost_cop NUMERIC(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- ─── 2. Políticas RLS (idempotentes) ──────────────────────────────────────────
DO $$
BEGIN
  -- Evitar duplicados de políticas si ya existen
  DROP POLICY IF EXISTS p_profiles_select ON public.profiles;
  DROP POLICY IF EXISTS p_profiles_insert ON public.profiles;
  DROP POLICY IF EXISTS p_profiles_update ON public.profiles;
  DROP POLICY IF EXISTS p_profiles_delete ON public.profiles;
END $$;

CREATE POLICY p_profiles_select ON public.profiles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_profiles_update ON public.profiles
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY p_profiles_delete ON public.profiles
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_player_id ON public.profiles(player_id) WHERE player_id IS NOT NULL;

-- ─── 3. Trigger updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. Bootstrap automático desde auth.users ───────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, avatar_url, level, xp, xp_to_next_level, player_id, streak, title, ai_cost_cop)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    1,
    0,
    100,
    NULL,
    0,
    NULL,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- El trigger debe crearse en el schema auth. Usamos seguridad definer para que
-- la función se ejecute con los privilegios del creador (postgres/service-role).
DROP TRIGGER IF EXISTS trg_auth_users_create_profile ON auth.users;
CREATE TRIGGER trg_auth_users_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 5. Backfill para usuarios existentes sin perfil ──────────────────────────
DO $$
BEGIN
  INSERT INTO public.profiles (user_id, email, name, level, xp, xp_to_next_level, player_id, streak, title, ai_cost_cop)
  SELECT
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'name', u.email),
    1,
    0,
    100,
    NULL,
    0,
    NULL,
    0
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE p.user_id IS NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill de profiles omitido: %', SQLERRM;
END $$;

-- =============================================================================
-- FIN DE 025_profiles_bootstrap.sql
-- =============================================================================
