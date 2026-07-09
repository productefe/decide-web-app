-- Security hardening: profiles RLS, storage policies, anonymous write limits, API rate limits

-- 1) profiles table + RLS
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2) Storage: product-photos — users only access their folder
drop policy if exists "product_photos_insert_own" on storage.objects;
create policy "product_photos_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_photos_select_own" on storage.objects;
create policy "product_photos_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_photos_delete_own" on storage.objects;
create policy "product_photos_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Block anonymous INSERT on search_history and saved_products
drop policy if exists "search_history_insert_own" on public.search_history;
create policy "search_history_insert_own"
  on public.search_history
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );

drop policy if exists "saved_products_insert_own" on public.saved_products;
create policy "saved_products_insert_own"
  on public.saved_products
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false
  );

-- 4) API rate limiting
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  unique (user_id, endpoint, window_start)
);

create index if not exists api_usage_user_endpoint_idx
  on public.api_usage (user_id, endpoint, window_start desc);

alter table public.api_usage enable row level security;

-- No direct client access; only security definer functions
revoke all on public.api_usage from authenticated, anon, public;

-- 5) Guest one-time analysis cap
create table if not exists public.guest_analysis_usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  used_at timestamptz not null default now()
);

alter table public.guest_analysis_usage enable row level security;
revoke all on public.guest_analysis_usage from authenticated, anon, public;

-- Returns true if request is allowed (increments counter when allowed)
create or replace function public.increment_api_usage(
  p_endpoint text,
  p_limit integer,
  p_window_minutes integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );

  insert into public.api_usage as u (user_id, endpoint, window_start, request_count)
  values (auth.uid(), p_endpoint, v_window_start, 1)
  on conflict (user_id, endpoint, window_start)
  do update set request_count = u.request_count + 1
  returning u.request_count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Returns true if guest may run analysis (consumes slot on first call)
create or replace function public.try_consume_guest_analysis()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) = false then
    return true;
  end if;

  if exists (
    select 1 from public.guest_analysis_usage where user_id = auth.uid()
  ) then
    return false;
  end if;

  insert into public.guest_analysis_usage (user_id) values (auth.uid());
  return true;
end;
$$;

grant execute on function public.increment_api_usage(text, integer, integer) to authenticated;
grant execute on function public.try_consume_guest_analysis() to authenticated;
