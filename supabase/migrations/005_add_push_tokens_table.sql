-- =============================================================================
-- EL ESCUDO — Push Notifications Schema v5
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          BIGINT          GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT            NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_push_tokens_select ON public.push_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY p_push_tokens_insert ON public.push_tokens FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY p_push_tokens_delete ON public.push_tokens FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON public.push_tokens(token);
