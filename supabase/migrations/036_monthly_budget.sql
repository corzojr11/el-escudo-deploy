-- =============================================================================
-- EL ESCUDO — monthly_budget, debts, fixed_expenses, debt_payments + RPC atomica (036)
-- =============================================================================
-- Migracion robusta e idempotente: no falla si columnas/tablas/RPC ya existen.
-- No usa DROP/TRUNCATE ni cambios destructivos.
-- Aplica una sola vez en Supabase produccion.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) monthly_budget en profiles (si profiles existe)
-- ---------------------------------------------------------------------------
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
      ALTER TABLE public.profiles
        ADD COLUMN monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 0
        CHECK (monthly_budget >= 0);
      RAISE NOTICE '036: columna profiles.monthly_budget creada.';
    ELSE
      RAISE NOTICE '036: profiles.monthly_budget ya existe, se omite.';
    END IF;
  ELSE
    RAISE NOTICE '036: profiles no existe. Aplica 025_profiles_bootstrap primero.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Tabla public.debts (si no existe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) THEN
    CREATE TABLE public.debts (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name             TEXT NOT NULL,
      total            NUMERIC(12,2) NOT NULL CHECK (total > 0),
      remaining       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (remaining >= 0),
      monthly_payment  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_payment >= 0),
      due_date         DATE,
      notes            TEXT NOT NULL DEFAULT '',
      status           TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '036: tabla public.debts creada.';
  ELSE
    RAISE NOTICE '036: tabla public.debts ya existe.';
  END IF;
END $$;

-- Columnas faltantes en debts (idempotente, sin tocar datos existentes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'name'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'total'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN total NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'remaining'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN remaining NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'monthly_payment'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN monthly_payment NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'due_date'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN due_date DATE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'notes'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN notes TEXT NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'status'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN status TEXT;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.debts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    RAISE NOTICE '036: columnas de debts verificadas.';
  END IF;
END $$;

-- RLS + politicas debts (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) THEN
    ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS p_debts_select ON public.debts;
    CREATE POLICY p_debts_select ON public.debts
      FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debts_insert ON public.debts;
    CREATE POLICY p_debts_insert ON public.debts
      FOR INSERT WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debts_update ON public.debts;
    CREATE POLICY p_debts_update ON public.debts
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debts_delete ON public.debts;
    CREATE POLICY p_debts_delete ON public.debts
      FOR DELETE USING (user_id = auth.uid());

    RAISE NOTICE '036: politicas RLS de debts creadas.';
  ELSE
    RAISE NOTICE '036: debts no existe, no se aplicaron politicas.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Tabla public.fixed_expenses (si no existe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fixed_expenses'
  ) THEN
    CREATE TABLE public.fixed_expenses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      category    TEXT NOT NULL DEFAULT 'Servicios',
      due_date    DATE,
      is_paid     BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '036: tabla public.fixed_expenses creada.';
  ELSE
    RAISE NOTICE '036: tabla public.fixed_expenses ya existe.';
  END IF;
END $$;

