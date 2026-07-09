import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../utils/supabase';
import { apiPost, apiGet } from '../../api/requests';

export interface Transaction {
  id: string;
  monto: number;
  descripcion: string;
  categoria: string;
  tipo: 'GASTO' | 'INGRESO';
  fecha: Date;
}

export interface Debt {
  id: string;
  lender: string;
  total: number;
  paid: number;
  monthly: number;
  remaining: number;
  dueDate: number;
}

export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  category: 'rent' | 'service' | 'subscription' | 'other';
  dueDate: number;
  status?: 'pending' | 'paid';
  paidAt?: string | null;
}

export interface FinanceSlice {
  // ── State ──────────────────────────────────────────────
  finances: { saldo: number };
  debts: Debt[];
  fixedExpenses: FixedExpense[];
  financesSummary: { category: string; total: number }[];
  transactions: Transaction[];

  // ── Actions ────────────────────────────────────────────
  addExpense: (amount: number, description: string, category?: string) => Promise<void>;
  addIncome: (amount: number, description: string, category?: string) => Promise<void>;
  quickFinanceEntry: (text: string) => Promise<void>;
  fetchFinancesSummary: () => Promise<void>;
  liquidateDebt: (debtId: string) => Promise<void>;
  addDebt: (debt: Omit<Debt, 'id' | 'paid'>) => Promise<void>;
  addFixedExpense: (expense: Omit<FixedExpense, 'id'>) => Promise<void>;
  markFixedExpensePaid: (expenseIdOrName: string) => Promise<void>;
  analyzeFinancialStrategy: () => string;
}

const genId = () => Math.random().toString(36).substring(7);
const FINANCE_OFFLINE_OPS_KEY = '@elescudo.offlineFinanceOps';
let financesSummaryFetchPromise: Promise<void> | null = null;
let lastFinancesSummaryFetchAt = 0;

type OfflineFinanceOp =
  | { id: string; kind: 'addDebt'; payload: Omit<Debt, 'id' | 'paid'>; queuedAt: number }
  | { id: string; kind: 'addFixedExpense'; payload: Omit<FixedExpense, 'id'>; queuedAt: number }
  | { id: string; kind: 'liquidateDebt'; payload: { debtId: string }; queuedAt: number }
  | { id: string; kind: 'markFixedExpensePaid'; payload: { expenseIdOrName: string }; queuedAt: number };

