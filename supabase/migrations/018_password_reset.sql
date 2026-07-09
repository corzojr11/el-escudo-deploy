-- =============================================================================
-- EL ESCUDO — Password Reset Codes v18
-- =============================================================================
-- Códigos temporales para restablecer contraseña.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id          UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT            NOT NULL,
  code        TEXT            NOT NULL,
  expires_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
  used        BOOLEAN         DEFAULT FALSE,
  created_at  TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Solo el backend (service role) puede manipular esta tabla
CREATE POLICY p_password_reset_select ON public.password_reset_codes FOR SELECT USING (TRUE);
CREATE POLICY p_password_reset_insert ON public.password_reset_codes FOR INSERT WITH CHECK (TRUE);
CREATE POLICY p_password_reset_update ON public.password_reset_codes FOR UPDATE USING (TRUE);

CREATE INDEX IF NOT EXISTS idx_password_reset_email ON public.password_reset_codes(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_code ON public.password_reset_codes(code);
