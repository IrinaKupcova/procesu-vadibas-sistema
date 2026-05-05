  -- Single-table migration plan (process registry as primary table)
  -- Target: keep public.procesu_registrs (+ public.user_roles), retire separate catalog table usage.
  -- Run in Supabase SQL editor, step by step.

  begin;

  -- 1) Safety backup of current catalog table (if exists)
  create table if not exists public.procesu_galaproduktu_veidu_katalogs_backup as
  select * from public."Procesu_galaproduktu_veidu_katalogs";

  -- 2) Ensure optional JSON column exists on process table for future catalog metadata
  alter table public.procesu_registrs
    add column if not exists gp_katalogs_json jsonb not null default '[]'::jsonb;

  -- 3) Seed JSON metadata from catalog table into process rows (by process number)
  with catalog_src as (
    select
      coalesce(
        to_jsonb(c)->>'Procesa_Nr.',
        to_jsonb(c)->>'Procesa_numurs',
        to_jsonb(c)->>'processNo',
        ''
      ) as proc_no,
      jsonb_agg(
        jsonb_build_object(
          'typeNo', coalesce(
            to_jsonb(c)->>'Procesa_galaprodukta_Nr.',
            to_jsonb(c)->>'Galaproduktu_veida_Nr.',
            ''
          ),
          'type', coalesce(
            to_jsonb(c)->>'Procesa_galaprodukti',
            to_jsonb(c)->>'Galaprodukta_veids',
            ''
          ),
          'unit', coalesce(
            to_jsonb(c)->>'Procesa_izpilditajs-patstaviga_strukturvieniba',
            to_jsonb(c)->>'Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu',
            ''
          ),
          'department', coalesce(
            to_jsonb(c)->>'Daļa, nodaļa',
            to_jsonb(c)->>'Dala_nodala',
            ''
          ),
          'joma', coalesce(
            to_jsonb(c)->>'Darbibas_joma',
            to_jsonb(c)->>'Joma_piesaiste_galaproduktam',
            ''
          ),
          'additionalInfo', coalesce(to_jsonb(c)->>'Papildu informācija', '')
        )
      ) as items
    from public."Procesu_galaproduktu_veidu_katalogs" c
    group by 1
  )
  update public.procesu_registrs p
  set gp_katalogs_json = coalesce(c.items, '[]'::jsonb)
  from catalog_src c
  where coalesce(
      to_jsonb(p)->>'Procesa_Nr.',
      to_jsonb(p)->>'Procesa_numurs',
      to_jsonb(p)->>'processNo',
      ''
    ) = c.proc_no
    and c.proc_no <> '';

  commit;

  -- 4) Optional cleanup choices (run ONE option after verification):
  -- A) Hide old table from app usage only (recommended first):
  --    revoke all on table public."Procesu_galaproduktu_veidu_katalogs" from anon, authenticated;
  --
  -- B) Rename old table so app/devs see it as archived:
  --    alter table public."Procesu_galaproduktu_veidu_katalogs"
  --      rename to "_archived_Procesu_galaproduktu_veidu_katalogs";
  --
  -- C) Drop old table permanently (only when fully verified):
  --    drop table if exists public."Procesu_galaproduktu_veidu_katalogs";
