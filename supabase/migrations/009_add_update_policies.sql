-- =============================================================================
-- EL ESCUDO — Add missing UPDATE policies (defense in depth)
-- =============================================================================
-- Auditoría RLS detectó que 4 tablas carecían de policy UPDATE.
-- Aunque el backend no las usa vía UPDATE hoy, se añaden como
-- defensa en profundidad para prevenir acceso futuro indebido.
-- =============================================================================

CREATE POLICY p_push_tokens_update ON public.push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_achievements_update ON public.achievements
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_fitness_logs_update ON public.fitness_logs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY p_omni_recipes_update ON public.omni_recipes
  FOR UPDATE USING (user_id = auth.uid());
