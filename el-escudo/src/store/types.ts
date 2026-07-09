// Re-export backend-matching types from api.ts
export {
  Goal,
  WorkShift,
  Mission,
} from '../types/api';

// Frontend-only types (not from backend)
export interface Project {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: 'active' | 'completed';
  priority?: 'high' | 'medium' | 'low';
  scheduledAt?: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  completed: boolean;
  xpReward: number;
  scheduledAt?: string;
}

export interface ActionLog {
  id: string;
  text: string;
  category: string;
  timestamp: Date;
  costCOP?: number;
  currentTRM?: number;
}

export interface UserProfile {
  name: string;
  age: number;
  weight: number;
  height: number;
  goal: string;
  location?: string;
  targetWeight?: number;
  avatar_url?: string;
  pushToken?: string;
  notificationsEnabled?: boolean;
}

export interface SleepWindow {
  sleepTime: string;
  wakeTime: string;
  cycles: number;
  hours: number;
  durationMinutes?: number;
  latencyMinutes?: number;
  cycleMinutes?: number;
  score?: number;
  label?: string;
  recommended?: boolean;
}

export interface Meal {
  type: string;
  name: string;
  time: string;
  ingredients: string[];
  instructions: string;
}
