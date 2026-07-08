alter table public.user_preferences
  add column if not exists gender text;

comment on column public.user_preferences.gender is 'men | women — used for search filtering';
