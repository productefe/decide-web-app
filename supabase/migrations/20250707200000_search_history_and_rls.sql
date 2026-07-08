-- DECIDE: user_preferences gender + search_history + RLS
-- Run once in Supabase SQL Editor (Dashboard → SQL → New query)

-- 1) Gender column for onboarding/profile
alter table public.user_preferences
  add column if not exists gender text;

comment on column public.user_preferences.gender is 'men | women — used for search filtering';

-- 2) Search history (geçmiş aramalar)
create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  photo_url text not null,
  results jsonb,
  created_at timestamptz not null default now()
);

create index if not exists search_history_user_created_idx
  on public.search_history (user_id, created_at desc);

alter table public.search_history enable row level security;

-- 3) RLS: search_history — users see & insert only their rows
drop policy if exists "search_history_select_own" on public.search_history;
create policy "search_history_select_own"
  on public.search_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "search_history_insert_own" on public.search_history;
create policy "search_history_insert_own"
  on public.search_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 4) RLS: user_preferences — ensure upsert works (skip if policies already exist)
alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own"
  on public.user_preferences
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own"
  on public.user_preferences
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own"
  on public.user_preferences
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
