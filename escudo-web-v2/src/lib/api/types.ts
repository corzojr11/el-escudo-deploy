export interface Profile {
  user_id: string;
  name?: string;
  level?: number;
  xp?: number;
  xp_to_next_level?: number;
  player_id?: string;
  streak?: number;
  title?: string;
  ai_cost_cop?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FinanceEntry {
  id: string;
  user_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  description?: string;
  date: string;
  created_at?: string;
}

export interface Mission {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: number;
  schedule_date?: string;
  created_at?: string;
}

export interface WorkShift {
  id: string;
  user_id: string;
  day: string;
  start: string;
  end: string;
}

export type Shift = WorkShift;

export interface ShiftListResponse {
  shifts: Shift[];
}

export interface CurrentShift {
  day: string;
  start: string;
  end: string;
  remaining_hours: number;
}

export interface NextShift {
  day: string;
  start: string;
  end: string;
  starts_in_hours: number;
}

export interface CurrentStatusResponse {
  status: "in_shift" | "free";
  shift?: CurrentShift;
  next_shift?: NextShift;
  message_short: string;
}

export interface CreateShiftPayload {
  day: string;
  start: string;
  end: string;
}

export interface CreateShiftResponse {
  shift: Shift;
}

export interface WeightLog {
  id: string;
  user_id: string;
  weight: number;
  date?: string;
  timestamp?: string;
  created_at?: string;
  notes?: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  goal_type?: string;
  status?: string;
  target_value?: number;
  unit?: string;
  current_value?: number;
  deadline?: string;
  priority?: number;
  created_at?: string;
  recent_metrics?: Metric[];
  latest_metric?: Metric | null;
}

export interface Metric {
  id: string;
  goal_id: string;
  user_id: string;
  value: number;
  unit?: string;
  recorded_at: string;
}

export interface FocusStatus {
  id: string;
  user_id: string;
  current_streak?: number;
  status?: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  frequency: "daily" | "weekly";
  streak?: number;
  completed_dates?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface FinanceSummaryItem {
  category: string;
  total: number;
}

export interface FinanceSummaryResponse {
  summary: FinanceSummaryItem[];
}

export interface BioSettings {
  user_id: string;
  wake_time?: string;
  sleep_time?: string;
  work_start?: string;
  work_end?: string;
}

export interface OmniCommandResult {
  intent: string;
  extracted_data?: Record<string, unknown>;
  respuesta_usuario?: string;
  mensaje_sistema?: string;
  xp_ganada?: number;
  interaction_cost_cop?: number;
  current_trm?: number;
}

export interface OmniMultiIntentResult {
  multi_intent: true;
  actions: OmniCommandResult[];
  requires_confirmation: boolean;
}

export type OmniResponse = OmniCommandResult | OmniMultiIntentResult;

export interface OmniMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface OmniMessagesResponse {
  data: OmniMessage[];
  limit: number;
  offset: number;
}

export interface OmniUsageResponse {
  daily_cost: number;
  limit: number;
  remaining: number;
}

export interface SyncResponse {
  profile: Profile;
  finances: FinanceEntry[];
  missions: Mission[];
  shifts: WorkShift[];
  routines: unknown[];
  weight_logs: WeightLog[];
  exercise_logs: unknown[];
  personal_records: unknown[];
  sleep_logs: unknown[];
  debts: unknown[];
  fixed_expenses: unknown[];
  focus_status: FocusStatus | null;
  goals: Goal[];
  bio_settings: BioSettings | null;
  daily_quote: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    cost_cop: number;
    trm: number;
  };
}
