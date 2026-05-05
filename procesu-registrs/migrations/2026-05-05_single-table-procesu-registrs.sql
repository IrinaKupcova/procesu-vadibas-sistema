-- Single-table migration: keep only procesu_registrs as business table.
-- Keeps auth/storage/system tables untouched; user_roles stays as requested.
-- Run in Supabase SQL editor inside a transaction.

begin;

-- 1) Add JSON column for catalog items on main table.
alter table if exists public.procesu_registrs
  add column if not exists catalog_items_json jsonb not null default '[]'::jsonb;

-- 2) Backfill catalog JSON from existing catalog table (if present).
do $$
declare
  has_catalog_table boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'Procesu_galaproduktu_veidu_katalogs'
  ) into has_catalog_table;

  if has_catalog_table then
    with cat as (
      select
        coalesce(c."Procesa_Nr.", c."Procesa_numurs", c."processNo", '') as proc_no,
        jsonb_agg(
          jsonb_build_object(
            'typeNo', coalesce(c."Procesa_galaprodukta_Nr.", c."Galaproduktu_veida_Nr.", ''),
            'type', coalesce(c."Procesa_galaprodukti", c."Galaprodukta_veids", ''),
            'unit', coalesce(c."Procesa_izpilditajs-patstaviga_strukturvieniba", c."Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu", ''),
            'department', coalesce(c."Daļa, nodaļa", c."Dala_nodala", ''),
            'taskNo', coalesce(c."Uzdevuma_Nr.", ''),
            'procNo', coalesce(c."Procesa_Nr.", c."Procesa_numurs", c."processNo", ''),
            'process', coalesce(c."Process", ''),
            'group', coalesce(c."Procesa_grupa", ''),
            'darbibasJoma', coalesce(c."Darbibas_joma", c."Joma_piesaiste_galaproduktam", ''),
            'sensitivity', coalesce(c."Sensitivitates_pakape", ''),
            'additionalInfo', coalesce(c."Papildu informācija", '')
          )
        ) as items
      from public."Procesu_galaproduktu_veidu_katalogs" c
      group by 1
    )
    update public.procesu_registrs p
    set catalog_items_json = coalesce(cat.items, '[]'::jsonb)
    from cat
    where coalesce(p."Procesa_numurs", p."Procesa_Nr.", p."processNo", '') = cat.proc_no;
  end if;
end $$;

-- 3) Optional cleanup: drop legacy catalog table after verification.
-- Comment this out if you want a rollback window.
drop table if exists public."Procesu_galaproduktu_veidu_katalogs";

commit;

