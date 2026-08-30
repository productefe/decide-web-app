-- Public contact form submissions (AWS / marketing site).
-- Writes only via service_role from POST /api/contact — no anon/authenticated insert.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from authenticated, anon, public;
grant select, insert on public.contact_messages to service_role;