const readOfflineOps = async (): Promise<OfflineFinanceOp[]> => {
  try {
    const raw = await AsyncStorage.getItem(FINANCE_OFFLINE_OPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeOfflineOps = async (ops: OfflineFinanceOp[]) => {
  try {
    await AsyncStorage.setItem(FINANCE_OFFLINE_OPS_KEY, JSON.stringify(ops));
  } catch {
    // best effort
  }
};

const enqueueOfflineFinanceOp = async (op: Omit<OfflineFinanceOp, 'id' | 'queuedAt'>) => {
  const ops = await readOfflineOps();
  const next = [...ops, { ...op, id: genId(), queuedAt: Date.now() } as OfflineFinanceOp];
  await writeOfflineOps(next);
  return next[next.length - 1];
};

export const flushOfflineFinanceOps = async (state: any): Promise<number> => {
  const network = await NetInfo.fetch();
  if (network.isConnected === false) {
    return 0;
  }

  const ops = await readOfflineOps();
  if (ops.length === 0) return 0;

  const remaining: OfflineFinanceOp[] = [];
  let flushed = 0;

  for (const op of ops) {
    try {
      if (op.kind === 'addDebt') {
        const user = state.user;
        if (!user) {
          remaining.push(op);
          continue;
        }
        const { error } = await supabase
          .from('debts')
          .insert([{
            user_id: user.id,
            lender: op.payload.lender,
            total_amount: op.payload.total,
            monthly_payment: op.payload.monthly,
            remaining_installments: op.payload.remaining,
            due_date: op.payload.dueDate,
          }]);
        if (error) throw error;
      } else if (op.kind === 'addFixedExpense') {
        const user = state.user;
        if (!user) {
          remaining.push(op);
          continue;
        }
        const { error } = await supabase
          .from('fixed_expenses')
          .insert([{
            ...op.payload,
            user_id: user.id,
          }]);
        if (error) throw error;
      } else if (op.kind === 'liquidateDebt') {
        const debt = (state.debts || []).find((d: Debt) => d.id === op.payload.debtId);
        if (!debt || !state.user) {
          remaining.push(op);
          continue;
        }
        const { error } = await supabase
          .from('debts')
          .update({ paid_amount: debt.total, remaining_installments: 0 })
          .eq('id', op.payload.debtId);
        if (error) throw error;
      } else if (op.kind === 'markFixedExpensePaid') {
        const user = state.user;
        if (!user) {
          remaining.push(op);
          continue;
        }
        const fixedExpenses: FixedExpense[] = state.fixedExpenses || [];
        const normalizedQuery = op.payload.expenseIdOrName.trim().toLowerCase();
        const target = fixedExpenses.find((expense) =>
          expense.id === op.payload.expenseIdOrName || expense.name.toLowerCase().includes(normalizedQuery)
        );
        if (!target) {
          remaining.push(op);
          continue;
        }
        const paidAt = new Date().toISOString();
        const { error } = await supabase
          .from('fixed_expenses')
          .update({ status: 'paid', paid_at: paidAt })
          .eq('id', target.id)
          .eq('user_id', user.id);
        if (error) throw error;
      }
      flushed += 1;
    } catch {
      remaining.push(op);
    }
  }

  await writeOfflineOps(remaining);
  return flushed;
};
const buildExpenseSummary = (transactions: Transaction[]) => {
  const map = new Map<string, number>();
  transactions
    .filter((t) => t.tipo === 'GASTO')
    .forEach((t) => {
      const category = t.categoria || 'General';
      map.set(category, (map.get(category) || 0) + t.monto);
    });
  return Array.from(map.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
};

const applyTransactionToState = (state: any, transaction: Transaction) => {
  const isIncome = transaction.tipo === 'INGRESO';
  const nextTransactions = [transaction, ...state.transactions];
  return {
    finances: { saldo: Math.max(0, state.finances.saldo + (isIncome ? transaction.monto : -transaction.monto)) },
    transactions: nextTransactions,
    financesSummary: buildExpenseSummary(nextTransactions),
  };
};

const normalizeFixedExpense = (expense: any): FixedExpense => ({
  id: String(expense?.id || genId()),
  name: String(expense?.name || expense?.description || 'Factura'),
  amount: Number(expense?.amount || 0),
  category: (expense?.category || 'service') as FixedExpense['category'],
  dueDate: Number(expense?.dueDate ?? expense?.due_date ?? 1),
  status: expense?.status === 'paid' ? 'paid' : 'pending',
  paidAt: expense?.paidAt ?? expense?.paid_at ?? null,
});

export const createFinanceSlice = (set: any, get: any): FinanceSlice => ({
  // ── Initial State ────────────────────────────────────────
  finances: { saldo: 300 },
  debts: [],
  fixedExpenses: [],
  financesSummary: [],
  transactions: [],

  // ── Actions ──────────────────────────────────────────────
  addExpense: async (amount, description, category = 'General') => {
    const res = await apiPost('/api/v1/finances', { amount, description, category });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.detail || `Error del servidor (${res.status})`);
    }
    const created = await res.json().catch(() => null);
    const nextTransaction: Transaction = {
      id: created?.id || genId(),
      monto: created?.amount ?? amount,
      descripcion: created?.description ?? description,
      categoria: created?.category ?? category,
      tipo: created?.type === 'INGRESO' ? 'INGRESO' : 'GASTO',
      fecha: created?.timestamp ? new Date(created.timestamp) : new Date(),
    };
    set((state: any) => applyTransactionToState(state, nextTransaction));
    get().markDataDirty('finances');
  },

  addIncome: async (amount, description, category = 'Ingreso') => {
    const res = await apiPost('/api/v1/finances', { amount, description, category: `INGRESO:${category}`, type: 'INGRESO' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.detail || `Error del servidor (${res.status})`);
    }
    const created = await res.json().catch(() => null);
    const nextTransaction: Transaction = {
      id: created?.id || genId(),
      monto: created?.amount ?? amount,
      descripcion: created?.description ?? description,
      categoria: created?.category ?? category,
      tipo: 'INGRESO',
      fecha: created?.timestamp ? new Date(created.timestamp) : new Date(),
    };
    set((state: any) => applyTransactionToState(state, nextTransaction));
    get().markDataDirty('finances');
  },

  quickFinanceEntry: async (text) => {
    const session = get().session;
    if (!session) {
      get().addLog({ text: 'ERROR: Sesión no autenticada. No se puede registrar el gasto.', category: 'ERROR' });
      set({ isProcessing: false });
      return;
    }
    set({ isProcessing: true });
    try {
      const res = await apiPost('/api/v1/finances/quick-entry', { text });
      if (res.ok) {
        const data = await res.json();
        if (data?.fallback_mode === 'manual_review_required' || !Number(data.amount || 0)) {
          get().addLog({
            text: `No pude leer con claridad el movimiento "${text}". Déjalo para revisión manual.`,
            category: 'LOGISTICA',
          });
          return;
        }
        const nextTransaction: Transaction = {
          id: data.id,
          monto: data.amount,
          descripcion: data.description,
          categoria: data.category,
          tipo: data.type === 'INGRESO' ? 'INGRESO' : 'GASTO',
          fecha: new Date(),
        };
        set((state: any) => applyTransactionToState(state, nextTransaction));
        get().addLog({
          text: `${nextTransaction.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'} IA registrado: ${data.description} ($${data.amount})`,
          category: nextTransaction.tipo === 'INGRESO' ? 'SISTEMA' : 'GASTO',
        });
        get().markDataDirty('finances');
      }
    } catch (e) {
      console.error('quickFinanceEntry error:', e);
    } finally {
      set({ isProcessing: false });
    }
  },

  fetchFinancesSummary: async () => {
    const session = get().session;
    if (!session) return;
    if (financesSummaryFetchPromise) return financesSummaryFetchPromise;

    const now = Date.now();
    const dirtyDomains: string[] = get()._dirtyDomains || [];
    if (now - lastFinancesSummaryFetchAt < 15_000 && !dirtyDomains.includes('finances')) {
      return;
    }

    financesSummaryFetchPromise = (async () => {
      try {
        const res = await apiGet('/api/v1/finances/summary');
        if (res.ok) {
          const data = await res.json();
          set((state: any) => ({
            financesSummary: data.summary || [],
            _dirtyDomains: (state._dirtyDomains || []).filter((domain: string) => domain !== 'finances'),
          }));
          lastFinancesSummaryFetchAt = Date.now();
        }
      } catch (e) {
        console.error('fetchFinancesSummary error:', e);
      } finally {
        financesSummaryFetchPromise = null;
      }
    })();

    return financesSummaryFetchPromise;
  },

  liquidateDebt: async (debtId) => {
    const debt = get().debts.find((d: Debt) => d.id === debtId);
    if (!debt) return;
    try {
      const network = await NetInfo.fetch();
      const isOffline = network.isConnected === false;
      const { error } = await supabase
        .from('debts')
        .update({ paid_amount: debt.total, remaining_installments: 0 })
        .eq('id', debtId);
      set((state: any) => ({
        debts: state.debts.map((d: Debt) =>
          d.id === debtId ? { ...d, paid: d.total, remaining: 0 } : d
        ),
      }));
      get().markDataDirty('debts');
      get().addLog({
        text: `OBJETIVO LOGRADO: Deuda con ${debt.lender} liquidada. Blindaje financiero aumentado.`,
        category: 'SISTEMA',
      });
      get().addXP(500);
      if (isOffline || error) {
        await enqueueOfflineFinanceOp({ kind: 'liquidateDebt', payload: { debtId } });
      }
    } catch (e) {
      console.error('Error liquidating debt:', e);
    }
  },

  addFixedExpense: async (expense) => {
    const user = get().user;
    if (!user) throw new Error('Usuario no autenticado');
    const optimistic = normalizeFixedExpense({ ...expense, id: genId() });
    set((state: any) => ({
      fixedExpenses: [
        ...state.fixedExpenses,
        optimistic,
      ],
    }));
    get().markDataDirty('fixed_expenses');

    const network = await NetInfo.fetch();
    if (network.isConnected === false) {
      await enqueueOfflineFinanceOp({ kind: 'addFixedExpense', payload: expense });
      return;
    }

    const { error } = await supabase
      .from('fixed_expenses')
      .insert([{ ...expense, user_id: user.id }])
      .select();
    if (error) {
      await enqueueOfflineFinanceOp({ kind: 'addFixedExpense', payload: expense });
      throw new Error(error.message);
    }
  },

  markFixedExpensePaid: async (expenseIdOrName) => {
    const user = get().user;
    if (!user) throw new Error('Usuario no autenticado');

    const fixedExpenses: FixedExpense[] = get().fixedExpenses || [];
    const normalizedQuery = expenseIdOrName.trim().toLowerCase();
    const target = fixedExpenses.find((expense) =>
      expense.id === expenseIdOrName || expense.name.toLowerCase().includes(normalizedQuery)
    );

    if (!target) {
      throw new Error('No encontré una factura fija con ese nombre o ID.');
    }

    const paidAt = new Date().toISOString();
    const nextFixedExpenses = fixedExpenses.map((expense) =>
      expense.id === target.id
        ? { ...expense, status: 'paid' as const, paidAt }
        : expense
    );

    set({ fixedExpenses: nextFixedExpenses });
    get().markDataDirty('fixed_expenses');

    try {
      const network = await NetInfo.fetch();
      if (network.isConnected === false) {
        await enqueueOfflineFinanceOp({ kind: 'markFixedExpensePaid', payload: { expenseIdOrName } });
        return;
      }
      const { error } = await supabase
        .from('fixed_expenses')
        .update({ status: 'paid', paid_at: paidAt })
        .eq('id', target.id)
        .eq('user_id', user.id);
      if (error) {
        console.warn('[finance] markFixedExpensePaid sync warning:', error.message);
        await enqueueOfflineFinanceOp({ kind: 'markFixedExpensePaid', payload: { expenseIdOrName } });
      }
    } catch (e) {
      console.warn('[finance] markFixedExpensePaid sync error:', e);
      await enqueueOfflineFinanceOp({ kind: 'markFixedExpensePaid', payload: { expenseIdOrName } });
    }

    get().addLog({
      text: `Factura fija "${target.name}" marcada como pagada.`,
      category: 'SISTEMA',
    });
    get().addXP(25);
  },

  addDebt: async (debt) => {
    const user = get().user;
    if (!user) throw new Error('Usuario no autenticado');
    const optimistic: Debt = {
      id: genId(),
      lender: debt.lender,
      total: debt.total,
      paid: 0,
      monthly: debt.monthly,
      remaining: debt.remaining,
      dueDate: debt.dueDate,
    };
    set((state: any) => ({
      debts: [
        ...state.debts,
        optimistic,
      ],
    }));
    get().markDataDirty('debts');

    const network = await NetInfo.fetch();
    if (network.isConnected === false) {
      await enqueueOfflineFinanceOp({ kind: 'addDebt', payload: debt });
      return;
    }

    const { error } = await supabase
      .from('debts')
      .insert([{ user_id: user.id, lender: debt.lender, total_amount: debt.total, monthly_payment: debt.monthly, remaining_installments: debt.remaining, due_date: debt.dueDate }])
      .select();
    if (error) {
      await enqueueOfflineFinanceOp({ kind: 'addDebt', payload: debt });
      throw new Error(error.message);
    }
  },

  analyzeFinancialStrategy: () => {
    const debts: Debt[] = get().debts;
    if (debts.length === 0) return 'No hay brechas financieras detectadas. Blindaje máximo.';
    const sorted = [...debts].sort((a, b) => (a.total - a.paid) - (b.total - b.paid));
    const target = sorted[0];
    return `ESTRATEGIA RECOMENDADA: Concentrar excedente en '${target.lender}'. Es la deuda más cercana a la liquidación total.`;
  },
});
