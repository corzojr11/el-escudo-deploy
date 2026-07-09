-- =============================================================================
-- EL ESCUDO — Clans System v16
-- =============================================================================
-- Clanes (equipos), membresías y misiones grupales con RLS.
-- =============================================================================

-- ─── Clans ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clans (
  id              UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT            NOT NULL UNIQUE,
  tag             TEXT            UNIQUE,
  description     TEXT,
  color           TEXT            DEFAULT '#00D4FF',
  owner_player_id TEXT            NOT NULL REFERENCES public.profiles(player_id),
  total_xp        BIGINT          DEFAULT 0,
  member_count    INTEGER         DEFAULT 1,
  max_members     INTEGER         DEFAULT 20,
  created_at      TIMESTAMPTZ     DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_clans_select ON public.clans
  FOR SELECT USING (TRUE);

CREATE POLICY p_clans_insert ON public.clans
  FOR INSERT WITH CHECK (
    owner_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_clans_update ON public.clans
  FOR UPDATE USING (
    owner_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_clans_delete ON public.clans
  FOR DELETE USING (
    owner_player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_clans_total_xp   ON public.clans(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_clans_name       ON public.clans(name);

-- ─── Clan Members ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clan_members (
  id              UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  clan_id         UUID            NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  player_id       TEXT            NOT NULL REFERENCES public.profiles(player_id),
  role            TEXT            NOT NULL DEFAULT 'member'
                                      CHECK (role IN ('owner', 'admin', 'member')),
  joined_at       TIMESTAMPTZ     DEFAULT NOW(),
  contributed_xp  BIGINT          DEFAULT 0,
  UNIQUE(clan_id, player_id)
);

ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_clan_members_select ON public.clan_members
  FOR SELECT USING (
    player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    OR clan_id IN (
      SELECT cm.clan_id FROM public.clan_members cm
      WHERE cm.player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY p_clan_members_insert ON public.clan_members
  FOR INSERT WITH CHECK (
    player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY p_clan_members_update ON public.clan_members
  FOR UPDATE USING (
    clan_id IN (
      SELECT cm.clan_id FROM public.clan_members cm
      WHERE cm.player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY p_clan_members_delete ON public.clan_members
  FOR DELETE USING (
    player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    OR clan_id IN (
      SELECT cm.clan_id FROM public.clan_members cm
      WHERE cm.player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_clan_members_clan   ON public.clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_player ON public.clan_members(player_id);

-- ─── Clan Missions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clan_missions (
  id              UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
  clan_id         UUID            NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  name            TEXT            NOT NULL,
  description     TEXT,
  target_value    INTEGER         NOT NULL,
  current_value   INTEGER         DEFAULT 0,
  unit            TEXT            DEFAULT 'xp',
  xp_reward       INTEGER         DEFAULT 200,
  status          TEXT            DEFAULT 'active'
                                    CHECK (status IN ('active', 'completed', 'failed')),
  ends_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     DEFAULT NOW()
);

ALTER TABLE public.clan_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_clan_missions_select ON public.clan_missions
  FOR SELECT USING (
    clan_id IN (
      SELECT cm.clan_id FROM public.clan_members cm
      WHERE cm.player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY p_clan_missions_insert ON public.clan_missions
  FOR INSERT WITH CHECK (
    clan_id IN (
      SELECT cm.clan_id FROM public.clan_members cm
      WHERE cm.player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY p_clan_missions_update ON public.clan_missions
  FOR UPDATE USING (
    clan_id IN (
      SELECT cm.clan_id FROM public.clan_members cm
      WHERE cm.player_id = (SELECT player_id FROM public.profiles WHERE user_id = auth.uid())
        AND cm.role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_clan_missions_clan ON public.clan_missions(clan_id);
