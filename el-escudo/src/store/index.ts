import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createAuthSlice, AuthSlice,
  createPlayerSlice, PlayerSlice,
  createScheduleSlice, ScheduleSlice,
  createOmniSlice, OmniSlice,
  createProjectSlice, ProjectSlice,
  createFinanceSlice, FinanceSlice,
  createHealthSlice, HealthSlice,
} from './slices';
import { UserProfile, WorkShift, SleepWindow, Meal, ActionLog, Project, Task, Goal, Mission } from './types';

export type { UserProfile, WorkShift, SleepWindow, Meal, ActionLog, Project, Task, Goal, Mission } from './types';
export type { FinanceSlice, HealthSlice, AuthSlice, PlayerSlice, ScheduleSlice, OmniSlice, ProjectSlice } from './slices';
export type { Transaction, Debt, FixedExpense } from './slices/financeSlice';
export type { WeightEntry, WorkoutSet, ActiveExercise, RoutineDay, RoutineExercise } from './slices/healthSlice';
export type { ExerciseLog, PersonalRecord } from '../types/api';

export interface AppState extends FinanceSlice, HealthSlice, AuthSlice, PlayerSlice, ScheduleSlice, OmniSlice, ProjectSlice {
  // Internal
  _lastSyncTime: number | null;
  _forceHydrateUntil: number | null;
  _dirtyDomains: string[];
  _syncInFlight: boolean;
  markDataDirty: (domain: string) => void;
  // UI
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // Slices
      ...createFinanceSlice(set, get),
      ...createHealthSlice(set, get),
      ...createAuthSlice(set, get),
      ...createPlayerSlice(set, get),
      ...createScheduleSlice(set, get),
      ...createOmniSlice(set, get),
      ...createProjectSlice(set, get),

      // Internal
      _lastSyncTime: null,
      _forceHydrateUntil: null,
      _dirtyDomains: [],
      _syncInFlight: false,
      markDataDirty: (domain: string) =>
        set((state) => ({
          _dirtyDomains: Array.from(new Set([...(state._dirtyDomains || []), domain])),
          _forceHydrateUntil: Date.now() + 2 * 60 * 1000,
        })),

      // UI
      isDarkMode: true,
      toggleTheme: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
    }),
    {
      name: 'el-escudo-store',
      version: 4,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState: any, version: number) => {
        // v1 → v2: projects.tasks no existía en el esquema anterior
        if (version < 2) {
          if (persistedState?.projects && !Array.isArray(persistedState.projects?.tasks)) {
            persistedState.projects.tasks = [];
          }
        }
        if (version < 3) {
          if (Array.isArray(persistedState?.transactions)) {
            persistedState.transactions = persistedState.transactions.map((t: any) => ({
              ...t,
              fecha: t?.fecha ? new Date(t.fecha) : new Date(),
            }));
          }
          if (Array.isArray(persistedState?.weightHistory)) {
            persistedState.weightHistory = persistedState.weightHistory.map((w: any) => ({
              ...w,
              timestamp: w?.timestamp ? new Date(w.timestamp) : new Date(),
            }));
          }
        }
        if (version < 4) {
          const defaultEquipment = [
            'Mancuernas convertibles',
            'Barra conectora',
            'Peso ruso',
            'Discos ajustables',
            'Banco o superficie plana',
            'Espacio para zancadas',
          ];
          if (!persistedState?.health) {
            persistedState.health = {};
          }
          if (!Array.isArray(persistedState.health.equipmentInventory) || persistedState.health.equipmentInventory.length === 0) {
            persistedState.health.equipmentInventory = defaultEquipment;
          }
        }
        return persistedState;
      },
      partialize: (state) => ({
        player: state.player,
        userProfile: state.userProfile,
        workShifts: state.workShifts,
        targetWakeTime: state.targetWakeTime,
        targetSleepTime: state.targetSleepTime,
        racha: state.racha,
        projects: state.projects,
        health: state.health,
        focusStatus: state.focusStatus,
        goals: state.goals,
        finances: state.finances,
        financesSummary: state.financesSummary,
        debts: state.debts,
        fixedExpenses: state.fixedExpenses,
        transactions: (state.transactions || []).map((t) => ({
          ...t,
          fecha: t.fecha instanceof Date ? t.fecha.toISOString() : t.fecha,
        })),
        weightHistory: (state.weightHistory || []).map((w) => ({
          ...w,
          timestamp: w.timestamp instanceof Date ? w.timestamp.toISOString() : w.timestamp,
        })),
        isDarkMode: state.isDarkMode,
      }),
    }
  )
);


