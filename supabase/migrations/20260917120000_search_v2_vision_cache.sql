-- Optional persistent vision cache for Search V2
-- Apply in Supabase SQL editor or via migration tooling.

create table if not exists public.search_v2_vision_cache (
  image_hash text not null,
  extractor_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (image_hash, extractor_version)
);

create index if not exists search_v2_vision_cache_created_at_idx
  on public.search_v2_vision_cache (created_at desc);

alter table public.search_v2_vision_cache enable row level security;
-- Service role only — no public policies.
