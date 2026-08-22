-- Outfit context: Sahil (beach)
alter type public.analysis_context add value if not exists 'beach';

comment on column public.search_history.context is
  'Outfit context: sport | casual | evening | home | work | beach';
