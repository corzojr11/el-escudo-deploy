-- Observabilidad minima por evento/modulo

create table if not exists public.observability_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  module text not null,
  event text not null,
  status text not null default 'ok',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_observability_events_user_created
  on public.observability_events(user_id, created_at desc);

create index if not exists idx_observability_events_module_event
  on public.observability_events(module, event, created_at desc);

alter table public.observability_events enable row level security;

drop policy if exists "observability_select_own" on public.observability_events;
create policy "observability_select_own"
on public.observability_events
for select
using (auth.uid() = user_id);

drop policy if exists "observability_insert_own" on public.observability_events;
create policy "observability_insert_own"
on public.observability_events
for insert
with check (auth.uid() = user_id);
