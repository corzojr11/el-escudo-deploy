-- =============================================================================
-- EL ESCUDO — Reminder Patterns v17
-- =============================================================================
-- Patrones de actividad del usuario y recordatorios push proactivos.
-- =============================================================================

-- ─── User Activity Patterns ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_activity_patterns (
  id                UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type     TEXT            NOT NULL
                      CHECK (activity_type IN ('weight_log','habit_check','exercise_log','finance_log','omni_use','mood_log')),
  day_of_week       INTEGER         NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day       INTEGER         NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  frequency         INTEGER         DEFAULT 0,
  confidence        DECIMAL(3,2)    DEFAULT 0.0,
  enabled           BOOLEAN         DEFAULT TRUE,
  last_calculated_at TIMESTAMPTZ    DEFAULT NOW(),
  UNIQUE(user_id, activity_type, day_of_week, hour_of_day)
);

ALTER TABLE public.user_activity_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_patterns_select ON public.user_activity_patterns
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_patterns_insert ON public.user_activity_patterns
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY p_patterns_update ON public.user_activity_patterns
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_patterns_delete ON public.user_activity_patterns
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_patterns_user_activity
  ON public.user_activity_patterns(user_id, activity_type);

-- ─── Reminder Schedules ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reminder_schedules (
  id              UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type   TEXT            NOT NULL,
  scheduled_at    TIMESTAMPTZ     NOT NULL,
  sent            BOOLEAN         DEFAULT FALSE,
  created_at      TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.reminder_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_schedules_select ON public.reminder_schedules
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_schedules_insert ON public.reminder_schedules
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY p_schedules_update ON public.reminder_schedules
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_schedules_delete ON public.reminder_schedules
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_schedules_user_sent
  ON public.reminder_schedules(user_id, sent) WHERE sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at
  ON public.reminder_schedules(scheduled_at);
