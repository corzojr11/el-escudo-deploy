/**
 * El Escudo — Shared TypeScript Types
 */

// Re-export all API types
export * from './api';

// ─── Message Types ──────────────────────────────────────────────────────────

export type MessageSender = 'user' | 'system';

export interface XPReward {
  amount: number;
  label?: string;
}

export interface LevelUp {
  newLevel: number;
  title?: string;
}

export interface Message {
  id: string;
  sender: MessageSender;
  text: string;
  timestamp: Date;
  xpReward?: XPReward;
  levelUp?: LevelUp;
  isError?: boolean;
}

// ─── Player / HUD Types ─────────────────────────────────────────────────────

export interface PlayerStats {
  level: number;
  xpCurrent: number;
  xpToNext: number;
  credits: number;
  title: string;
}

// ─── Dashboard Types ────────────────────────────────────────────────────────

export interface DashboardStats {
  player: PlayerStats;
  fisico: { current: number; max: number };
  saldo: number;
  tareasHoy: { done: number; total: number };
  racha: { days: number; activeDays: boolean[] };
}

// ─── Console Modal Types ─────────────────────────────────────────────────────

export type CategoryChip = 'Gasto' | 'Agenda' | 'Tarea' | 'Hábito' | 'Módulo';

export interface ConsolePreview {
  category: CategoryChip;
  confidence: number;
  title: string;
  description: string;
}

// ─── Console Types ──────────────────────────────────────────────────────────

export type ConsoleMode = 'command' | 'chat' | 'quest';

