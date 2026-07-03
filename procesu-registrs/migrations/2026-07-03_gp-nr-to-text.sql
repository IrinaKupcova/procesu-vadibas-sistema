-- Allow GP numbers in any format (e.g. "P1-1") by making the number columns text.
-- Run in Supabase SQL editor. Safe to re-run.
--
-- Note: the column is used by view "procesi_unified", so we drop the view,
-- alter the columns, then recreate the view from its captured definition.

begin;

do $$
declare
  v_def text;
  v_has_view boolean;
begin
  select exists (
    select 1 from pg_views
    where schemaname = 'public' and viewname = 'procesi_unified'
  ) into v_has_view;

  if v_has_view then
    select pg_get_viewdef('public.procesi_unified'::regclass, true) into v_def;
    execute 'drop view public.procesi_unified';
  end if;

  -- procesu_registrs: Procesa_galaprodukta_Nr. -> text
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'procesu_registrs'
      and column_name = 'Procesa_galaprodukta_Nr.'
      and data_type in ('integer', 'bigint', 'smallint', 'numeric')
  ) then
    alter table public.procesu_registrs
      alter column "Procesa_galaprodukta_Nr." type text
      using "Procesa_galaprodukta_Nr."::text;
  end if;

  -- procesu_registrs: Galaproduktu_veida_Nr. -> text (if present)
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'procesu_registrs'
      and column_name = 'Galaproduktu_veida_Nr.'
      and data_type in ('integer', 'bigint', 'smallint', 'numeric')
  ) then
    alter table public.procesu_registrs
      alter column "Galaproduktu_veida_Nr." type text
      using "Galaproduktu_veida_Nr."::text;
  end if;

  -- Legacy catalog table (if it still exists): make number columns text too.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'Procesu_galaproduktu_veidu_katalogs'
      and column_name = 'Procesa_galaprodukta_Nr.'
      and data_type in ('integer', 'bigint', 'smallint', 'numeric')
  ) then
    alter table public."Procesu_galaproduktu_veidu_katalogs"
      alter column "Procesa_galaprodukta_Nr." type text
      using "Procesa_galaprodukta_Nr."::text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'Procesu_galaproduktu_veidu_katalogs'
      and column_name = 'Galaproduktu_veida_Nr.'
      and data_type in ('integer', 'bigint', 'smallint', 'numeric')
  ) then
    alter table public."Procesu_galaproduktu_veidu_katalogs"
      alter column "Galaproduktu_veida_Nr." type text
      using "Galaproduktu_veida_Nr."::text;
  end if;

  -- Recreate the view exactly as it was.
  if v_has_view then
    execute 'create view public.procesi_unified as ' || v_def;
  end if;
end $$;

commit;