-- Columnas faltantes en fixed_expenses (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fixed_expenses'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'name'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN name TEXT NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'amount'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN amount NUMERIC(12,2) NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'category'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN category TEXT NOT NULL DEFAULT 'Servicios';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'due_date'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN due_date DATE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'is_paid'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.fixed_expenses ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
    RAISE NOTICE '036: columnas de fixed_expenses verificadas.';
  END IF;
END $$;

-- RLS + politicas fixed_expenses (idempotente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fixed_expenses'
  ) THEN
    ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS p_fixed_expenses_select ON public.fixed_expenses;
    CREATE POLICY p_fixed_expenses_select ON public.fixed_expenses
      FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS p_fixed_expenses_insert ON public.fixed_expenses;
    CREATE POLICY p_fixed_expenses_insert ON public.fixed_expenses
      FOR INSERT WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_fixed_expenses_update ON public.fixed_expenses;
    CREATE POLICY p_fixed_expenses_update ON public.fixed_expenses
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_fixed_expenses_delete ON public.fixed_expenses;
    CREATE POLICY p_fixed_expenses_delete ON public.fixed_expenses
      FOR DELETE USING (user_id = auth.uid());

    RAISE NOTICE '036: politicas RLS de fixed_expenses creadas.';
  ELSE
    RAISE NOTICE '036: fixed_expenses no existe, no se aplicaron politicas.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) Tabla public.debt_payments (si debts existe)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) THEN
    RAISE NOTICE '036: debts no existe. Se omite la creacion de debt_payments.';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debt_payments'
  ) THEN
    CREATE TABLE public.debt_payments (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      debt_id      UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
      user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
      payment_date  DATE NOT NULL,
      notes        TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS p_debt_payments_select ON public.debt_payments;
    CREATE POLICY p_debt_payments_select ON public.debt_payments
      FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_insert ON public.debt_payments;
    CREATE POLICY p_debt_payments_insert ON public.debt_payments
      FOR INSERT WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_update ON public.debt_payments;
    CREATE POLICY p_debt_payments_update ON public.debt_payments
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_delete ON public.debt_payments;
    CREATE POLICY p_debt_payments_delete ON public.debt_payments
      FOR DELETE USING (user_id = auth.uid());

    RAISE NOTICE '036: tabla public.debt_payments creada.';
  ELSE
    -- Asegura RLS/politicas si la tabla preexiste sin ellas
    ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS p_debt_payments_select ON public.debt_payments;
    CREATE POLICY p_debt_payments_select ON public.debt_payments
      FOR SELECT USING (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_insert ON public.debt_payments;
    CREATE POLICY p_debt_payments_insert ON public.debt_payments
      FOR INSERT WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_update ON public.debt_payments;
    CREATE POLICY p_debt_payments_update ON public.debt_payments
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS p_debt_payments_delete ON public.debt_payments;
    CREATE POLICY p_debt_payments_delete ON public.debt_payments
      FOR DELETE USING (user_id = auth.uid());

    RAISE NOTICE '036: debt_payments ya existe; RLS/politicas revalidadas.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5) Indices utiles (idempotentes)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_debts_user
  ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date
  ON public.debts(due_date);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user
  ON public.fixed_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_due_date
  ON public.fixed_expenses(due_date);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt
  ON public.debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user
  ON public.debt_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_payment_date
  ON public.debt_payments(payment_date);

-- ---------------------------------------------------------------------------
-- 6) updated_at triggers idempotentes para debts y fixed_expenses
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.debts ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'debts' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_debts_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public._set_debts_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER trg_debts_updated_at
      BEFORE UPDATE ON public.debts
      FOR EACH ROW EXECUTE FUNCTION public._set_debts_updated_at();
    RAISE NOTICE '036: trigger debts.updated_at creado.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'fixed_expenses' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_fixed_expenses_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public._set_fixed_expenses_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER trg_fixed_expenses_updated_at
      BEFORE UPDATE ON public.fixed_expenses
      FOR EACH ROW EXECUTE FUNCTION public._set_fixed_expenses_updated_at();
    RAISE NOTICE '036: trigger fixed_expenses.updated_at creado.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7) RPC atomica record_debt_payment (SOLO si debts y debt_payments existen)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  rpc_exists BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debt_payments'
  ) THEN
    RAISE NOTICE '036: debts o debt_payments no existen. Se omite la RPC record_debt_payment.';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = 'record_debt_payment'
  ) INTO rpc_exists;

  IF NOT rpc_exists THEN
    CREATE OR REPLACE FUNCTION public.record_debt_payment(
      p_debt_id      UUID,
      p_user_id      UUID,
      p_amount       NUMERIC,
      p_payment_date DATE,
      p_notes        TEXT DEFAULT ''
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_remaining   NUMERIC(12,2);
      v_payment_id  UUID;
      v_amount      NUMERIC(12,2) := ROUND(p_amount::NUMERIC, 2);
    BEGIN
      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'AMOUNT_INVALID';
      END IF;

      SELECT remaining INTO v_remaining
      FROM public.debts
      WHERE id = p_debt_id AND user_id = p_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'DEBT_NOT_FOUND';
      END IF;

      IF v_amount > v_remaining THEN
        RAISE EXCEPTION 'AMOUNT_EXCEEDS_REMAINING';
      END IF;

      INSERT INTO public.debt_payments (debt_id, user_id, amount, payment_date, notes)
      VALUES (p_debt_id, p_user_id, v_amount, p_payment_date, COALESCE(p_notes, ''))
      RETURNING id INTO v_payment_id;

      UPDATE public.debts
      SET remaining = GREATEST(v_remaining - v_amount, 0)
      WHERE id = p_debt_id AND user_id = p_user_id;

      RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'new_remaining', GREATEST(v_remaining - v_amount, 0)
      );
    END;
    $$;

    RAISE NOTICE '036: funcion public.record_debt_payment creada.';
  ELSE
    -- Reemplaza la definicion para asegurar version consistente y atomicidad
    CREATE OR REPLACE FUNCTION public.record_debt_payment(
      p_debt_id      UUID,
      p_user_id      UUID,
      p_amount       NUMERIC,
      p_payment_date DATE,
      p_notes        TEXT DEFAULT ''
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_remaining   NUMERIC(12,2);
      v_payment_id  UUID;
      v_amount      NUMERIC(12,2) := ROUND(p_amount::NUMERIC, 2);
    BEGIN
      IF v_amount IS NULL OR v_amount <= 0 THEN
        RAISE EXCEPTION 'AMOUNT_INVALID';
      END IF;

      SELECT remaining INTO v_remaining
      FROM public.debts
      WHERE id = p_debt_id AND user_id = p_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'DEBT_NOT_FOUND';
      END IF;

      IF v_amount > v_remaining THEN
        RAISE EXCEPTION 'AMOUNT_EXCEEDS_REMAINING';
      END IF;

      INSERT INTO public.debt_payments (debt_id, user_id, amount, payment_date, notes)
      VALUES (p_debt_id, p_user_id, v_amount, p_payment_date, COALESCE(p_notes, ''))
      RETURNING id INTO v_payment_id;

      UPDATE public.debts
      SET remaining = GREATEST(v_remaining - v_amount, 0)
      WHERE id = p_debt_id AND user_id = p_user_id;

      RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'new_remaining', GREATEST(v_remaining - v_amount, 0)
      );
    END;
    $$;

    RAISE NOTICE '036: funcion public.record_debt_payment reemplazada (idempotente).';
  END IF;

  -- Endurecimiento de permisos: solo service_role puede ejecutarla
  REVOKE ALL ON FUNCTION public.record_debt_payment(UUID, UUID, NUMERIC, DATE, TEXT) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.record_debt_payment(UUID, UUID, NUMERIC, DATE, TEXT) FROM anon;
  REVOKE EXECUTE ON FUNCTION public.record_debt_payment(UUID, UUID, NUMERIC, DATE, TEXT) FROM authenticated;
  -- service_role debe tener permiso explicito
  GRANT EXECUTE ON FUNCTION public.record_debt_payment(UUID, UUID, NUMERIC, DATE, TEXT) TO service_role;

  -- Apoyo para usuarios autenticados: permitir SELECT/INSERT/UPDATE/DELETE en tablas
  -- (la RPC misma queda restringida al backend con service_role)
  RAISE NOTICE '036: permisos de record_debt_payment restringidos a service_role.';
END $$;

-- Asegura que usuarios autenticados conservan acceso base RLS a las tablas nuevas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO authenticated;

-- Permisos para service_role en todas las tablas nuevas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_expenses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- FIN de la migracion 036
-- ---------------------------------------------------------------------------