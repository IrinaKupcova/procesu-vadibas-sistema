-- Migrācija: GP joma + saglabāšanas lauku savietojamība
-- Palaist Supabase SQL Editor vidē.

DO $$
BEGIN
  -- GP katalogs (varianti ar atšķirīgiem tabulu nosaukumiem)
  IF to_regclass('public."Procesu_galaproduktu_veidu_katalogs"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."Procesu_galaproduktu_veidu_katalogs" ADD COLUMN IF NOT EXISTS "Joma_piesaiste_galaproduktam" text';
    EXECUTE 'ALTER TABLE public."Procesu_galaproduktu_veidu_katalogs" ADD COLUMN IF NOT EXISTS "Darbibas_joma" text';
  END IF;

  IF to_regclass('public.procesu_galaproduktu_veidu_katalogs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.procesu_galaproduktu_veidu_katalogs ADD COLUMN IF NOT EXISTS "Joma_piesaiste_galaproduktam" text';
    EXECUTE 'ALTER TABLE public.procesu_galaproduktu_veidu_katalogs ADD COLUMN IF NOT EXISTS "Darbibas_joma" text';
  END IF;

  -- Procesu reģistrs: nodrošina, ka saglabāšana nekļūdās arī ar "daļa/joma" laukiem
  IF to_regclass('public.procesu_registrs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.procesu_registrs ADD COLUMN IF NOT EXISTS "Strukturvieniba_dala" text';
    EXECUTE 'ALTER TABLE public.procesu_registrs ADD COLUMN IF NOT EXISTS "Darbibas_joma" text';
  END IF;
END $$;

-- RLS politikas, lai WEB lietotājs var lasīt/saglabāt.
-- Ja gribat stingrāku drošību, vēlāk var sašaurināt ar nosacījumiem.
DO $$
BEGIN
  IF to_regclass('public.procesu_registrs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.procesu_registrs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "pv_select_all_registrs" ON public.procesu_registrs';
    EXECUTE 'DROP POLICY IF EXISTS "pv_insert_all_registrs" ON public.procesu_registrs';
    EXECUTE 'DROP POLICY IF EXISTS "pv_update_all_registrs" ON public.procesu_registrs';
    EXECUTE 'DROP POLICY IF EXISTS "pv_delete_all_registrs" ON public.procesu_registrs';
    EXECUTE 'CREATE POLICY "pv_select_all_registrs" ON public.procesu_registrs FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "pv_insert_all_registrs" ON public.procesu_registrs FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_update_all_registrs" ON public.procesu_registrs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_delete_all_registrs" ON public.procesu_registrs FOR DELETE TO anon, authenticated USING (true)';
  END IF;

  -- Dažos projektos tabula var būt ar citādu reģistru (quoted nosaukums).
  IF to_regclass('public."Procesu_registrs"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."Procesu_registrs" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "pv_select_all_registrs_quoted" ON public."Procesu_registrs"';
    EXECUTE 'DROP POLICY IF EXISTS "pv_insert_all_registrs_quoted" ON public."Procesu_registrs"';
    EXECUTE 'DROP POLICY IF EXISTS "pv_update_all_registrs_quoted" ON public."Procesu_registrs"';
    EXECUTE 'DROP POLICY IF EXISTS "pv_delete_all_registrs_quoted" ON public."Procesu_registrs"';
    EXECUTE 'CREATE POLICY "pv_select_all_registrs_quoted" ON public."Procesu_registrs" FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "pv_insert_all_registrs_quoted" ON public."Procesu_registrs" FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_update_all_registrs_quoted" ON public."Procesu_registrs" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_delete_all_registrs_quoted" ON public."Procesu_registrs" FOR DELETE TO anon, authenticated USING (true)';
  END IF;

  IF to_regclass('public."Procesu_galaproduktu_veidu_katalogs"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."Procesu_galaproduktu_veidu_katalogs" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "pv_select_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs"';
    EXECUTE 'DROP POLICY IF EXISTS "pv_insert_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs"';
    EXECUTE 'DROP POLICY IF EXISTS "pv_update_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs"';
    EXECUTE 'DROP POLICY IF EXISTS "pv_delete_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs"';
    EXECUTE 'CREATE POLICY "pv_select_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs" FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "pv_insert_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs" FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_update_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs" FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_delete_all_catalog_quoted" ON public."Procesu_galaproduktu_veidu_katalogs" FOR DELETE TO anon, authenticated USING (true)';
  END IF;

  IF to_regclass('public.procesu_galaproduktu_veidu_katalogs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.procesu_galaproduktu_veidu_katalogs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "pv_select_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs';
    EXECUTE 'DROP POLICY IF EXISTS "pv_insert_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs';
    EXECUTE 'DROP POLICY IF EXISTS "pv_update_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs';
    EXECUTE 'DROP POLICY IF EXISTS "pv_delete_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs';
    EXECUTE 'CREATE POLICY "pv_select_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs FOR SELECT TO anon, authenticated USING (true)';
    EXECUTE 'CREATE POLICY "pv_insert_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs FOR INSERT TO anon, authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_update_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "pv_delete_all_catalog" ON public.procesu_galaproduktu_veidu_katalogs FOR DELETE TO anon, authenticated USING (true)';
  END IF;
END $$;

-- Vienreizējs backfill + regulāra sinhronizācija:
-- procesu_registrs.Procesa_numurs -> katalogs.Procesa_Nr.
-- procesu_registrs.Darbibas_joma  -> katalogs.Darbibas_joma
-- procesu_registrs.Process         -> katalogs.Process
DO $$
BEGIN
  IF to_regclass('public.procesu_registrs') IS NOT NULL
     AND to_regclass('public."Procesu_galaproduktu_veidu_katalogs"') IS NOT NULL THEN

    EXECUTE '
      UPDATE public."Procesu_galaproduktu_veidu_katalogs" k
      SET
        "Procesa_Nr."    = r."Procesa_numurs",
        "Darbibas_joma"  = r."Darbibas_joma",
        "Process"        = r."Process"
      FROM public.procesu_registrs r
      WHERE k."Procesa_Nr." = r."Procesa_numurs"
    ';

    EXECUTE '
      CREATE OR REPLACE FUNCTION public.pv_sync_registrs_to_catalog()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        UPDATE public."Procesu_galaproduktu_veidu_katalogs" k
        SET
          "Procesa_Nr."    = NEW."Procesa_numurs",
          "Darbibas_joma"  = NEW."Darbibas_joma",
          "Process"        = NEW."Process"
        WHERE k."Procesa_Nr." IN (OLD."Procesa_numurs", NEW."Procesa_numurs");
        RETURN NEW;
      END
      $fn$;
    ';

    EXECUTE 'DROP TRIGGER IF EXISTS pv_trg_sync_registrs_to_catalog ON public.procesu_registrs';
    EXECUTE '
      CREATE TRIGGER pv_trg_sync_registrs_to_catalog
      AFTER INSERT OR UPDATE OF "Procesa_numurs", "Darbibas_joma", "Process"
      ON public.procesu_registrs
      FOR EACH ROW
      EXECUTE FUNCTION public.pv_sync_registrs_to_catalog()
    ';
  END IF;
END $$;

-- Papildu tiesības lomām (papildus RLS politikām), lai WEB klientam rakstīšana tiešām strādā.
DO $$
BEGIN
  EXECUTE 'GRANT USAGE ON SCHEMA public TO anon, authenticated';

  IF to_regclass('public.procesu_registrs') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.procesu_registrs TO anon, authenticated';
  END IF;

  IF to_regclass('public."Procesu_registrs"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Procesu_registrs" TO anon, authenticated';
  END IF;

  IF to_regclass('public."Procesu_galaproduktu_veidu_katalogs"') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Procesu_galaproduktu_veidu_katalogs" TO anon, authenticated';
  END IF;

  IF to_regclass('public.procesu_galaproduktu_veidu_katalogs') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.procesu_galaproduktu_veidu_katalogs TO anon, authenticated';
  END IF;
END $$;

-- Piespiež PostgREST pārlasīt shēmas kešu.
NOTIFY pgrst, 'reload schema';

