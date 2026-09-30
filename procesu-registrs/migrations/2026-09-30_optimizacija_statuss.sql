-- Normalizē optimizācijas pasākumu statusus un atbalsta lauku atcelsanasIemesls (JSON masīvā pasakumi_json).
-- Palaist Supabase SQL Editor pēc 2026-09-21_procesu_optimizacija.sql.

CREATE OR REPLACE FUNCTION public.pv_norm_opt_pasakums_status(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(coalesce(raw, ''))) LIKE '%pabeig%' THEN 'pabeigts'
    WHEN lower(trim(coalesce(raw, ''))) LIKE '%atcel%' THEN 'atcelts'
    WHEN lower(trim(coalesce(raw, ''))) LIKE '%izpild%' THEN 'izpilde'
    WHEN lower(trim(coalesce(raw, ''))) LIKE '%nav%uz%' OR lower(trim(coalesce(raw, ''))) LIKE '%neuzsak%' THEN 'nav_uzsakts'
    WHEN trim(coalesce(raw, '')) = '' THEN 'nav_uzsakts'
    ELSE 'nav_uzsakts'
  END;
$$;

UPDATE public.procesu_optimizacija AS t
SET
  pasakumi_json = COALESCE(
    (
      SELECT jsonb_agg(
        elem
        || jsonb_build_object(
          'statuss',
          public.pv_norm_opt_pasakums_status(coalesce(elem->>'statuss', elem->>'status', ''))
        )
        || CASE
          WHEN public.pv_norm_opt_pasakums_status(coalesce(elem->>'statuss', elem->>'status', '')) <> 'atcelts'
            THEN jsonb_build_object('atcelsanasIemesls', null)
          ELSE '{}'::jsonb
        END
      )
      FROM jsonb_array_elements(t.pasakumi_json) AS elem
    ),
    '[]'::jsonb
  ),
  updated_at = now()
WHERE jsonb_typeof(t.pasakumi_json) = 'array'
  AND jsonb_array_length(t.pasakumi_json) > 0;

-- Atjaunināts pasakumi_json elements (sk. arī 2026-09-21 migrācijas komentāru):
-- "statuss": "nav_uzsakts" | "izpilde" | "pabeigts" | "atcelts"
-- "atcelsanasIemesls": teksts (obligāts, ja statuss ir "atcelts")

NOTIFY pgrst, 'reload schema';
