-- Beğendiklerin (saved products)
create table if not exists public.saved_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  price text not null default '',
  source text not null default '',
  image text not null default '',
  link text not null,
  store text,
  piece_label text,
  slot text,
  created_at timestamptz not null default now(),
  unique (user_id, link)
);

create index if not exists saved_products_user_created_idx
  on public.saved_products (user_id, created_at desc);

alter table public.saved_products enable row level security;

drop policy if exists "saved_products_select_own" on public.saved_products;
create policy "saved_products_select_own"
  on public.saved_products
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_products_insert_own" on public.saved_products;
create policy "saved_products_insert_own"
  on public.saved_products
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_products_delete_own" on public.saved_products;
create policy "saved_products_delete_own"
  on public.saved_products
  for delete
  to authenticated
  using (auth.uid() = user_id);
