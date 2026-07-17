-- =============================================================================
-- EL ESCUDO — monthly_budget en profiles + debt_payments (036)
-- =============================================================================
-- Idempotente: no falla si las columnas o tablas ya existen.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'monthly_budget'
    ) THEN
      ALTER TABLE public.profiles ADD COLUMN monthly_budget NUMERIC(12,2) CHECK (monthly_budget >= 0);
    END IF;
  ELSE
    RAISE NOTICE '036: profiles no existe. Aplica 025_profiles_bootstrap primero.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id     UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.debt_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_debt_payments_select ON public.debt_payments;
CREATE POLICY p_debt_payments_select ON public.debt_payments
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS p_debt_payments_insert ON public.debt_payments;
CREATE POLICY p_debt_payments_insert ON public.debt_payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user ON public.debt_payments(user_id);
