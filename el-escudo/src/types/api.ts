/**
 * El Escudo — API Response Types
 * Mirrors backend Pydantic models and /api/v1/sync response shape.
 * All field names use snake_case to match backend JSON exactly.
 */

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  limit: number;
  offset: number;
  total?: number;
}

// ─── Auth / Profile ─────────────────────────────────────────────────────────

export interface UserProfileResponse {
  id: string;
  name: string;
  email?: string;
  age: number;
  weight: number;
  height: number;
  goal: string;
  location?: string;
  target_weight?: number;
  avatar_url?: string;
  push_token?: string;
  notifications_enabled?: boolean;
  level?: number;
  xp?: number;
  current_xp?: number;
  ai_cost_cop?: number;
}

export interface SessionResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
}

// ─── Finances ────────────────────────────────────────────────────────────────

export interface FinanceTransaction {
  id: string;
  user_id: string;
  amount: number;
  description: string;
  category: string;
  tipo?: 'INGRESO' | 'GASTO';
  timestamp: string;
  created_at?: string;
}

export interface FinanceSummary {
  saldo: number;
  monthly_income: number;
  monthly_expenses: number;
}

export interface FinanceListResponse {
  data: FinanceTransaction[];
  limit: number;
  offset: number;
}

// ─── Habits ──────────────────────────────────────────────────────────────────

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  completed_dates: string[];
  created_at: string;
  updated_at: string;
}

export type HabitListResponse = PaginatedResponse<Habit>;

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_value: number;
  current_value: number;
  unit: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  goal_type?: string;
  created_at: string;
  updated_at: string;
  recent_metrics?: MetricRecord[];
}

export interface MetricRecord {
  id: string;
  goal_id: string;
  user_id: string;
  value: number;
  unit?: string;
  recorded_at: string;
  note?: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  title: string;
  description: string;
  icon?: string;
  unlocked_at: string;
}

export type GoalListResponse = PaginatedResponse<Goal>;

// ─── Schedule / Shifts ───────────────────────────────────────────────────────

export interface WorkShift {
  id: string;
  user_id: string;
  day: string;
  start: string;
  end: string;
  created_at?: string;
}

export interface RoutineExercise {
  name: string;
  suggestedSets: number;
  suggestedReps: string;
  equipment?: string[];
  muscles?: string[];
}

export interface RoutineDayRow {
  id: string;
  user_id: string;
  day_index: number;
  day_name: string;
  exercises: RoutineExercise[];
  objective?: string | null;
  estimated_minutes?: number | null;
  notes?: string[] | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SleepAnalysis {
  avg_hours: number;
  sleep_debt: number;
  consistency: number;
  logs: SleepLog[];
}

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;
  sleep_time: string;
  wake_time: string;
  hours: number;
  quality?: number;
}

export interface MealPlan {
  id: string;
  user_id: string;
  date: string;
  meals: MealItem[];
  total_calories?: number;
  total_protein?: number;
}

export interface MealItem {
  type: string;
  name: string;
  time: string;
  calories?: number;
  protein?: number;
  ingredients?: string[];
}

export type ShiftListResponse = PaginatedResponse<WorkShift>;

// ─── Health / Weight ─────────────────────────────────────────────────────────

export interface WeightLog {
  id: string;
  user_id: string;
  weight: number;
  timestamp: string;
  created_at?: string;
}

export interface WeightLogListResponse {
  data: WeightLog[];
  limit: number;
  offset: number;
  logs?: WeightLog[];
}

export interface ExerciseLog {
  id: string;
  user_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  sets: number;
  rpe: number;
  date: string;
  created_at?: string;
}

export interface PersonalRecord {
  id: string;
  user_id: string;
  exercise_name: string;
  max_weight: number;
  date: string;
  created_at?: string;
}

export interface HealthStatsResponse {
  weight: number;
  height: number;
  target_weight?: number;
  exercise_logs: ExerciseLog[];
  personal_records: PersonalRecord[];
}

// ─── Moods ───────────────────────────────────────────────────────────────────

export interface Mood {
  id: string;
  user_id: string;
  score: number;
  note?: string;
  tags?: string[];
  recorded_at: string;
}

export type MoodListResponse = PaginatedResponse<Mood>;

// ─── Bio Settings ────────────────────────────────────────────────────────────

export interface BioSettings {
  id: string;
  user_id: string;
  chronotype?: string;
  t_wake_target?: string;
  t_sleep_target?: string;
  cycle_duration?: number;
  target_weight?: number;
  sleep_debt_hours: number;
  target_sleep_hours: number;
  target_wake_time?: string;
  t_last_meal?: string | null;
  t_last_caffeine?: string | null;
  sunlight_offset?: number;
  hydration_goal_ml: number;
  calorie_goal?: number;
  protein_goal?: number;
  updated_at: string;
}

// ─── OMNI / AI ───────────────────────────────────────────────────────────────

