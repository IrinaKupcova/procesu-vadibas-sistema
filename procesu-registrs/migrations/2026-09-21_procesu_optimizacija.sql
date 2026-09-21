-- Procesu optimizācijas kartiņas (procesa + GP līmenī).
-- Palaist Supabase SQL Editor vidē.

CREATE TABLE IF NOT EXISTS public.procesu_optimizacija (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  procesa_numurs text NOT NULL DEFAULT '',
  process_nosaukums text,
  gp_numurs text NOT NULL DEFAULT '',
  gp_nosaukums text NOT NULL DEFAULT '',
  progres text,
  rz text,
  apraksts text,
  izpilditajs text,
  strukturvieniba text,
  pasakumi_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  kartina_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS procesu_optimizacija_proc_gp_uidx
  ON public.procesu_optimizacija (
    lower(trim(procesa_numurs)),
    lower(trim(gp_numurs)),
    lower(trim(gp_nosaukums))
  );

ALTER TABLE public.procesu_optimizacija ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pv_select_procesu_optimizacija" ON public.procesu_optimizacija;
DROP POLICY IF EXISTS "pv_insert_procesu_optimizacija" ON public.procesu_optimizacija;
DROP POLICY IF EXISTS "pv_update_procesu_optimizacija" ON public.procesu_optimizacija;
DROP POLICY IF EXISTS "pv_delete_procesu_optimizacija" ON public.procesu_optimizacija;

CREATE POLICY "pv_select_procesu_optimizacija" ON public.procesu_optimizacija
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pv_insert_procesu_optimizacija" ON public.procesu_optimizacija
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pv_update_procesu_optimizacija" ON public.procesu_optimizacija
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pv_delete_procesu_optimizacija" ON public.procesu_optimizacija
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.procesu_optimizacija TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.procesu_optimizacija_id_seq TO anon, authenticated;

-- pasakumi_json masīva elements (viens optimizācijas pasākums):
-- {
--   "id": "unikāls-id",
--   "nosaukums": "Pasākuma nosaukums",
--   "uzsaksanasDatums": "2026-09-01",
--   "planotaisIzpildesDatums": "2026-12-31",
--   "izpildesDatums": null,
--   "statuss": "nav_uzsakts | izpilde | pabeigts",
--   "atbildigie": [
--     { "parvalde": "Pārvalde", "dala": "Daļa", "vardsUzvards": "Vārds Uzvārds" }
--   ],
--   "pieteiktsRz": "Teksts par pieteikto RZ",
--   "apraksts": "Aprakstošais lauks",
--   "izpildesGaita": "Informācija par izpildes gaitu"
-- }

NOTIFY pgrst, 'reload schema';
