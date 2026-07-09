ALTER TABLE public.missions
ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NULL;

ALTER TABLE public.missions
DROP CONSTRAINT IF EXISTS missions_priority_check;

ALTER TABLE public.missions
ADD CONSTRAINT missions_priority_check
CHECK (priority IN ('high', 'medium', 'low'));

UPDATE public.missions
SET priority = LOWER((regexp_match(description, '\[\[priority:(high|medium|low)\]\]', 'i'))[1])
WHERE description ~* '\[\[priority:(high|medium|low)\]\]';

CREATE INDEX IF NOT EXISTS idx_missions_user_priority ON public.missions(user_id, priority);
CREATE INDEX IF NOT EXISTS idx_missions_user_scheduled_at ON public.missions(user_id, scheduled_at);
