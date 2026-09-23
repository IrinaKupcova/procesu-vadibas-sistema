# SQL migrācijas — palaišanas secība

Visas migrācijas jāpalaida **Supabase → SQL Editor** (viena pēc otras, hronoloģiskā secībā).

Ja migrācija jau ir palaista, daudzas ir idempotent (droši palaist atkārtoti) — sk. komentārus failā.

| # | Fails | Īss mērķis |
|---|-------|------------|
| 1 | `2026-04-30_joma_un_saglabasana.sql` | Jomas lauki un saglabāšana |
| 2 | `2026-05-05_single-table-procesu-registrs.sql` | Vienas tabulas režīms (`procesu_registrs`) |
| 3 | `2026-06-18_procesu_jomas.sql` | Tabula `procesu_jomas` |
| 4 | `2026-06-19_procesu_jomas_lauki.sql` | Papildu jomu lauki |
| 5 | `2026-07-03_gp-nr-to-text.sql` | GP numura lauks → teksts |
| 6 | `2026-07-06_gp-kartinas-meta-json.sql` | GP kartiņas meta JSON |
| 7 | `2026-07-31_normativie_akti.sql` | Tabula `normativie_akti` + klasifikatori |
| 8 | `2026-09-21_procesu_optimizacija.sql` | Tabula `procesu_optimizacija` (pasākumi masīvā `pasakumi_json`) |

## Papildu fails (sakne)

- `supabase-single-table-migration.sql` — vecāka alternatīva / dokumentācija; jaunam projektam dod priekšroku `migrations/` secībai.

## Pēc migrācijām

1. Pārlādējiet lietotni (Ctrl+F5).
2. Ja normatīvie akti nestrādā — pārbaudiet, vai `normativie_akti` eksistē (konsolē nebūs `PGRST205`).
3. Palīgskripts (opcionāli): `node scripts/db-fix.mjs` — lasa URL/atslēgu no `DB.js` vai `config.js`.

## Ja kaut kas neizdodas

- Saglabājiet SQL Editor kļūdas ziņu.
- Nepalaidiet nākamo migrāciju, kamēr iepriekšējā nav veiksmīga (vai apzināti izlaista kā jau piemērota).
