CREATE TABLE IF NOT EXISTS public.routines (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_index    SMALLINT     NOT NULL,
  day_name     TEXT         NOT NULL,
  exercises    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ  NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT routines_user_day_unique UNIQUE (user_id, day_index)
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_routines_select ON public.routines
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY p_routines_insert ON public.routines
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY p_routines_update ON public.routines
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY p_routines_delete ON public.routines
  FOR DELETE USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_routines_user_day ON public.routines(user_id, day_index);

