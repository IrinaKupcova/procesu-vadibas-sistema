-- Jomu kartiņas (informācija par jomām, neatkarīgi no procesu reģistra rindām).
-- Palaist Supabase SQL Editor vidē.

CREATE TABLE IF NOT EXISTS public.procesu_jomas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  joma_key text NOT NULL,
  joma_nosaukums text NOT NULL,
  informacija text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS procesu_jomas_joma_key_uidx ON public.procesu_jomas (joma_key);

ALTER TABLE public.procesu_jomas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pv_select_procesu_jomas" ON public.procesu_jomas;
DROP POLICY IF EXISTS "pv_insert_procesu_jomas" ON public.procesu_jomas;
DROP POLICY IF EXISTS "pv_update_procesu_jomas" ON public.procesu_jomas;
DROP POLICY IF EXISTS "pv_delete_procesu_jomas" ON public.procesu_jomas;

CREATE POLICY "pv_select_procesu_jomas" ON public.procesu_jomas
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pv_insert_procesu_jomas" ON public.procesu_jomas
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pv_update_procesu_jomas" ON public.procesu_jomas
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pv_delete_procesu_jomas" ON public.procesu_jomas
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.procesu_jomas TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.procesu_jomas_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
