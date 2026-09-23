-- NA pieņemšanas datums.
-- Palaist Supabase SQL Editor vidē.

ALTER TABLE public.normativie_akti
  ADD COLUMN IF NOT EXISTS penemsanas_datums date;

NOTIFY pgrst, 'reload schema';
