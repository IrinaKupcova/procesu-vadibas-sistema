-- «i» skaidrojumi un BUJ — centralizēta glabāšana Supabase.
-- Palaist Supabase SQL Editor vidē.

CREATE TABLE IF NOT EXISTS public.sistema_help_icons (
  id text PRIMARY KEY,
  label text,
  selector text NOT NULL,
  help_text text,
  position text NOT NULL DEFAULT 'append',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sistema_help_faq (
  id text PRIMARY KEY,
  question text NOT NULL,
  answer text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sistema_help_icons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_help_faq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pv_select_sistema_help_icons" ON public.sistema_help_icons;
DROP POLICY IF EXISTS "pv_insert_sistema_help_icons" ON public.sistema_help_icons;
DROP POLICY IF EXISTS "pv_update_sistema_help_icons" ON public.sistema_help_icons;
DROP POLICY IF EXISTS "pv_delete_sistema_help_icons" ON public.sistema_help_icons;

CREATE POLICY "pv_select_sistema_help_icons" ON public.sistema_help_icons
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pv_insert_sistema_help_icons" ON public.sistema_help_icons
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pv_update_sistema_help_icons" ON public.sistema_help_icons
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pv_delete_sistema_help_icons" ON public.sistema_help_icons
  FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "pv_select_sistema_help_faq" ON public.sistema_help_faq;
DROP POLICY IF EXISTS "pv_insert_sistema_help_faq" ON public.sistema_help_faq;
DROP POLICY IF EXISTS "pv_update_sistema_help_faq" ON public.sistema_help_faq;
DROP POLICY IF EXISTS "pv_delete_sistema_help_faq" ON public.sistema_help_faq;

CREATE POLICY "pv_select_sistema_help_faq" ON public.sistema_help_faq
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "pv_insert_sistema_help_faq" ON public.sistema_help_faq
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "pv_update_sistema_help_faq" ON public.sistema_help_faq
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pv_delete_sistema_help_faq" ON public.sistema_help_faq
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sistema_help_icons TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sistema_help_faq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
