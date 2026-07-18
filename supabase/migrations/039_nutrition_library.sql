-- =============================================================================
-- EL ESCUDO - biblioteca personal de alimentacion (039)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.nutrition_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  recipe JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_favorites_user_created
  ON public.nutrition_favorites (user_id, created_at DESC);

ALTER TABLE public.nutrition_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'nutrition_favorites'
      AND policyname = 'nutrition_favorites_owner'
  ) THEN
    CREATE POLICY nutrition_favorites_owner ON public.nutrition_favorites
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.nutrition_weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT nutrition_weekly_plans_user_week_unique UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_nutrition_weekly_plans_user_week
  ON public.nutrition_weekly_plans (user_id, week_start DESC);

ALTER TABLE public.nutrition_weekly_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'nutrition_weekly_plans'
      AND policyname = 'nutrition_weekly_plans_owner'
  ) THEN
    CREATE POLICY nutrition_weekly_plans_owner ON public.nutrition_weekly_plans
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
