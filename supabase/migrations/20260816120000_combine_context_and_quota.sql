-- Combine feature: persist analysis context + daily combines_used quota + analytics

-- 1) Context on search_history (nullable for legacy rows)
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'analysis_context' and n.nspname = 'public'
  ) then
    create type public.analysis_context as enum ('sport', 'casual', 'evening');
  end if;
end $$;

alter table public.search_history
  add column if not exists context public.analysis_context;

comment on column public.search_history.context is
  'Outfit context selected at analysis time: sport | casual | evening';

-- 2) Daily combine quota (separate from analysis rate limits)
create table if not exists public.combine_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  combines_used integer not null default 0,
  primary key (user_id, usage_date)
);

create index if not exists combine_daily_usage_user_date_idx
  on public.combine_daily_usage (user_id, usage_date desc);

alter table public.combine_daily_usage enable row level security;
revoke all on public.combine_daily_usage from authenticated, anon, public;

-- Returns true if under daily limit and increments combines_used
create or replace function public.try_consume_combine(p_daily_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := (timezone('utc', now()))::date;
begin
  if v_uid is null then
    return false;
  end if;

  insert into public.combine_daily_usage (user_id, usage_date, combines_used)
  values (v_uid, v_date, 0)
  on conflict (user_id, usage_date) do nothing;

  update public.combine_daily_usage
  set combines_used = combines_used + 1
  where user_id = v_uid
    and usage_date = v_date
    and combines_used < p_daily_limit;

  return found;
end;
$$;

revoke all on function public.try_consume_combine(integer) from public, anon;
grant execute on function public.try_consume_combine(integer) to authenticated;

-- 3) Lightweight analytics events (server + authenticated clients)
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  event_name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "analytics_events_insert_own" on public.analytics_events;
create policy "analytics_events_insert_own"
  on public.analytics_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No client select needed for v1
revoke select on public.analytics_events from authenticated, anon, public;
grant insert on public.analytics_events to authenticated;
