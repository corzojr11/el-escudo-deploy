-- =============================================================================
-- EL ESCUDO — monthly_budget, debt_payments + RPC atómica (036)
-- =============================================================================
-- Idempotente: no falla si columnas/tablas ya existen.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'debts') THEN
    RAISE NOTICE '036: debts no existe. Aplica 001_core_schema primero.';
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'debt_payments') THEN
    CREATE TABLE public.debt_payments (
      id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      debt_id     UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
      user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      payment_date DATE NOT NULL,
      notes       TEXT DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS p_debt_payments_select ON public.debt_payments;
    CREATE POLICY p_debt_payments_select ON public.debt_payments
      FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_insert ON public.debt_payments;
    CREATE POLICY p_debt_payments_insert ON public.debt_payments
      FOR INSERT WITH CHECK (user_id = auth.uid());

    CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id);
    CREATE INDEX IF NOT EXISTS idx_debt_payments_user ON public.debt_payments(user_id);
  END IF;
END $$;

-- RPC atómica: registra pago y reduce saldo en una sola transacción
CREATE OR REPLACE FUNCTION public.record_debt_payment(
  p_debt_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC(12,2);
  v_payment_id UUID;
BEGIN
  SELECT remaining INTO v_remaining FROM public.debts
  WHERE id = p_debt_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deuda no encontrada';
  END IF;

  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'El abono (%) supera el saldo pendiente (%)', p_amount, v_remaining;
  END IF;

  INSERT INTO public.debt_payments (debt_id, user_id, amount, payment_date, notes)
  VALUES (p_debt_id, p_user_id, p_amount, p_payment_date, p_notes)
  RETURNING id INTO v_payment_id;

  UPDATE public.debts SET remaining = v_remaining - p_amount
  WHERE id = p_debt_id AND user_id = p_user_id;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'new_remaining', v_remaining - p_amount);
END;
$$;
