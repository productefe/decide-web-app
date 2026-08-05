alter table public.user_preferences
  add column if not exists price_mode text default 'karma';

alter table public.user_preferences
  drop constraint if exists user_preferences_price_mode_check;

alter table public.user_preferences
  add constraint user_preferences_price_mode_check
  check (price_mode is null or price_mode in ('luks', 'uygunluk', 'karma'));

comment on column public.user_preferences.price_mode is
  'Shopping price preference: luks | uygunluk | karma';

update public.user_preferences
set price_mode = 'karma'
where price_mode is null;
