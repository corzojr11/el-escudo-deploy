-- =============================================================================
-- EL ESCUDO — Challenges System v15
-- =============================================================================
-- Retos entre usuarios (cooperativos por diseño).
-- =============================================================================

-- ─── Challenge Templates ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.challenge_templates (
  id            UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT            NOT NULL,
  description   TEXT,
  category      TEXT            NOT NULL CHECK (category IN ('habits','weight','exercise','finance','omni')),
  target_value  INTEGER,        -- ej: 7 días, 2000 gramos, 10 sesiones
  target_unit   TEXT,           -- 'days', 'grams', 'sessions', 'uses'
  duration_days INTEGER         DEFAULT 7,
  xp_reward     INTEGER         DEFAULT 100,
  created_at    TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.challenge_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_challenge_templates_select ON public.challenge_templates
  FOR SELECT USING (TRUE);

CREATE POLICY p_challenge_templates_insert ON public.challenge_templates
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY p_challenge_templates_update ON public.challenge_templates
  FOR UPDATE USING (TRUE);

CREATE POLICY p_challenge_templates_delete ON public.challenge_templates
  FOR DELETE USING (TRUE);

-- ─── Challenges (activos) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.challenges (
  id                    UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id           UUID            REFERENCES public.challenge_templates(id),
  challenger_player_id  TEXT            NOT NULL REFERENCES public.profiles(player_id),
  challenged_player_id  TEXT            NOT NULL REFERENCES public.profiles(player_id),
  status                TEXT            NOT NULL DEFAULT 'pending'
                                            CHECK (status IN ('pending','accepted','rejected','completed','failed','cancelled')),
  winner_player_id      TEXT            REFERENCES public.profiles(player_id),
  started_at            TIMESTAMPTZ,
  ends_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ     DEFAULT NOW(),
  updated_at            TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_challenges_select ON public.challenges
  FOR SELECT USING (
    challenger_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    OR challenged_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_challenges_insert ON public.challenges
  FOR INSERT WITH CHECK (
    challenger_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_challenges_update ON public.challenges
  FOR UPDATE USING (
    challenger_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    OR challenged_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_challenges_delete ON public.challenges
  FOR DELETE USING (
    challenger_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON public.challenges(challenger_player_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON public.challenges(challenged_player_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON public.challenges(status);

-- ─── Challenge Progress ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.challenge_progress (
  id            UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id  UUID            NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  player_id     TEXT            NOT NULL REFERENCES public.profiles(player_id),
  current_value INTEGER         DEFAULT 0,
  completed     BOOLEAN         DEFAULT FALSE,
  updated_at    TIMESTAMPTZ     DEFAULT NOW(),
  UNIQUE(challenge_id, player_id)
);

ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_challenge_progress_select ON public.challenge_progress
  FOR SELECT USING (
    player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    OR challenge_id IN (
      SELECT id FROM public.challenges
      WHERE challenger_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
         OR challenged_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY p_challenge_progress_insert ON public.challenge_progress
  FOR INSERT WITH CHECK (
    player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_challenge_progress_update ON public.challenge_progress
  FOR UPDATE USING (
    player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_challenge_progress_challenge ON public.challenge_progress(challenge_id);

-- ─── Seed Templates ───────────────────────────────────────────────────────

INSERT INTO public.challenge_templates (name, description, category, target_value, target_unit, duration_days, xp_reward) VALUES
  ('Racha de Hábitos', 'Mantén tu racha de hábitos por 7 días consecutivos', 'habits', 7, 'days', 7, 150),
  ('Bajar de Peso', 'Pierde 2kg en 30 días', 'weight', 2000, 'grams', 30, 300),
  ('Sesiones de Ejercicio', 'Completa 10 sesiones de ejercicio en 2 semanas', 'exercise', 10, 'sessions', 14, 200),
  ('Control de Gastos', 'Registra todos tus gastos durante 7 días con OMNI', 'finance', 7, 'days', 7, 100),
  ('Maestro OMNI', 'Usa OMNI 20 veces en una semana', 'omni', 20, 'uses', 7, 150)
ON CONFLICT DO NOTHING;
