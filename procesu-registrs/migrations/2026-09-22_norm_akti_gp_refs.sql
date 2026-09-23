-- Vairāki galaprodukti uz vienu NA ar atsevišķu pants/punkts katram GP.
-- Palaist Supabase SQL Editor vidē pēc 2026-07-31_normativie_akti.sql.

ALTER TABLE public.normativie_akti
  ADD COLUMN IF NOT EXISTS gp_refs_json text;

NOTIFY pgrst, 'reload schema';
