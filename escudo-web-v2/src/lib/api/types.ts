export interface Profile {
  user_id: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  level?: number;
  xp?: number;
  xp_to_next_level?: number;
  player_id?: string;
  streak?: number;
  title?: string;
  ai_cost_cop?: number;
  created_at?: string;
  updated_at?: string;
  birth_date?: string;
  height_cm?: number;
  health_goal?: "ganar_musculo" | "perder_grasa" | "energia_bienestar";
  onboarding_completed_at?: string;
}

export interface FinanceEntry {
  id: string;
  user_id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  description?: string;
  date: string;
  timestamp?: string;
  idempotency_key?: string;
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
  focus_streak?: number;
  focus_best?: number;
  urge_count?: number;
  last_check_date?: string;
  updated_at?: string;
  created_at?: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  frequency: "daily" | "weekly";
  streak?: number;
  completed_dates?: string[];
  completed_today?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FinanceSummaryItem {
  category: string;
  total: number;
}

export interface FinanceSummaryResponse {
  summary: FinanceSummaryItem[];
  total_income: number;
  total_expense: number;
  balance: number;
}

export interface BioSettings {
  user_id: string;
  wake_time?: string;
  sleep_time?: string;
  work_start?: string;
  work_end?: string;
}

export interface RoutineExercise {
  name: string;
  suggestedSets?: number;
  suggestedReps?: string;
  equipment?: string[];
  muscles?: string[];
}

export interface Routine {
  id: string;
  user_id: string;
  day_index: number;
  day_name: string;
  objective?: string;
  estimated_minutes?: number;
  notes?: string[];
  exercises: RoutineExercise[];
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
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

export interface OmniQueryResponse {
  kind: "response";
  multi_intent?: boolean;
  actions?: OmniCommandResult[];
  response: string;
  cost_cop?: number;
  current_trm?: number;
  is_error?: boolean;
}

export interface OmniProposalResponse {
  kind: "proposal";
  proposal_id: string;
  multi_intent: boolean;
  requires_confirmation: true;
  command: string;
  preview: string;
  actions: OmniCommandResult[];
  cost_cop?: number;
  current_trm?: number;
  expires_at?: string;
}

export interface OmniConfirmResult {
  kind: "result";
  proposal_id: string;
  already_executed: boolean;
  result: {
    actions: OmniCommandResult[];
    errors: string[];
    xp_ganada: number;
    response: string;
    success: boolean;
  };
}

export interface OmniProcessingResponse {
  kind: "processing";
  proposal_id: string;
  message: string;
}

export type OmniResponse =
  | OmniQueryResponse
  | OmniProposalResponse
  | OmniConfirmResult
  | OmniProcessingResponse;

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
  routines: Routine[];
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

export type FinanceRange = "all" | "today" | "week" | "month";

export interface ShiftStatusResponse {
  status: "in_shift" | "free";
  shift?: CurrentShift;
  next_shift?: NextShift;
  message_short: string;
}

export interface TodayResponse {
  profile: Profile;
  today: {
    date: string;
    balance: number;
    finances: FinanceEntry[];
    shift_status: ShiftStatusResponse;
    active_goals: Goal[];
    missions_today: Mission[];
    latest_weight: WeightLog | null;
    weight_trend: number | null;
    habits_today: Habit[];
    focus_streak: number;
    hydration_ml: number | null;
  };
}
