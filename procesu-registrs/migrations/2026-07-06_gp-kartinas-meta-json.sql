-- Per-GP kartiņu meta (izpildītājs, daļa, joma u.c.) glabāšanai.
-- Palaist Supabase SQL Editor vidē.

DO $$
BEGIN
  IF to_regclass('public.procesu_registrs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.procesu_registrs ADD COLUMN IF NOT EXISTS "GP_kartinas_papildu_JSON" jsonb NOT NULL DEFAULT ''{}''::jsonb';
  END IF;
  IF to_regclass('public."Procesu_registrs"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."Procesu_registrs" ADD COLUMN IF NOT EXISTS "GP_kartinas_papildu_JSON" jsonb NOT NULL DEFAULT ''{}''::jsonb';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
