-- Estado sincronizado del modo Enfoque (discreto).
-- Permite continuidad entre dispositivos para racha/impulsos.

create table if not exists public.focus_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  focus_streak int not null default 0,
  focus_best int not null default 0,
  urge_count int not null default 0,
  last_check_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.focus_status enable row level security;

create policy "focus_status_select_own"
on public.focus_status
for select
using (auth.uid() = user_id);

create policy "focus_status_insert_own"
on public.focus_status
for insert
with check (auth.uid() = user_id);

create policy "focus_status_update_own"
on public.focus_status
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
