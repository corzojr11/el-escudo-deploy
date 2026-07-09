-- =============================================================================
-- EL ESCUDO — OMNI Recipes Schema v8
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.omni_recipes (
  id              BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT            NOT NULL,
  command_sequence TEXT           NOT NULL,
  description     TEXT            NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.omni_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_omni_recipes_select ON public.omni_recipes FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_omni_recipes_insert ON public.omni_recipes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_omni_recipes_delete ON public.omni_recipes FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_omni_recipes_user ON public.omni_recipes(user_id);
