import { create } from 'zustand';
import { syncData, processCommand } from '../services/api';

export interface UserProfile {
  name: string;
  level: number;
  xp: number;
  xp_to_next_level: number;
  streak: number;
  title: string;
}

export interface Goal {
  id: string;
  title: string;
  progress: number;
  target: number;
  category: string;
  completed: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
}

export interface Habit {
  id: string;
  name: string;
  completed_today: boolean;
  streak: number;
  category: string;
}

export interface WeightRecord {
  id: string;
  weight: number;
  date: string;
}

export interface WorkShift {
  id: string;
  start_time: string;
  end_time: string | null;
  active: boolean;
  tasks_completed: number;
}

export interface ChatMessage {
  role: 'user' | 'omni';
  text: string;
  time: string;
}

interface AppState {
  isLoading: boolean;
  error: string | null;
  profile: UserProfile | null;
  todayTasksCompleted: number;
  todayTasksTotal: number;
  todayIncome: number;
  todayExpense: number;
  goals: Goal[];
  transactions: Transaction[];
  habits: Habit[];
  weightRecords: WeightRecord[];
  latestWeight: number | null;
  weightTrend: number | null;
  activeShifts: WorkShift[];
  chatHistory: ChatMessage[];
  hydrateStore: (forceReload?: boolean) => Promise<void>;
  sendOmniCommand: (cmd: string) => Promise<void>;
  clearError: () => void;
}

const defaultChatMessages: ChatMessage[] = [
  { role: 'user', text: '¿Cómo voy con mis metas hoy?', time: '10:30 AM' },
  { role: 'omni', text: 'Vas muy bien, Escudero. Has completado 5 de 8 tareas diarias. Tu racha de 14 días sigue activa. ¿Quieres que priorice algo para ti?', time: '10:31 AM' },
  { role: 'user', text: 'Registra un gasto de $250 en transporte', time: '10:45 AM' },
  { role: 'omni', text: 'Gasto registrado: $250 en Transporte. Tu balance diario ahora es de $1,700 MXN. ¿Necesitas algo más?', time: '10:45 AM' },
];

export const useAppStore = create<AppState>((set, get) => ({
  isLoading: false,
  error: null,
  profile: null,
  todayTasksCompleted: 0,
  todayTasksTotal: 8,
  todayIncome: 0,
  todayExpense: 0,
  goals: [],
  transactions: [],
  habits: [],
  weightRecords: [],
  latestWeight: null,
  weightTrend: null,
  activeShifts: [],
  chatHistory: defaultChatMessages,

  hydrateStore: async (forceReload = false) => {
    if (!forceReload && get().profile) return;
    
    set({ isLoading: true, error: null });
    try {
      const data = await syncData();
      
      if (data.profile) {
        set({ profile: data.profile });
      }
      
      if (data.goals) {
        set({ goals: data.goals });
      }
      
      if (data.transactions) {
        set({ transactions: data.transactions });
        const today = new Date().toISOString().split('T')[0];
        const todayTx = data.transactions.filter((tx: Transaction) => tx.date === today);
        const income = todayTx.filter((tx: Transaction) => tx.type === 'income').reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
        const expense = todayTx.filter((tx: Transaction) => tx.type === 'expense').reduce((sum: number, tx: Transaction) => sum + tx.amount, 0);
        set({ todayIncome: income, todayExpense: expense });
      }
      
      if (data.habits) {
        set({ habits: data.habits });
        const completed = data.habits.filter((h: Habit) => h.completed_today).length;
        set({ todayTasksCompleted: completed, todayTasksTotal: data.habits.length });
      }
      
      if (data.weight_records && data.weight_records.length > 0) {
        set({ weightRecords: data.weight_records });
        const sorted = [...data.weight_records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        set({ latestWeight: sorted[0].weight });
        if (sorted.length >= 2) {
          set({ weightTrend: sorted[0].weight - sorted[1].weight });
        }
      }
      
      if (data.shifts) {
        const active = data.shifts.filter((s: WorkShift) => s.active);
        set({ activeShifts: active });
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al sincronizar datos';
      set({ error: message });
      console.warn('Hydrate falló, usando datos de ejemplo:', message);
    } finally {
      set({ isLoading: false });
    }
  },

  sendOmniCommand: async (cmd: string) => {
    const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const userMsg: ChatMessage = { role: 'user', text: cmd, time: now };
    set((state) => ({ chatHistory: [...state.chatHistory, userMsg] }));
    
    set({ isLoading: true });
    try {
      const response = await processCommand(cmd);
      const omniMsg: ChatMessage = { 
        role: 'omni', 
        text: response.message || response.response || 'Procesado.',
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
      set((state) => ({ chatHistory: [...state.chatHistory, omniMsg] }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al procesar comando';
      const errorMsg: ChatMessage = { role: 'omni', text: 'OMNI está temporalmente fuera de línea.', time: now };
      set((state) => ({ chatHistory: [...state.chatHistory, errorMsg], error: message }));
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));