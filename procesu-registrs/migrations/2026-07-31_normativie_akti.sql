-- Normatīvo aktu reģistrs + papildu klasifikatori (veidi, institūcijas).
-- Palaist Supabase SQL Editor vidē.

CREATE TABLE IF NOT EXISTS public.normativie_akti (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  na_nosaukums text NOT NULL,
  na_veids text,
  numurs text,
  pants_punkts text,
  atbildiga_institucija text,
  links text,
  statuss text,
  procesu_joma text,
  procesa_nr text,
  process_nosaukums text,
  gp_nr text,
  gp_nosaukums text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.norm_akti_klasifikatori (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kategorija text NOT NULL,
  vertiba text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS norm_akti_klasifikatori_uidx
  ON public.norm_akti_klasifikatori (kategorija, vertiba);

ALTER TABLE public.norm_akti_klasifikatori
  DROP CONSTRAINT IF EXISTS norm_akti_klasifikatori_kat_val_uniq;
ALTER TABLE public.norm_akti_klasifikatori
  ADD CONSTRAINT norm_akti_klasifikatori_kat_val_uniq UNIQUE (kategorija, vertiba);

ALTER TABLE public.normativie_akti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norm_akti_klasifikatori ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pv_select_normativie_akti" ON public.normativie_akti;
DROP POLICY IF EXISTS "pv_insert_normativie_akti" ON public.normativie_akti;
DROP POLICY IF EXISTS "pv_update_normativie_akti" ON public.normativie_akti;
DROP POLICY IF EXISTS "pv_delete_normativie_akti" ON public.normativie_akti;

CREATE POLICY "pv_select_normativie_akti" ON public.normativie_akti
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pv_insert_normativie_akti" ON public.normativie_akti
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pv_update_normativie_akti" ON public.normativie_akti
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pv_delete_normativie_akti" ON public.normativie_akti
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pv_select_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori;
DROP POLICY IF EXISTS "pv_insert_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori;
DROP POLICY IF EXISTS "pv_update_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori;
DROP POLICY IF EXISTS "pv_delete_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori;

CREATE POLICY "pv_select_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pv_insert_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pv_update_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pv_delete_norm_akti_klasifikatori" ON public.norm_akti_klasifikatori
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.normativie_akti TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.norm_akti_klasifikatori TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.normativie_akti_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.norm_akti_klasifikatori_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
