# UI un lomu izmaiņu žurnāls (2026-09-30)

Fiksēts stāvoklis pēc optimizācijas sadaļas un lomu precizējumiem.

## Lomas (`Lomas.js`, `index.html`)

- UI lomas: **Administrators**, **Skatītājs**, **Atbildīgais par galaprodukta informāciju**.
- **Administrators** — pilna labošana un dzēšana; dati saglabājas Supabase (kopīgi starp datoriem).
- Aktīvā loma no `#roleSelect`; maiņa automātiski raksta `localStorage.roleMap`.

## Optimizācija (`Optimizacija.js`)

- Hierarhija: process (kartiņa) → galaprodukts → pasākumi (vertikāli, jaunākais ieraksta datums augšā).
- Statusi: Nav uzsākts, Izpildē, Pabeigts, Atcelts; neaktuālie = Pabeigts + Atcelts; atcelšanas iemesls obligāts.
- «+ Jauns optimizācijas pasākums» — toolbar **labajā augšā**; bulk «Atvērt / Aizvērt visas kartiņas» — zem toolbar.
- Pasākuma rinda: tumši zila, balts teksts.
- Virsraksti Aktuālie / Neaktuālie (17px); bez «Procesi» apakšvirsraksta un bez skaitītāja rindas statusā.

## Jomu kartiņa (`Joma kartina.js`)

- Virsraksts: **Jomas kartiņa** (tumši pelēks) pirms jomas nosaukuma.

## DB migrācijas

- `2026-09-30_optimizacija_statuss.sql` — statusu normalizācija JSON.
- `2026-09-30_sistema_skaidrojumi.sql` — palīdzības tabulas.

Funkcionālā prasība: **SPEC-024** (`docs/Procesu_registrs_funkcionala_specifikacija.md`).
