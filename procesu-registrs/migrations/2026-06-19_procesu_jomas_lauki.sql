-- Jomu kartiņas: atsevišķi lauki Skaidrojums un Iestādes funkciju piesaiste.
-- Palaist Supabase SQL Editor vidē ( arī ja jau izpildīta 2026-06-18 migrācija).

ALTER TABLE public.procesu_jomas
  ADD COLUMN IF NOT EXISTS skaidrojums text,
  ADD COLUMN IF NOT EXISTS iestades_funkciju_piesaiste text;

-- Veco «informacija» saturu pārnes uz skaidrojumu, ja jaunais lauks vēl tukšs.
UPDATE public.procesu_jomas
SET skaidrojums = informacija
WHERE (skaidrojums IS NULL OR btrim(skaidrojums) = '')
  AND informacija IS NOT NULL
  AND btrim(informacija) <> '';

NOTIFY pgrst, 'reload schema';
