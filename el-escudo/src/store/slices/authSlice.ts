import { Session, User } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';

import { supabase } from '../../utils/supabase';
import { getApiBaseUrl } from '../../config/api';
import { apiPost } from '../../api/requests';
import { UserProfile } from '../types';
import { SyncResponse, FinanceTransaction, Mission, WorkShift, WeightLog, Goal, RoutineDayRow, ExerciseLog, PersonalRecord } from '../../types/api';

const TASK_META_PRIORITY_RE = /\[\[priority:(high|medium|low)\]\]/i;
const TASK_META_SCHEDULED_RE = /\[\[(?:scheduled|due):([^\]]+)\]\]/i;
const stripTaskMeta = (value: string) =>
  String(value || '')
    .replace(TASK_META_PRIORITY_RE, '')
    .replace(TASK_META_SCHEDULED_RE, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
const parseTaskPriority = (mission: Mission): 'high' | 'medium' | 'low' => {
  const direct = String((mission as any).priority || '').trim().toLowerCase();
  if (direct === 'high' || direct === 'medium' || direct === 'low') return direct;
  const match = String(mission.description || '').match(TASK_META_PRIORITY_RE);
  return (match?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium';
};
const parseTaskScheduledAt = (mission: Mission): string | undefined => {
  const direct = String((mission as any).scheduled_at || (mission as any).scheduledAt || '').trim();
  if (direct) return direct;
  const match = String(mission.description || '').match(TASK_META_SCHEDULED_RE);
  return match?.[1]?.trim() || undefined;
};

const buildRoutineMap = (rows: RoutineDayRow[] | undefined | null) => {
  const routine: Record<number, any> = {
    0: null,
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };
  (rows || []).forEach((row) => {
    routine[Number(row.day_index)] = {
      name: String(row.day_name || `Día ${row.day_index}`),
      objective: String((row as any).objective || '').trim() || undefined,
      estimatedMinutes: Number((row as any).estimated_minutes ?? (row as any).estimatedMinutes ?? 0) || undefined,
      notes: Array.isArray((row as any).notes) ? (row as any).notes.map((note: any) => String(note || '').trim()).filter(Boolean) : [],
      exercises: Array.isArray(row.exercises)
        ? row.exercises.map((exercise, idx) => ({
            id: `${row.day_index}-${idx}-${String(exercise.name || 'ex')}`,
            name: String(exercise.name || 'Ejercicio'),
            suggestedSets: Number(exercise.suggestedSets || 3),
            suggestedReps: String(exercise.suggestedReps || '8-12'),
            equipment: Array.isArray((exercise as any).equipment) ? (exercise as any).equipment : [],
            muscles: Array.isArray((exercise as any).muscles) ? (exercise as any).muscles : [],
          }))
        : [],
    };
  });
  return routine;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableSyncStatus = (status: number) => status === 429 || status >= 500;
const SYNC_TIMEOUT_MS = 12000;

export interface AuthSlice {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;

  setSession: (session: Session | null) => void;
  logout: () => Promise<void>;
  hydrateStore: (force?: boolean) => Promise<boolean>;
  toggleNotifications: (enabled: boolean) => Promise<void>;
  completeUserOnboarding: (profile: UserProfile) => Promise<void>;
}

export const createAuthSlice = (set: any, get: any) => ({
  session: null,
  user: null,
  isAuthenticated: false,
  userProfile: null,

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
    });
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    }
    set({
      session: null,
      user: null,
      userProfile: null,
      _lastSyncTime: null,
    });
  },

  hydrateStore: async (force = false) => {
    const lastSync = get()._lastSyncTime;
    const forceHydrateUntil = get()._forceHydrateUntil;
    const now = Date.now();
    const hasForcedWindow = !!forceHydrateUntil && now < forceHydrateUntil;
    if (!force && !hasForcedWindow && lastSync && now - lastSync < 5 * 60 * 1000) {
      return false;
    }

    const { session } = get();
    if (!session?.access_token) {
      return false;
    }

    const networkState = await NetInfo.fetch();
    if (networkState.isConnected === false) {
      set({ toast: { visible: true, message: 'Sin conexion. Se conserva lo local.' } });
      setTimeout(() => {
        set({ toast: { visible: false, message: '' } });
      }, 2500);
      return false;
    }

    try {
      if (get()._syncInFlight) {
        return false;
      }

      set({ _syncInFlight: true });

      let res: Response | null = null;
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
        try {
          res = await fetch(`${getApiBaseUrl()}/api/v1/sync?t=${Date.now()}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            signal: controller.signal,
          });
          if (!isRetryableSyncStatus(res.status) || attempt === 2) {
            break;
          }
        } catch (error) {
          lastError = error;
          if (attempt === 2) {
            break;
          }
          await sleep(250 * (attempt + 1));
          continue;
        } finally {
          clearTimeout(timeoutId);
        }

        await sleep(250 * (attempt + 1));
      }

      if (!res) {
        throw lastError || new Error('Sync request failed');
      }

      if (res.ok) {
        const data: SyncResponse = await res.json();

        const currentCost = get().aiCostCop || 0;
        const newSyncCost = data.usage?.cost_cop || 0;
        const currentFixedExpenses = new Map<string, any>(
          ((get().fixedExpenses || []) as any[]).map((expense: any) => [String(expense?.id), expense])
        );
        const syncFinances = (data.finances || []) as FinanceTransaction[];
        const syncMissions = (data.missions || []) as Mission[];
        const financesSummary = syncFinances.reduce((acc: { category: string; total: number }[], f: FinanceTransaction) => {
          const isIncome = (f.tipo === 'INGRESO') || (typeof f.category === 'string' && f.category.startsWith('INGRESO:')) || f.category === 'INGRESO';
          if (isIncome) return acc;
          const category = typeof f.category === 'string' && f.category.startsWith('INGRESO:') ? f.category.replace('INGRESO:', '') : (f.category || 'General');
          const existing = acc.find((item) => item.category === category);
          if (existing) {
            existing.total += Number(f.amount || 0);
          } else {
            acc.push({ category, total: Number(f.amount || 0) });
          }
          return acc;
        }, []).sort((a, b) => b.total - a.total);

        set({
          isAuthenticated: !!data.profile,
          userProfile: data.profile || null,
          dailyQuote: data.daily_quote || 'Disciplina es libertad.',
          aiCostCop: currentCost + newSyncCost,
          debts: data.debts || [],
          fixedExpenses: ((data.fixed_expenses || []) as any[]).map((expense: any) => {
            const existing = currentFixedExpenses.get(String(expense?.id));
            return {
              id: String(expense?.id || existing?.id || Math.random().toString(36).substring(7)),
              name: String(expense?.name || expense?.description || existing?.name || 'Factura'),
              amount: Number(expense?.amount ?? existing?.amount ?? 0),
              category: (expense?.category || existing?.category || 'service') as 'rent' | 'service' | 'subscription' | 'other',
              dueDate: Number(expense?.dueDate ?? expense?.due_date ?? existing?.dueDate ?? 1),
              status: expense?.status || existing?.status || 'pending',
              paidAt: expense?.paidAt ?? expense?.paid_at ?? existing?.paidAt ?? null,
            };
          }),
          financesSummary,
          finances: {
            saldo: syncFinances.reduce((acc: number, f: FinanceTransaction) => {
              const isIncome = (f.tipo === 'INGRESO') || (typeof f.category === 'string' && f.category.startsWith('INGRESO:')) || f.category === 'INGRESO';
              return acc + (isIncome ? f.amount : -f.amount);
            }, 0),
          },
          player: {
            ...get().player,
            level: data.profile?.level || 1,
            xpCurrent: data.profile?.xp || 0,
            xpToNext: 1000,
          },
          transactions: ((data.finances || []) as FinanceTransaction[]).map((f: FinanceTransaction) => ({
            id: f.id,
            monto: f.amount,
            descripcion: f.description,
            categoria: f.category || 'General',
            tipo: (f.tipo === 'INGRESO' || (typeof f.category === 'string' && f.category.startsWith('INGRESO:')) || f.category === 'INGRESO') ? 'INGRESO' : 'GASTO',
            fecha: new Date(f.timestamp),
          })),
          projects: {
            tareasHoy: {
              done: syncMissions.filter((m: Mission) => m.status === 'completed' || m.status === 'completado').length,
              total: syncMissions.length,
            },
            list: syncMissions.map((m: Mission) => ({
              id: m.id,
              name: String((m as any).name || m.title || 'Misión'),
              description: stripTaskMeta(String(m.description || '')),
              category: String(m.category || 'general'),
              status: (m.status === 'completed' || m.status === 'completado') ? 'completed' : 'active',
              priority: parseTaskPriority(m),
              scheduledAt: parseTaskScheduledAt(m),
            })),
            tasks: syncMissions.map((m: Mission) => ({
              id: m.id,
              projectId: m.id,
              title: String((m as any).name || m.title || 'Misión'),
              priority: parseTaskPriority(m),
              completed: m.status === 'completed' || m.status === 'completado',
              xpReward: Number((m as any).xp_reward || 50),
              scheduledAt: parseTaskScheduledAt(m),
            })),
          },
          goals: ((data.goals || []) as Goal[]).map((goal: Goal) => ({
            ...goal,
          })),
          workShifts: ((data.shifts || []) as WorkShift[]).map((s: WorkShift) => ({ id: s.id, day: s.day, start: s.start, end: s.end })),
          health: {
            ...get().health,
            routine: {
              ...get().health?.routine,
              ...buildRoutineMap((data.routines || []) as RoutineDayRow[]),
            },
          },
          racha: {
            ...get().racha,
            days: Number(data.focus_status?.focus_streak || 0),
          },
          focusStatus: {
            focusStreak: Number(data.focus_status?.focus_streak || 0),
            focusBest: Number(data.focus_status?.focus_best || 0),
            urgeCount: Number(data.focus_status?.urge_count || 0),
            lastCheckDate: data.focus_status?.last_check_date || null,
          },
          weightHistory: data.weight_logs ? (data.weight_logs as WeightLog[]).map((w: WeightLog) => ({ id: w.id, weight: w.weight, timestamp: new Date(w.timestamp) })) : [],
          exerciseLogs: ((data.exercise_logs || []) as ExerciseLog[]).map((log: ExerciseLog) => ({
            ...log,
          })),
          personalRecords: ((data.personal_records || []) as PersonalRecord[]).map((record: PersonalRecord) => ({
            ...record,
          })),
          targetWakeTime: data.bio_settings?.t_wake_target || get().targetWakeTime,
          _lastSyncTime: Date.now(),
          _forceHydrateUntil: null,
          _dirtyDomains: [],
        });

        return true;
      }
      if (res.status === 503) {
        const payload = await res.json().catch(() => null);
        if (payload?.error === 'BACKEND_NOT_CONFIGURED') {
          set({ toast: { visible: true, message: 'Configura el backend movil en Perfil.' } });
          setTimeout(() => {
            set({ toast: { visible: false, message: '' } });
          }, 3000);
        }
      }
    } catch (e) {
      set({ toast: { visible: true, message: 'No se pudo sincronizar. Se conservara lo local.' } });
      setTimeout(() => {
        set({ toast: { visible: false, message: '' } });
      }, 3000);
    } finally {
      set({ _syncInFlight: false });
    }
    return false;
  },

  toggleNotifications: async (enabled: boolean) => {
    const session = get().session;
    if (!session) {
      return;
    }
    try {
      const { registerForPushNotificationsAsync } = require('../../utils/notifications');
      let token = null;
      if (enabled) token = await registerForPushNotificationsAsync();
      await apiPost('/api/v1/profile/token', { push_token: token, enabled });
      set((state: any) => ({
        userProfile: state.userProfile
          ? { ...state.userProfile, notificationsEnabled: enabled, pushToken: token || state.userProfile.pushToken }
          : null,
      }));
    } catch (e) {
      console.error('Error toggling notifications:', e);
      set({ toast: { visible: true, message: 'No se pudieron activar las notificaciones.' } });
      setTimeout(() => {
        set({ toast: { visible: false, message: '' } });
      }, 3000);
    }
  },

  completeUserOnboarding: async (profileData: UserProfile) => {
    const session = get().session;
    if (!session) return;

    set((state: any) => ({
      userProfile: profileData,
      isAuthenticated: true,
      health: { ...state.health, weight: profileData.weight, height: profileData.height, userProfileCompleted: true },
    }));

    try {
      const res = await apiPost('/api/v1/profile', profileData);
      if (res.ok) {
        const data = await res.json();
        const sP = data.profile;
        set((state: any) => ({
          userProfile: { ...state.userProfile, ...sP } as UserProfile,
          player: { ...state.player, level: sP.level || state.player.level, xpCurrent: sP.xp || sP.current_xp || state.player.xpCurrent },
        }));
        get().addLog({ text: 'Identidad vinculada a la nube con éxito.', category: 'SISTEMA' });
        get().addXP(200);
      } else {
        get().addLog({ text: 'Error de sincronización. Los datos se guardaron localmente.', category: 'ERROR' });
      }
    } catch (e) {
      console.error('Onboarding Sync Error:', e);
      get().addLog({ text: 'Servidor fuera de línea. Modo local activado.', category: 'ERROR' });
    }
  },
});