export interface OmniMessage {
  id: string;
  user_id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface OmniMessageListResponse {
  data: OmniMessage[];
  limit: number;
  offset: number;
  messages?: OmniMessage[];
}

export interface OmniRecipe {
  id: string;
  user_id: string;
  name: string;
  command_sequence: string;
  description?: string;
  icon?: string;
  color?: string;
  created_at: string;
}

export interface OmniRecipeListResponse {
  data: OmniRecipe[];
  limit: number;
  offset: number;
  recipes?: OmniRecipe[];
}

export interface OmniAction {
  type: string;
  description: string;
  command: string;
}

export interface ProcessCommandResponse {
  intent: string;
  mensaje_sistema: string;
  respuesta_usuario?: string;
  extracted_data: Record<string, unknown>;
  xp_ganada: number;
  interaction_cost_cop: number;
  current_trm: number;
  executed?: boolean;
  multi_intent?: boolean;
  actions?: OmniAction[];
  requires_confirmation?: boolean;
}

export interface OmniSuggestion {
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  action?: string;
}

export interface AgentCheckResponse {
  suggestions: OmniSuggestion[];
  checked_at?: string;
}

export interface OmniUsageResponse {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  cost_cop: number;
  trm: number;
}

// ─── Missions / Projects ─────────────────────────────────────────────────────

export interface Mission {
  id: string;
  user_id: string;
  name?: string;
  title?: string;
  description?: string;
  status: 'active' | 'completed' | 'completado' | 'paused';
  category?: string;
  priority?: 'high' | 'medium' | 'low';
  scheduled_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type MissionListResponse = PaginatedResponse<Mission>;

// ─── Sync Response (consolidated /api/v1/sync) ───────────────────────────────

export interface SyncResponse {
  profile: UserProfileResponse | null;
  finances: FinanceTransaction[];
  missions: Mission[];
  shifts: WorkShift[];
  routines?: RoutineDayRow[];
  weight_logs: WeightLog[];
  exercise_logs?: ExerciseLog[];
  personal_records?: PersonalRecord[];
  sleep_logs?: SleepLog[];
  debts: unknown[];
  fixed_expenses: unknown[];
  focus_status?: {
    focus_streak: number;
    focus_best: number;
    urge_count: number;
    last_check_date?: string | null;
  } | null;
  goals: Goal[];
  bio_settings: BioSettings | null;
  daily_quote?: string;
  usage: OmniUsageResponse;
}

// ─── Error Response ──────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  detail: string;
}

// ─── Auth / Password Reset ─────────────────────────────────────────────────

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
  dev_code?: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  name: string;
  level: number;
  xp: number;
  avatar_url?: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  limit: number;
  offset: number;
  total: number;
}

export interface NearbyPlayer {
  rank: number;
  player_id: string;
  name: string;
  level: number;
  xp: number;
  avatar_url?: string;
  is_me: boolean;
}

export interface PersonalRankResponse {
  rank: number;
  total_users: number;
  player_id: string;
  name: string;
  level: number;
  xp: number;
  next_milestone: number;
  nearby_players: NearbyPlayer[];
}

// ─── Challenges ──────────────────────────────────────────────────────────────

export interface ChallengeTemplate {
  id: string;
  name: string;
  description?: string;
  category: 'habits' | 'weight' | 'exercise' | 'finance' | 'omni';
  target_value?: number;
  target_unit?: string;
  duration_days: number;
  xp_reward: number;
}

export interface ChallengeTemplateListResponse {
  templates: ChallengeTemplate[];
}

export interface PlayerInfo {
  player_id: string;
  name: string;
}

export interface ChallengeProgressEntry {
  player_id: string;
  name: string;
  current_value: number;
  completed: boolean;
}

export interface ChallengeResponse {
  id: string;
  template?: ChallengeTemplate;
  challenger: PlayerInfo;
  challenged: PlayerInfo;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed' | 'cancelled';
  winner_player_id?: string;
  started_at?: string;
  ends_at?: string;
  created_at: string;
}

export interface ChallengeDetailResponse extends ChallengeResponse {
  progress: ChallengeProgressEntry[];
}

export interface ProgressUpdateResponse {
  player_id: string;
  current_value: number;
  completed: boolean;
  challenge_status: string;
}

export interface ActiveChallengesResponse {
  challenges: ChallengeResponse[];
}

export interface ChallengeCreateRequest {
  template_id: string;
  challenged_player_id: string;
}

// ─── Clans ─────────────────────────────────────────────────────────────────

export interface ClanSummary {
  id: string;
  name: string;
  tag?: string;
  description?: string;
  color: string;
  total_xp: number;
  member_count: number;
  max_members: number;
}

export interface ClanMember {
  player_id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  joined_at?: string;
  contributed_xp: number;
}

export interface ClanMission {
  id: string;
  name: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit: string;
  xp_reward: number;
  status: 'active' | 'completed' | 'failed';
  ends_at?: string;
}

export interface ClanDetailResponse extends ClanSummary {
  members: ClanMember[];
  missions: ClanMission[];
}

export interface ClanCreateRequest {
  name: string;
  tag?: string;
  description?: string;
  color?: string;
}

export interface ClanListResponse {
  clans: ClanSummary[];
  limit: number;
  offset: number;
  total: number;
}

export interface MyClanResponse {
  clan: ClanSummary | null;
}

export interface ClanKickRequest {
  player_id: string;
}

export interface ClanMissionCreateRequest {
  name: string;
  description?: string;
  target_value: number;
  unit?: string;
  xp_reward?: number;
  ends_at?: string;
}

export interface MissionProgressRequest {
  value: number;
}

export interface MissionProgressResponse {
  current_value: number;
  status: string;
  xp_distributed?: number;
  members_rewarded?: number;
  total_xp_added?: number;
}


