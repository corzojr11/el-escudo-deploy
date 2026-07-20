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
  equipment?: string[];
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
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  xp_reward?: number;
  category?: string;
  priority?: "high" | "medium" | "low";
  scheduled_at?: string;
  goal_id?: string;
  progress_increment?: number;
  progress_applied_at?: string;
  created_at?: string;
  updated_at?: string;
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

export interface ExerciseLog {
  id: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  sets: number;
  rpe: number;
  date?: string;
  created_at?: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_name: string;
  max_weight: number;
  date?: string;
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

export interface Achievement {
  id: string;
  user_id: string;
  name: string;
  unlocked_at?: string;
}

export type PersonalEntryKind = "idea" | "prayer" | "reading" | "discipline";

export interface PersonalEntry {
  id: string;
  user_id: string;
  kind: PersonalEntryKind;
  title: string;
  content: string;
  entry_date: string;
  data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface ProgressReport {
  period: "week" | "month";
  start_date: string;
  end_date: string;
  finances: {
    income: number;
    expense: number;
    balance: number;
    transaction_count: number;
    top_categories: Array<{ name: string; amount: number }>;
  };
  missions: { total: number; completed: number; pending: number };
  habits: { total: number; completions: number };
  health: { latest_weight: number | null; weight_logs: number };
  bitacora: { entries: number; by_kind: Record<string, number> };
}

export interface NutritionRecipe {
  name: string;
  calories: number;
  protein_g: number;
  prep_minutes: number;
  ingredients: string[];
  steps: string[];
  why: string;
}

export interface WellnessFactor {
  name: string;
  label: string;
  value: string;
  score: number | null;
  max: number;
}

export interface WellnessSummary {
  date: string;
  score: number;
  completeness: number;
  factors: WellnessFactor[];
  insight: string;
  action_route: string | null;
  action_label: string | null;
}

export interface FixedExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  due_date?: string;
  is_paid: boolean;
  created_at?: string;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  total: number;
  remaining: number;
  monthly_payment?: number;
  due_date?: string;
  notes?: string;
  status?: string;
  created_at?: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at?: string;
}

export interface ParsedTransaction {
  type: string;
  amount: number;
  description: string;
  category: string;
  fallback_mode?: string;
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

export interface OmniPatternInsight {
  activity_type: string;
  day_of_week: number;
  hour_of_day: number;
  confidence: number;
  insight: string;
}

export interface OmniPatternsResponse {
  patterns: OmniPatternInsight[];
  suggestion: string;
  next_predicted_action: string;
  next_predicted_time: string;
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
  is_rest_day?: boolean;
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
    financial_stability: {
      monthly_budget: number | null;
      month_expense: number | null;
      fixed_expenses: FixedExpense[];
      debts: Debt[];
    };
  };
}

export interface SleepWindow {
  cycles: number;
  hours: number;
  sleep_time: string;
  wake_time: string;
}

export interface WorkoutBlock {
  start: string;
  end: string;
  duration_min: number;
  label: string;
}

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;
  bed_time: string;
  wake_time: string;
  cycles: number;
  quality_score: number;
  notes: string;
}

export interface PlanDiarioResponse {
  date: string;
  shift_status: ShiftStatusResponse;
  sleep: {
    windows: SleepWindow[];
    fatigue_alert: string | null;
    recommended_cycles: number | null;
    wake_target: string;
    sleep_target: string;
    commute_minutes: number;
  };
  workout: WorkoutBlock | null;
  hydration_ml: number | null;
  sleep_logs_recent: SleepLog[];
  missing_config: string[];
  disclaimer: string;
}

export interface NutritionFavorite {
  id: string;
  name: string;
  recipe: NutritionRecipe;
  created_at?: string;
}

export interface NutritionMealPlanDay {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
}

export interface NutritionWeeklyPlan {
  id: string;
  week_start: string;
  days: NutritionMealPlanDay[];
}
