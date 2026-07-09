-- 019_add_performance_indexes.sql

-- Finanzas
CREATE INDEX IF NOT EXISTS idx_finances_user_id ON finances(user_id);
CREATE INDEX IF NOT EXISTS idx_finances_timestamp ON finances(user_id, timestamp DESC);

-- Metas
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);

-- Métricas
CREATE INDEX IF NOT EXISTS idx_metrics_goal_id ON metrics(goal_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id);

-- Misiones
CREATE INDEX IF NOT EXISTS idx_missions_user_status ON missions(user_id, status);

-- Hábitos
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);

-- Mensajes OMNI
CREATE INDEX IF NOT EXISTS idx_omni_messages_user ON omni_messages(user_id, created_at DESC);

-- Turnos
CREATE INDEX IF NOT EXISTS idx_shifts_user_day ON shifts(user_id, day);

-- Patrones de actividad
CREATE INDEX IF NOT EXISTS idx_activity_patterns_user ON user_activity_patterns(user_id, enabled, confidence DESC);
