alter table public.user_preferences
  add column if not exists sizes jsonb default '[]'::jsonb;

comment on column public.user_preferences.sizes is 'User clothing sizes e.g. ["M","L"] — used for search scoring boost';
