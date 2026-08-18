-- Outfit context: Ev (home) and İş (work). PG 15 allows ADD VALUE inside a transaction.
alter type public.analysis_context add value if not exists 'home';
alter type public.analysis_context add value if not exists 'work';

comment on column public.search_history.context is
  'Outfit context: sport | casual | evening | home | work';
