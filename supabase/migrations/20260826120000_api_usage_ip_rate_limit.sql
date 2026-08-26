-- IP rate limit for expensive DECIDE endpoints (decide / more / combine).
-- Counted by SHA-256 hash of the client IP; raw addresses are never stored.
-- Increment is service_role only so the hash cannot be spoofed from the client.

create table if not exists public.api_usage_ip (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  endpoint text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  unique (ip_hash, endpoint, window_start)
);

create index if not exists api_usage_ip_hash_endpoint_idx
  on public.api_usage_ip (ip_hash, endpoint, window_start desc);

alter table public.api_usage_ip enable row level security;
revoke all on public.api_usage_ip from authenticated, anon, public;

create or replace function public.increment_api_usage_ip(
  p_ip_hash text,
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
  if p_ip_hash is null or length(trim(p_ip_hash)) < 16 then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );

  insert into public.api_usage_ip as u (ip_hash, endpoint, window_start, request_count)
  values (trim(p_ip_hash), p_endpoint, v_window_start, 1)
  on conflict (ip_hash, endpoint, window_start)
  do update set request_count = u.request_count + 1
  returning u.request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.increment_api_usage_ip(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.increment_api_usage_ip(text, text, integer, integer)
  to service_role;
