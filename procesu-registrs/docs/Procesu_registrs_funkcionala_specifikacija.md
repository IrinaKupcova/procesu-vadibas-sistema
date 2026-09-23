# Procesu reģistrs — funkcionālā specifikācija

> **Versija:** 1.0 (2026-08-19)  
> **Avots:** esošā implementācija (`index.html`, JS moduļi, `DB.js`, `migrations/`, `docs/`)  
> **Statuss:** apraksta **pašreizējo** sistēmas stāvokli; nākotnes idejas atdalītas atsevišķi  
> **Spec Kit:** specify → clarify → plan → tasks → implement  
> **Saturs:** I daļa — SPEC bloki (prasības, AC) · II daļa — lietotāja plūsmas (UF, X→Y→Z)

---

## Kā lasīt šo dokumentu

- **SPEC-NNN** — funkcionālais bloks (stabilais ID; jauni bloki pievienojami secīgi, esošie netiek pārrakstīti).
- **SPEC-NNN-FR-NNN** — funkcionālā prasība.
- **SPEC-NNN-AC-NNN** — pieņemšanas kritērijs.
- **UF-NNN** — lietotāja plūsma: Lietotājs izdara X → Sistēma izdara Y → Lietotājs redz Z (II daļa).
- **NAV NOSKAIDROTS** — informācija nav atrodama kodā vai dokumentācijā.
- **NĀKOTNE** — minēts kodā/dokumentācijā kā plānots, bet **nav implementēts**.

### Word dokumenta numerācija (1–11)

Ja šis saturs ir Word formā ar nodaļām 1–11, **tā numerācija ir galvenā** lasītājam. SPEC-001…023 un UF-NNN ir **iekšējie ID** testēšanai un izstrādei — tie nav jāliek katrai Word nodaļai. Mapju ceļi (`procesu-registrs/`, `migrations/`) un NPM/atkarības — tikai **Tehniskajā specifikācijā** (`docs/Procesu_registrs_tehniska_specifikacija.md`). Sk. arī `docs/README.md`.

---

# I. daļa — Funkcionālie bloki (SPEC)

# SPEC-001 — Platforma, piekļuve un vispārīgais konteksts

## 1. Mērķis
Aprakstīt, kā lietotne tiek palaista, kāda ir tās arhitektūras forma un kādi ir vispārīgie ierobežojumi.

## 2. Darbības joma
Statiska tīmekļa lietotne (`index.html` + modulāri `.js`), hostēta ar HTTP(S); dati — Supabase.

## 3. Lietotāju lomas
Visas lomas (sk. SPEC-002).

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-001-FR-001 | Lietotne ir viens HTML fails ar inline skriptu un atsevišķiem JS moduļiem; nav build soļa. |
| SPEC-001-FR-002 | Lietotnei nepieciešams HTTP(S) serveris; `file://` atvēršana nav atbalstīta. |
| SPEC-001-FR-003 | Supabase klients ielādējas no CDN (`@supabase/supabase-js` v2). |
| SPEC-001-FR-004 | Konfigurācija: `config.js` (iestāde) vai noklusējums `DB.js` (dev). |
| SPEC-001-FR-005 | Ja Supabase bibliotēka neielādējas, lietotne rāda kļūdu un neveic DB operācijas. |

## 5. Lietotāja darbības
- Atver lietotni pārlūkā caur web serveri (GitHub Pages, Live Server u.c.).
- (Neatbalstīts) Atver HTML ar dubultklikšķi no failu sistēmas.

## 6. Sistēmas reakcija
- HTTP(S): ielādē moduļus, inicializē `init()`, mēģina `loadDb()`.
- `file://`: `warnIfFileProtocol()` brīdina; DB pieprasījumi var neizdoties ar `mapDbError()` paskaidrojumu.

## 7. Datu avoti un glabāšana
- Nav lokālās datu bāzes pārlūkā (IndexedDB nav galvenais avots).
- Primārais avots: Supabase PostgreSQL.

## 8. Validācijas noteikumi
Nav UI validācijas platformas līmenī.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Nav interneta / CDN kļūda | Statuss: Supabase bibliotēka nav ielādēta |
| `file://` + network error | `mapDbError`: izmantot HTTP serveri |

## 10. Integrācijas
- Supabase REST API (caur `supabase-js`).
- **NAV NOSKAIDROTS:** citi ārējie API, izņemot Storage un e-pastu (sk. SPEC-014, SPEC-015).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-001-AC-001 | Lietotne ielādējas bez JavaScript kļūdām, ja atvērta ar HTTPS un pieejams Supabase. |
| SPEC-001-AC-002 | Atverot ar `file://`, lietotājs redz brīdinājumu par nepieciešamību izmantot web serveri. |
| SPEC-001-AC-003 | Bez Supabase CDN lietotne neizdara DB rakstīšanu un rāda saprotamu kļūdu. |

## 12. Saistītās specifikācijas
SPEC-002, SPEC-020, SPEC-021

---

# SPEC-002 — Lietotāju lomas un tiesības

## 1. Mērķis
Definēt, kādas lietotāju lomas eksistē un kā tās ietekmē rediģēšanas iespējas.

## 2. Darbības joma
Augšējā rīkjosla (`#userSelect`, `#roleSelect`, `#saveRoleBtn`); visi CRUD guardi.

## 3. Lietotāju lomas

| Kods | UI nosaukums | Tiesības |
|------|--------------|----------|
| `viewer` | skatītājs | Tikai skatīšana |
| `admin_view` | administrators (skatīt) | Skatīšana; redaktors bloķēts |
| `admin_edit` | administrators (labot) | Izveide, labošana, dzēšana |

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-002-FR-001 | Lomas glabājas `localStorage.roleMap` (JSON: `{ username: roleCode }`). |
| SPEC-002-FR-002 | `canEdit()` ir `true` tikai lomai `admin_edit`. |
| SPEC-002-FR-003 | Ja lietotājs nav `roleMap`, fallback loma ir `admin_edit`. |
| SPEC-002-FR-004 | `roles.daina` vienmēr tiek piespiests uz `admin_edit` (`loadRoles()`). |
| SPEC-002-FR-005 | `#saveRoleBtn` paslēpts, ja `#roleSelect === "viewer"`. |
| SPEC-002-FR-006 | Supabase Auth **nav** integrēts; lomas ir tikai klienta pusē. |
| SPEC-002-FR-007 | `Norm_akti.js` pārbauda `#roleSelect === "admin_edit"` tieši (nevis `window.canEdit`). |

## 5. Lietotāja darbības
- Izvēlas lietotāju un lomu, saglabā ar **«Saglabāt lomu»**.
- URL parametrs `?user=` pārraksta aktīvo lietotāju startā.

## 6. Sistēmas reakcija
- Raksta `roleMap`; atjauno tabulas, redaktoru `disabled` stāvokli, admin UI redzamību (`Skaidrojumi.js`, `Rokasgramata.js`).

## 7. Datu avoti un glabāšana
- `localStorage.roleMap`
- **Nav** servera lomu tabulas lietotnē (**NAV NOSKAIDROTS**, vai `user_roles` migrācijā eksistē ārpus lietotnes).

## 8. Validācijas noteikumi
- Primāro lietotāju `daina` nevar dzēst no lomu tabulas (`alert`).

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| `viewer` mēģina saglabāt | `alert`: labošana tikai admin (labot) |
| Manipulācija ar localStorage | UI atļauj edit; RLS var bloķēt DB (SPEC-021) |

## 10. Integrācijas
Nav servera autentifikācijas.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-002-AC-001 | `viewer` nevar iesniegt procesa/GP/jomas formu veiksmīgi (disabled vai alert). |
| SPEC-002-AC-002 | `admin_edit` var saglabāt un dzēst atbalstītās entītijas. |
| SPEC-002-AC-003 | Lomu maiņa saglabājas pēc lapas pārlādes (`roleMap`). |

## 12. Saistītās specifikācijas
SPEC-003–SPEC-019, SPEC-021

---

# SPEC-003 — Navigācija un sadaļu pārvaldība

## 1. Mērķis
Definēt galvenās lietotāja saskarnes sadaļas un to pārslēgšanas loģiku.

## 2. Darbības joma
Kreisā panelis `#leftSidePanel`, `initLeftNav()`, modālie redaktori.

## 3. Lietotāju lomas
Visas lomas — navigācija pieejama visiem; admin-only sadaļas skat. SPEC-002.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-003-FR-001 | Kreisajā navigācijā ir sadaļas: Procesu reģistrs, GP katalogs, Procesu grupas, Jomas, Izpildītāji, Mērījumi, Statistika, normatīvie akti, Rokasgrāmata. |
| SPEC-003-FR-002 | **Skaidrojuma ievietošana** redzama tikai `admin_edit` (`Skaidrojumi.js`). |
| SPEC-003-FR-003 | `closeAllMainSections()` paslēpj visas kartes; atver tikai izvēlēto. |
| SPEC-003-FR-004 | Sekundārās sadaļas (`metricsCard`, `manualCard`, `reportsCard`, `normActsCard`) — pilnekrāna režīms. |
| SPEC-003-FR-005 | Redaktori (`editorCard`, `catalogEditorCard`, u.c.) atveras virs/par pamata sadaļām. |
| SPEC-003-FR-006 | `Navigacija.js` koriģē navigācijas etiķetes un apakšsadaļu klases. |

## 5. Lietotāja darbības
- Noklikšķina navigācijas pogā ar `data-scroll-target`.
- Atver/aizver modāļus (metodika, koncepts, BUJ).

## 6. Sistēmas reakcija
- Paslēpj iepriekšējo sadaļu; atver mērķa `#...Card`; izsauc attiecīgo render (`NormAkti.render`, `Rokasgramata.render`, u.c.).

## 7. Datu avoti un glabāšana
Nav pastāvīgas glabāšanas navigācijas stāvoklim (**NAV NOSKAIDROTS**, vai URL saglabā aktīvo sadaļu).

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| `tasksViewCard` | Nav navigācijas pogas; sadaļa pēc noklusējuma `hidden` (sk. SPEC-013) |

## 10. Integrācijas
`window.PV_URLS` — ārējās saites metodikai/plūsmām (ja iestatīts).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-003-AC-001 | Katrā brīdī redzama viena galvenā sadaļa (izņemot atvērtu redaktoru). |
| SPEC-003-AC-002 | Navigācijas pogai ir vizuāls aktīvais stāvoklis (`nav-active`). |

## 12. Saistītās specifikācijas
SPEC-004–SPEC-019

---

# SPEC-004 — Procesu reģistrs

## 1. Mērķis
Procesu uzskaites, skatīšanas, izveides, labošanas un dzēšanas atbalsts.

## 2. Darbības joma
`processListCard`, `editorCard`, `#processTable`, `index.html` + `DB.js` + `Procesu registrs.js` + `Numeracija.js`.

## 3. Lietotāju lomas
- Skatīšana: visas lomas.
- CRUD: tikai `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-004-FR-001 | Procesi tiek ielādēti no `DB.load()` → tabula `procesu_registrs`. |
| SPEC-004-FR-002 | Tabula apvieno vairākas DB rindas vienā loģiskā procesā (`Procesu registrs.js`). |
| SPEC-004-FR-003 | GP attēloti kā apakšrindas/akordeons katram procesam. |
| SPEC-004-FR-004 | Lapošana: 50/100/200 rindas (`#processPageSize`), noklusējums 100. |
| SPEC-004-FR-005 | Detalizētais/kompaktais skats un `#levelSelect` (1/2) kontrolē paplašinātās kolonnas. |
| SPEC-004-FR-006 | `admin_edit` var atvērt kartiņu, rediģēt, saglabāt (`DB.insert`/`update`), dzēst (`DB.remove`). |
| SPEC-004-FR-007 | `viewer`/`admin_view` var atvērt kartiņu skatīšanai (`disabled` lauki). |
| SPEC-004-FR-008 | Jauna procesa UI validācija: obligāts lauks **Process** (nosaukums). |
| SPEC-004-FR-009 | Pirms saglabāšanas/dzēšanas — `confirm()`. |
| SPEC-004-FR-010 | Excel eksports (`exportTableToExcel`). |
| SPEC-004-FR-011 | Procesa dzēšana dzēš visas DB rindas ar atbilstošu `processNo` un/vai normalizētu nosaukumu. |
| SPEC-004-FR-012 | Procesa Nr. maiņa sinhronizē ar saistītajām rindām (`updateProcessNoBulk`, `syncProcessNoToSiblingProcessRows`). |
| SPEC-004-FR-013 | Inline tabulas labošana (`processInlineEditMode`) **nav aktivizēta** UI (mainīgais paliek `false`). |

## 5. Lietotāja darbības
- Atver Procesu reģistru; filtrē/meklē (SPEC-012); atver kartiņu; labo/saglabā/dzēš; eksportē.

## 6. Sistēmas reakcija
- `openEditor()` → aizpilda formu, iestata režīmu pēc lomas.
- Submit → validācija → `confirm()` → DB → `reloadAllData()` → statuss «Saglabāts.» → atgriešanās tabulā.
- `emitSync("process"|"all", "html")`.

## 7. Datu avoti un glabāšana
- Tabula: `procesu_registrs` (SPEC-020).
- GP meta: `GP_kartinas_papildu_JSON`.
- Kartiņu pielikumi: SPEC-015.

## 8. Validācijas noteikumi
| Lauks / noteikums | Obligāts UI | Piezīmes |
|-------------------|-------------|----------|
| Process (nosaukums) | Jā (jauns ieraksts) | `status` kļūda |
| Citi lauki | Nē UI līmenī | DB `fillProcessInsertDbDefaults`, NOT NULL retry |

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| DB RLS / tīkls | `alert` + `mapDbError` |
| Dzēšana bez efekta | Statuss: dzēšana neizdevās |
| Atcelts `confirm()` | Nav DB izmaiņu |

## 10. Integrācijas
- Supabase CRUD (SPEC-020).
- NA saistīšana (SPEC-009).
- Numerācija (SPEC-006).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-004-AC-001 | `admin_edit` saglabā procesa izmaiņas; tabula atjaunojas ar jaunajām vērtībām. |
| SPEC-004-AC-002 | `viewer` redz kartiņu, bet nevar mainīt laukus. |
| SPEC-004-AC-003 | Jauns process bez nosaukuma netiek saglabāts. |
| SPEC-004-AC-004 | Lapošana rāda pareizu lapu skaitu un ierakstu kopsummu. |

## 12. Saistītās specifikācijas
SPEC-002, SPEC-005, SPEC-006, SPEC-009, SPEC-012, SPEC-015, SPEC-017, SPEC-020

---

# SPEC-005 — Galaproduktu katalogs (GP)

## 1. Mērķis
Galaproduktu (GP) uzskaites un kartiņu pārvaldība.

## 2. Darbības joma
`catalogListCard`, `catalogEditorCard`, `DB.loadCatalogTypes` / `insertCatalog` / `updateCatalog` / `removeCatalog`, `GP kataogs.js`.

## 3. Lietotāju lomas
Skatīšana — visas; CRUD — `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-005-FR-001 | Single-table režīmā GP dati nāk no `procesu_registrs` (nav atsevišķas kataloga tabulas). |
| SPEC-005-FR-002 | GP kataloga tabula ar kolonnu filtriem (SPEC-012). |
| SPEC-005-FR-003 | `admin_edit` var izveidot, labot, dzēst GP kartiņu. |
| SPEC-005-FR-004 | Obligāts UI: GP **nosaukums** (`type`). |
| SPEC-005-FR-005 | GP dzēšana noņem GP no procesa `products` saraksta (ner dzēš visu procesu). |
| SPEC-005-FR-006 | No procesa kartiņas: **«Pievienot jaunu galaproduktu»** atver GP redaktoru ar prefilla datiem (`Procesa kartina.js`). |
| SPEC-005-FR-007 | GP sensitivitāte: `pv_gp_sensitivity_v1` + DB fallback (`GP kataogs.js`). |
| SPEC-005-FR-008 | Kataloga skats vienmēr **expanded**; skata pārslēdzējs noņemts. |

## 5. Lietotāja darbības
- Atver katalogu; atver/labo GP; piesaista jomu (`#cDarbibasJoma`); pievieno pielikumus; saista NA.

## 6. Sistēmas reakcija
- Submit → validācija nosaukuma → `confirm()` → DB → `reloadAllData()` → atgriešanās katalogā/procesos/izpildītājos (atkarībā no `catalogOpenReturnTarget`).

## 7. Datu avoti un glabāšana
- `procesu_registrs`: `Procesa_galaprodukti`, `GP_kartinas_papildu_JSON`, GP Nr. kolonnas.
- `localStorage.pv_gp_sensitivity_v1`.

## 8. Validācijas noteikumi
| Lauks | Obligāts |
|-------|----------|
| GP nosaukums (`type`) | Jā |

## 9. Kļūdu un izņēmumu scenāriji
Kā SPEC-004 (DB kļūdas, `canEdit` guards).

## 10. Integrācijas
SPEC-006, SPEC-007, SPEC-009, SPEC-015.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-005-AC-001 | Jauns GP ar nosaukumu parādās katalogā un saistītajā procesā. |
| SPEC-005-AC-002 | GP dzēšana noņem to no kataloga skata. |
| SPEC-005-AC-003 | GP bez nosaukuma netiek saglabāts. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-006, SPEC-007, SPEC-009, SPEC-015

---

# SPEC-006 — Procesu un GP numerācija

## 1. Mērķis
Vienota procesu un GP numuru formāta noteikšana un automātiski ieteikumi formās.

## 2. Darbības joma
`Numeracija.js`; formu lauki `#eProcNo`, `#cTypeNo`.

## 3. Lietotāju lomas
Visas — skatīt; `admin_edit` — rediģēt (ieteikumi tiek piemēroti jauniem ierakstiem).

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-006-FR-001 | Procesu grupu prefiksi: pamatdarbība=`P`, atbalsts=`A`, pārvaldība=`M`; `V`→`M`. |
| SPEC-006-FR-002 | Procesa Nr. formāts: `{P\|A\|M}-{n}` (piem. `P-1`); atbalsta normalizāciju no `P1`. |
| SPEC-006-FR-003 | GP Nr. formāts: `{prefix}-{procNum}-{sub}` (piem. `P-1-1`). |
| SPEC-006-FR-004 | Nākamais brīvais numurs skenē `getProcessRows()` un `getCatalogRows()`. |
| SPEC-006-FR-005 | Jaunam procesam/GP — `applyProcessNumberSuggestion` / `applyGpNumberSuggestion`. |
| SPEC-006-FR-006 | `"nav obligāts"` tratēts kā tukšs numurs. |

## 5. Lietotāja darbības
- Maina procesu grupu vai izveido jaunu procesu/GP — saņem ieteikto numuru.

## 6. Sistēmas reakcija
- Normalizē ievadi formās un saglabāšanas laikā (`normalizeProcessRow`, `normalizeCatalogRow`).

## 7. Datu avoti un glabāšana
Esošie procesi/GP no atmiņas (`processRows`, kataloga rindas).

## 8. Validācijas noteikumi
Formāta normalizācija; **nav** stingras unikalitātes pārbaudes UI (**NAV NOSKAIDROTS**, vai DB ir unikalitātes ierobežojums).

## 9. Kļūdu un izņēmumu scenāriji
Nav specifisku lietotāja ziņojumu par numura konfliktu.

## 10. Integrācijas
SPEC-004, SPEC-005.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-006-AC-001 | Jaunam procesam grupā «pamatdarbība» tiek ieteikts `P-*` formāta numurs. |
| SPEC-006-AC-002 | `P1` normalizējas uz `P-1` attēlojumā/saglabāšanā. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-005

---

# SPEC-007 — Procesu jomas (skats un GP piesaiste)

## 1. Mērķis
Procesu jomu attēlojums un GP piesaiste jomām caur GP/procesa datiem.

## 2. Darbības joma
`processJomasCard`, `Joma.js`, `#cDarbibasJoma` GP kartiņā.

## 3. Lietotāju lomas
Skatīšana — visas; jomas izvēle GP kartiņā — `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-007-FR-001 | Jomu skats rāda jomu pīrāgu, statistiku un tabulu ar GP akordeoniem. |
| SPEC-007-FR-002 | Jomas avoti: `JomaKartina.listJomaLabels()` + `pv_custom_jomas_v1`. |
| SPEC-007-FR-003 | GP–joma saite galvenokārt caur `darbibasJoma` / `gpItems[].jomaText`. |
| SPEC-007-FR-004 | `#pjAddJomaBtn` atver jaunu jomu kartiņu (`Joma kartina.js`). |
| SPEC-007-FR-005 | Jomu tabulai **nav** kolonnu filtru (`Filtrs.js` izslēgts). |
| SPEC-007-FR-006 | Klikšķis uz jomas nosaukuma atver jomu kartiņu. |

## 5. Lietotāja darbības
- Skatās jomu sarakstu; atver GP no akordeona; pievieno jomu; GP kartiņā izvēlas jomu.

## 6. Sistēmas reakcija
- `renderProcessJomasView()` / `Joma.buildJomaGpData()`; GP saglabāšana atjaunina jomu skatu pēc reload.

## 7. Datu avoti un glabāšana
- `procesu_registrs.Darbibas_joma`, GP meta JSON.
- `localStorage.pv_custom_jomas_v1`.
- `procesu_jomas` (SPEC-008).

## 8. Validācijas noteikumi
Nav jomu skata līmeņa validācijas.

## 9. Kļūdu un izņēmumu scenāriji
Nav specifisku.

## 10. Integrācijas
SPEC-005, SPEC-008, SPEC-010.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-007-AC-001 | GP ar `darbibasJoma` parādās attiecīgajā jomā skatā. |
| SPEC-007-AC-002 | «Pievienot jaunu jomu» atver tukšu jomu kartiņu. |

## 12. Saistītās specifikācijas
SPEC-005, SPEC-008, SPEC-010

---

# SPEC-008 — Jomu kartiņas

## 1. Mērķis
Procesu jomu papildu informācijas (skaidrojums u.c.) pārvaldība atsevišķā kartiņā.

## 2. Darbības joma
`jomaEditorCard`, `Joma kartina.js`, tabula `procesu_jomas`.

## 3. Lietotāju lomas
Skatīšana — atkarībā no formas `disabled`; CRUD — `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-008-FR-001 | Jomu kartiņa glabā: nosaukums, skaidrojums (`DB` + localStorage rezerve). |
| SPEC-008-FR-002 | Obligāts UI: **jomas nosaukums**. |
| SPEC-008-FR-003 | Jomas pārdēvēšana atjauno saistītos NA (`renameJomaInNormActs`). |
| SPEC-008-FR-004 | UI lauks `iestades_funkciju_piesaiste` **noņemts**; `funkcijas` saglabājas tukšs. |
| SPEC-008-FR-005 | Dzēšana: `DB.deleteJomaCard()` + localStorage tīrīšana. |
| SPEC-008-FR-006 | NA saites jomu kartiņā: `NormAkti.renderJomaLinks`. |

## 5. Lietotāja darbības
- Atver/labo/dzēš jomu; saista NA (SPEC-009).

## 6. Sistēmas reakcija
- `upsertJomaCard` / `deleteJomaCard`; sync ar `Joma.addCustomJoma`/`removeCustomJoma`.

## 7. Datu avoti un glabāšana
- `procesu_jomas`: `joma_key`, `joma_nosaukums`, `skaidrojums`, `informacija`, `iestades_funkciju_piesaiste`, `updated_at`.
- `localStorage.pv_joma_kartinas_v1`.

## 8. Validācijas noteikumi
| Lauks | Obligāts |
|-------|----------|
| Jomas nosaukums | Jā |

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| DB tabula nav | localStorage rezerve (**NAV NOSKAIDROTS** pilns fallback UX) |

## 10. Integrācijas
SPEC-007, SPEC-009, SPEC-017.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-008-AC-001 | Jauna joma ar nosaukumu saglabājas un parādās jomu sarakstos. |
| SPEC-008-AC-002 | Jomas dzēšana noņem kartiņu no skata. |

## 12. Saistītās specifikācijas
SPEC-007, SPEC-009, SPEC-020

---

# SPEC-009 — Normatīvie akti

## 1. Mērķis
Normatīvo aktu reģistrs un to saistīšana ar procesiem, GP un jomām.

## 2. Darbības joma
`normActsCard`, `normActEditorCard`, `Norm_akti.js`, tabulas `normativie_akti`, `norm_akti_klasifikatori`.

## 3. Lietotāju lomas
Skatīšana — visas; CRUD un saistīšana — `admin_edit` (`#roleSelect`).

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-009-FR-001 | NA saraksts ar meklēšanu (`#naSearchInput`); kolonnas: veids, nosaukums, numurs, pants/punkts u.c. |
| SPEC-009-FR-002 | CRUD: `insertNormAct`, `updateNormAct`, `deleteNormAct`. |
| SPEC-009-FR-003 | Obligāts UI: **NA nosaukums**. |
| SPEC-009-FR-004 | Veidi/institūcijas: noklusējuma saraksti + pielāgoti + DB klasifikatori. |
| SPEC-009-FR-005 | Saistīšana no kartiņām: tikai **esošu** NA (checkbox picker); jauns NA tikai NA sadaļā. |
| SPEC-009-FR-006 | Kartiņās: saistīto NA saraksts, **Pievienot normatīvo aktu**, **Noņemt** saiti. |
| SPEC-009-FR-007 | Ja DB tabula nav — localStorage rezerve (`pv_norm_akti_v1`) + brīdinājums par migrāciju. |
| SPEC-009-FR-008 | NA redaktora sadaļa «Ietekme — reglamentētie procesi un GP» **noņemta** no UI. |

## 5. Lietotāja darbības
- Skatās/meklē NA; izveido/labo/dzēš NA; saista ar procesu/GP/jomu kartiņās.

## 6. Sistēmas reakcija
- Saglabā DB vai localStorage; atjauno saistību laukus NA ierakstā; `NormAkti.render()` pēc sync.

## 7. Datu avoti un glabāšana
- `normativie_akti`, `norm_akti_klasifikatori`.
- `localStorage`: `pv_norm_akti_v1`, `pv_norm_akti_veidi_v1`, `pv_norm_akti_inst_v1`, `pv_norm_akti_db_migrated_v1`.

## 8. Validācijas noteikumi
| Lauks | Obligāts |
|-------|----------|
| NA nosaukums | Jā |
| Saistīšana bez kartiņas datiem | Bloķēta ar `blockedMsg` |

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Nav migrācijas | localStorage + brīdinājums |
| Saistīšanas kļūda | `alert` ar kļūdas tekstu |

## 10. Integrācijas
SPEC-004, SPEC-005, SPEC-008, SPEC-017, SPEC-020.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-009-AC-001 | Jauns NA ar nosaukumu parādās NA tabulā. |
| SPEC-009-AC-002 | No procesa kartiņas var saistīt esošu NA; jaunu NA tur nevar izveidot. |
| SPEC-009-AC-003 | «Noņemt» no kartiņas noņem saiti ar attiecīgo kartiņu. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-005, SPEC-008, SPEC-017

---

# SPEC-010 — Procesu grupas

## 1. Mērķis
Procesu grupēšanas pārskats (pamatdarbība / atbalsts / pārvaldība).

## 2. Darbības joma
`processGroupsCard`, `#processGroupsTable`, `#pgProcessGroupPie`.

## 3. Lietotāju lomas
Visas — tikai lasīšana.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-010-FR-001 | Rāda pīrāga diagrammu un tabulu pa procesu grupām. |
| SPEC-010-FR-002 | Statistika: jomu skaits, procesu skaits grupu skatā. |
| SPEC-010-FR-003 | Kolonnu filtri (`Filtrs.js`). |
| SPEC-010-FR-004 | No tabulas var atvērt procesa kartiņu. |

## 5. Lietotāja darbības
- Atver Procesu grupas; filtrē; atver procesu.

## 6. Sistēmas reakcija
- `renderProcessGroupsView()` pēc datu ielādes/navigācijas.

## 7. Datu avoti un glabāšana
`processRows` / apvienotās rindas; lauks `Procesa_grupa`.

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
Nav specifisku.

## 10. Integrācijas
SPEC-004, SPEC-006, SPEC-012.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-010-AC-001 | Grupu skaits diagrammā atbilst unikālo grupu skaitam datos. |
| SPEC-010-AC-002 | Procesa kartiņa atveras no grupu tabulas. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-012

---

# SPEC-011 — Statistika

## 1. Mērķis
Agregēta statistika pa izpildītājiem, procesiem un jomām.

## 2. Darbības joma
`reportsCard`, `Statistika.js`.

## 3. Lietotāju lomas
Visas — tikai lasīšana.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-011-FR-001 | Trīs bloki: org (izpildītāji), process (GP pa procesiem), joma. |
| SPEC-011-FR-002 | Attēlojums: salokāmi bloki ar bar chart (`renderOrgStats` u.c.). |
| SPEC-011-FR-003 | Datu avots: `getMergedProcessRegisterRows()`, `getCatalogRows()`, `Joma.getJomaStats()`. |
| SPEC-011-FR-004 | Header filtra infra daļēji neizmantota ar bar chart UI (**NAV NOSKAIDROTS** pilna filtra nozīme). |

## 5. Lietotāja darbības
- Atver Statistiku; izvērš/salokā blokus.

## 6. Sistēmas reakcija
- Aprēķina un zīmē diagrammas no atmiņā esošajiem datiem.

## 7. Datu avoti un glabāšana
Procesu/GP/jomu dati atmiņā; nav atsevišķas statistikas tabulas.

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
Nav specifisku.

## 10. Integrācijas
SPEC-007, SPEC-004, SPEC-005.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-011-AC-001 | Statistikas sadaļa ielādējas bez JS kļūdām ar tipiskiem datiem. |
| SPEC-011-AC-002 | Jomu bloks rāda jomu GP sadalījumu, ja jomu datos ir GP. |

## 12. Saistītās specifikācijas
SPEC-007, SPEC-010

---

# SPEC-012 — Filtrēšana un meklēšana

## 1. Mērķis
Datu šaurināšana tabulās un globālā meklēšana.

## 2. Darbības joma
`Filtrs.js`, `Procesu registrs.js`, `#searchInput`, `#viewFilterSelect`.

## 3. Lietotāju lomas
Visas.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-012-FR-001 | Kolonnu checklist filtri: process, katalogs, uzdevumi, izpildītāji, procesu grupas. |
| SPEC-012-FR-002 | Procesu tabulā GP līmeņa filtrs kolonnā 3. |
| SPEC-012-FR-003 | Globālā meklēšana procesu tabulā pēc skata režīma (`task`/`owner`/`output`/process). |
| SPEC-012-FR-004 | Meklēšana reset procesu lapošanu uz 1. |
| SPEC-012-FR-005 | `Filtrs.js` `state.quick` netiek aizpildīts — **neaktīvs**, ja nav ārēja rakstītāja. |
| SPEC-012-FR-006 | «Noņemt visus filtrus» (`removeAllFilters`). |

## 5. Lietotāja darbības
- Ievada meklēšanas tekstu; izvēlas kolonnu filtrus; noņem filtrus.

## 6. Sistēmas reakcija
- Slēpt/parādīt DOM rindas; var automātiski atvērt tabulas/akordeonus.

## 7. Datu avoti un glabāšana
Tikai klienta atmiņa/DOM; filtra stāvoklis **nav** persistēts (**NAV NOSKAIDROTS** pēc pārlādes).

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
Nav.

## 10. Integrācijas
SPEC-004, SPEC-005, SPEC-010, SPEC-013.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-012-AC-001 | Meklēšana samazina redzamo rindu skaitu atbilstoši tekstam. |
| SPEC-012-AC-002 | Kolonnu filtrs paslēpj rindas, kas neatbilst izvēlētajām vērtībām. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-005, SPEC-010, SPEC-013

---

# SPEC-013 — Uzdevumu skats

## 1. Mērķis
Uzdevumu kopsavilkums un uzdevumu kartiņu CRUD.

## 2. Darbības joma
`tasksViewCard`, `taskEditorCard`, `renderTasksView()`, `DB.updateTaskByNo` / `removeTaskByNo`.

## 3. Lietotāju lomas
Skatīšana — atkarībā no piekļuves; CRUD — `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-013-FR-001 | Uzdevumu kopsavilkuma tabula: Nr., nosaukums, procesu skaits, procesi, pakalpojumi. |
| SPEC-013-FR-002 | CRUD caur `taskEditorCard` (`insert` ar sintētisku `UZD-{nr}`). |
| SPEC-013-FR-003 | `#toggleTasksBtn` pārslēdz tabulas redzamību **iekš** `tasksViewCard`. |
| SPEC-013-FR-004 | **`tasksViewCard` nav kreisajā navigācijā** un pēc noklusējuma `hidden`. |
| SPEC-013-FR-005 | `initLeftNav` atbalsta `tasksViewCard`, bet **nav UI pogas** šim target. |

## 5. Lietotāja darbības
- **NAV NOSKAIDROTS** — standarta lietotāja ceļš uz sadaļu.
- Ja sadaļa pieejama: atver uzdevumu tabulu, labo uzdevumu.

## 6. Sistēmas reakcija
- `renderTasksView()` grupē pēc `taskNo`; saglabāšana → DB → reload.

## 7. Datu avoti un glabāšana
`procesu_registrs`: `Uzdevuma_Nr.`, `Uzdevums`.

## 8. Validācijas noteikumi
**NAV NOSKAIDROTS** — pilns obligāto lauku saraksts uzdevuma formā.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Nav `Uzdevuma Nr.` dzēšanai | `alert` |

## 10. Integrācijas
SPEC-004, SPEC-012.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-013-AC-001 | Ja `tasksViewCard` ir redzams, tabula rāda uzdevumu kopsavilkumu no DB datiem. |
| SPEC-013-AC-002 | `admin_edit` var saglabāt uzdevuma kartiņu, ja sadaļa ir pieejama. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-003

**Piezīme:** Pilna pieejamība lietotājam — **NAV NOSKAIDROTS** (iespējama implementācijas nepilnība).

---

# SPEC-014 — Izpildītāju skats

## 1. Mērķis
Agregēts skats: pārvalde → process → galaprodukts.

## 2. Darbības joma
`executorsCard`, `Izpilditaji.js`, dinamiski `#executorsTable`.

## 3. Lietotāju lomas
Visas — lasīšana; navigācija uz kartiņām.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-014-FR-001 | HTML satur placeholder hint; `renderExecutorsView()` to aizstāj ar tabulu. |
| SPEC-014-FR-002 | Trīs kolonnas: pārvalde, process, GP; fiksēts layout (24%/38%/38%). |
| SPEC-014-FR-003 | GP avots: katalogs (autoritatīvs), citādi procesa `products`. |
| SPEC-014-FR-004 | Akordeoni + bulk atvēršana/aizvēršana. |
| SPEC-014-FR-005 | Excel eksports (`#exportExecutorsExcelBtn`). |
| SPEC-014-FR-006 | Inline edit toggle **nemaina** render — nefunkcionāls. |
| SPEC-014-FR-007 | Klikšķis atver procesa/GP kartiņu. |

## 5. Lietotāja darbības
- Atver Izpildītājus; izvērš akordeonus; eksportē; navigē uz kartiņām.

## 6. Sistēmas reakcija
- `computeExecutors()` + DOM render; `refreshExtraTableFilters()`.

## 7. Datu avoti un glabāšana
`getProcessRows()`, `getCatalogRows()`.

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
Nav specifisku.

## 10. Integrācijas
SPEC-004, SPEC-005, SPEC-012.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-014-AC-001 | Atverot sadaļu, placeholder pazūd un parādās datu tabula. |
| SPEC-014-AC-002 | GP no kataloga parādās pie pareizā procesa/pārvaldes. |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-005, SPEC-012

---

# SPEC-015 — Pielikumi un failu glabāšana

## 1. Mērķis
Failu pievienošana kartiņām, rokasgrāmatai un izmaiņu pieteikumiem.

## 2. Darbības joma
`Procesa kartina.js`, `Rokasgramata.js`, `Izmainu_pieteikums.js`, `DB.js` Storage API.

## 3. Lietotāju lomas
- Kartiņu pielikumi: `admin_edit`.
- Rokasgrāmatas augšupielāde: `admin_edit`.
- Rokasgrāmatas builtin skatīšana/saglabāšana/e-pasts: visas.
- Pieteikuma pielikumi: visas (SPEC-016).

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-015-FR-001 | Bucket noklusējums: `pieteikumu-vesture` (`PV_SUPABASE_STORAGE_BUCKET` override). |
| SPEC-015-FR-002 | Kartiņu ceļš: `kartinu_pielikumi/{subfolder}/...` via `uploadCardAttachmentFiles`. |
| SPEC-015-FR-003 | Pieteikumu ceļš: `pielikumi_uz_pieteikumiem/...` via `uploadChangeRequestFiles`. |
| SPEC-015-FR-004 | Vēsture: `vesture/pieteikums_{id}.json` via `savePieteikumuVestureSnapshot`. |
| SPEC-015-FR-005 | Kartiņu pielikumi RAM (`stores.process`/`catalog`); persistēti saglabājot kartiņu JSON. |
| SPEC-015-FR-006 | Rokasgrāmata: builtin `docs/Procesu_registrs_tehniska_specifikacija.docx`; lietotāja — `rokasgramata/` + localStorage. |
| SPEC-015-FR-007 | Storage failu **dzēšana** kodā **nav** implementēta. |
| SPEC-015-FR-008 | Private bucket + `getPublicUrl` — signed URL **nav** implementēts. |

## 5. Lietotāja darbības
- Pievieno failus kartiņā; saglabā kartiņu; lejupielādē/e-pasts no Rokasgrāmatas; pievieno pielikumus pieteikumam.

## 6. Sistēmas reakcija
- Augšupielāde → public URL → metadati formā/JSON; kļūda → `mapDbError` / alert.

## 7. Datu avoti un glabāšana
- Supabase Storage.
- `localStorage`: `pv_rokasgramata_pielikumi_v1`, `pv_rokasgramata_hidden_v1`.
- `GP_kartinas_papildu_JSON.cardAttachments`.

## 8. Validācijas noteikumi
- Failu tipi: `accept` atribūti HTML (pdf, doc, docx, attēli u.c.) — nav servera validācijas.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Bucket not found | Detalizēts `alert` ar instrukcijām |
| Nav `uploadCardAttachmentFiles` | `alert`, augšupielāde neizdodas |

## 10. Integrācijas
Supabase Storage; sk. `SUPABASE_STORAGE_izmainu_pielikumi.md`.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-015-AC-001 | Veiksmīga kartiņas pielikuma augšupielāde rāda saiti sarakstā. |
| SPEC-015-AC-002 | Rokasgrāmatas «Saglabāt» lejupielādē `.docx` failu. |
| SPEC-015-AC-003 | Builtin pielikuma «Dzēst» noņem to no saraksta (localStorage). |

## 12. Saistītās specifikācijas
SPEC-004, SPEC-005, SPEC-016, SPEC-019, SPEC-020

---

# SPEC-016 — Izmaiņu pieteikums

## 1. Mērķis
Formālās izmaiņu pieprasījuma iesniegšana ar pielikumiem un e-pasta nosūtīšanu.

## 2. Darbības joma
`changeRequestCard`, `Izmainu_pieteikums.js`.

## 3. Lietotāju lomas
Visas — **nav** `canEdit` ierobežojuma.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-016-FR-001 | Veidlapa: iesniedzējs, procesu reģistra lauki, GP lauki, pamatojums, admin atbilde. |
| SPEC-016-FR-002 | Opcionāli pielikumi → Storage (SPEC-015). |
| SPEC-016-FR-003 | Pilns teksts → JSON snapshot Storage (`vesture/`). |
| SPEC-016-FR-004 | Īss log → `localStorage.change_request_log` (max 20). |
| SPEC-016-FR-005 | E-pasts: `mailto:irina.kupcova@vid.gov.lv`; body saīsināts ~1900 simboli; pilns teksts clipboard. |
| SPEC-016-FR-006 | Nav automātiskas saites ar atvērtām kartiņām — manuāla aizpildīšana. |

## 5. Lietotāja darbības
- Atver veidlapu; aizpilda; pievieno failus; iesniedz.

## 6. Sistēmas reakcija
- Augšupielāde → snapshot → mailto → alert ar instrukcijām.

## 7. Datu avoti un glabāšana
Storage + `change_request_log`.

## 8. Validācijas noteikumi
**NAV NOSKAIDROTS** — obligāto lauku saraksts submit priekšā (kods neprasa visus laukus).

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Pielikumu augšupielāde neizdodas | Submit apstājas (return) |
| E-pasts neatveras | Alert: ielīmēt no starpliktuves |

## 10. Integrācijas
E-pasta klients (mailto); Storage (SPEC-015).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-016-AC-001 | Veiksmīgs submit mēģina atvērt e-pastu ar adresātu `irina.kupcova@vid.gov.lv`. |
| SPEC-016-AC-002 | Pielikumu kļūda rāda saprotamu ziņojumu par bucket/politikām. |

## 12. Saistītās specifikācijas
SPEC-015, SPEC-020

---

# SPEC-017 — Realtime sinhronizācija un keepalive

## 1. Mērķis
Datu aktualitāte vairākos klientos un Supabase projekta aktivitātes uzturēšana.

## 2. Darbības joma
`DB.startSync`, `app:db-sync`, `pingKeepAlive`, GitHub Actions workflow.

## 3. Lietotāju lomas
Automātiska sistēmas funkcija — lietotājs netieši redz atjauninājumus.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-017-FR-001 | Realtime kanāls `app-db-sync`; `postgres_changes` uz galvenajām tabulām. |
| SPEC-017-FR-002 | Polling fallback ik **7 s** (`pollMs` default). |
| SPEC-017-FR-003 | Single-table: `procesu_registrs` → kind `"all"`; arī `procesu_jomas`, `normativie_akti`, klasifikatori. |
| SPEC-017-FR-004 | Rakstīšana emitē `app:db-sync` ar `source: "html"`. |
| SPEC-017-FR-005 | Atvērtam redaktoram (joma/NA) sync var izlaist pārlādi. |
| SPEC-017-FR-006 | Klienta keepalive: `pingKeepAlive()` ne biežāk kā reizi **6 dienās** (`pv_supabase_keepalive_at`). |
| SPEC-017-FR-007 | Servera keepalive: GitHub Actions nedēļas cron REST ping. |

## 5. Lietotāja darbības
Nav tiešu — lietotne darbojas fonā.

## 6. Sistēmas reakcija
- Sync → `loadDb()`, `renderTable()`, `NormAkti.render()` u.c.
- Keepalive → vienkāršs SELECT.

## 7. Datu avoti un glabāšana
Supabase Realtime + PostgreSQL.

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Realtime atvienots | Polling turpina |
| Keepalive kļūda | `console.warn`; lietotne turpina darboties |
| Konflikts divos klientos | **Nav** versiju kontroles — pēdējais rakstījums (**NAV NOSKAIDROTS** UX) |

## 10. Integrācijas
Supabase Realtime; GitHub Actions (`.github/workflows/supabase-keepalive.yml`).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-017-AC-001 | Izmaiņa DB citā sesijā parādās tabulā ≤ ~7 s (polling) vai ātrāk (Realtime). |
| SPEC-017-AC-002 | `startSync` izsauc pēc veiksmīgas `loadDb()` inicializācijas. |

## 12. Saistītās specifikācijas
SPEC-020, SPEC-004–SPEC-009

---

# SPEC-018 — Palīdzība, BUJ un abreviatūras

## 1. Mērķis
Lietotāja palīdzība un terminu skaidrojumi.

## 2. Darbības joma
`Skaidrojumi.js`, `Abreviaturas.js`, `#faqModalCard`, `#skaidrojumiAdminCard`.

## 3. Lietotāju lomas
- BUJ, «i» ikonas: visas.
- Admin panelis: `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-018-FR-001 | BUJ modālis no `pv_help_faq_v1`. |
| SPEC-018-FR-002 | Palīdzības ikonas no `pv_help_icons_v1` (selector → teksts). |
| SPEC-018-FR-003 | Admin var CRUD ikonas un BUJ ierakstus. |
| SPEC-018-FR-004 | `Abreviaturas.js` — hover tooltip hardcoded saīsinājumiem (VID, IAD, u.c.). |
| SPEC-018-FR-005 | Admin palīdzības sarakstā minēts `#extraViewsCard` — elements **NAV NOSKAIDROTS** vai noņemts. |

## 5. Lietotāja darbības
- Atver BUJ; hover uz abreviatūrām; admin konfigurē palīdzību.

## 6. Sistēmas reakcija
- Render modāli/tooltip; saglabā localStorage.

## 7. Datu avoti un glabāšana
`localStorage.pv_help_icons_v1`, `pv_help_faq_v1`.

## 8. Validācijas noteikumi
**NAV NOSKAIDROTS**.

## 9. Kļūdu un izņēmumu scenāriji
Nav specifisku.

## 10. Integrācijas
Nav ārējo.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-018-AC-001 | BUJ modālis atveras un rāda ierakstus. |
| SPEC-018-AC-002 | Tikai `admin_edit` redz «Skaidrojuma ievietošana». |

## 12. Saistītās specifikācijas
SPEC-002, SPEC-003

---

# SPEC-019 — Rokasgrāmata

## 1. Mērķis
Metodikas resursi un dokumentu pielikumi.

## 2. Darbības joma
`manualCard`, `Rokasgramata.js`, modāļi metodikai/konceptam.

## 3. Lietotāju lomas
Skatīšana/lejupielāde/e-pasts — visas; pielikumu pievienošana — `admin_edit`.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-019-FR-001 | Pogas: Procesu vadības metodika, Koncepts (modāļi). |
| SPEC-019-FR-002 | Metodikas/plūsmu URL: `window.PV_URLS.metodika`, `flowchartsRepo` — ja tukši, alert/hint. |
| SPEC-019-FR-003 | Pielikumu saraksts ar darbībām: Saglabāt, Nosūtīt e-pastā, Dzēst. |
| SPEC-019-FR-004 | Builtin: tehniskā specifikācija Word (`.docx`). |
| SPEC-019-FR-005 | Lietotāja pielikumi: Storage + `pv_rokasgramata_pielikumi_v1`. |

## 5. Lietotāja darbības
- Atver Rokasgrāmata; lejupielādē specifikāciju; nosūta e-pastā; (admin) pievieno pielikumu.

## 6. Sistēmas reakcija
- `fetch`+blob / mailto / localStorage hidden list.

## 7. Datu avoti un glabāšana
Repo fails `docs/...docx`; Storage; localStorage (SPEC-015).

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
Augšupielādes kļūda — kā SPEC-015.

## 10. Integrācijas
mailto; Storage; ārējās URL (metodika).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-019-AC-001 | Rokasgrāmata rāda builtin Word pielikumu. |
| SPEC-019-AC-002 | «Saglabāt» lejupielādē `.docx`. |
| SPEC-019-AC-003 | Bez `PV_URLS.metodika` metodikas modālis rāda hint, ne saiti. |

## 12. Saistītās specifikācijas
SPEC-015, SPEC-003

---

# SPEC-020 — Datu slānis, Supabase un localStorage rezerve

## 1. Mērķis
Centralizēta datu piekļuve, shēmas adaptācija un rezerves mehānismi.

## 2. Darbības joma
`DB.js`, `migrations/`, `scripts/db-fix.mjs`.

## 3. Lietotāju lomas
Netieša — visi CRUD blokiem.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-020-FR-001 | Galvenā tabula: `procesu_registrs`; single-table GP modelis (noklusējums). |
| SPEC-020-FR-002 | Papildu tabulas: `procesu_jomas`, `normativie_akti`, `norm_akti_klasifikatori`. |
| SPEC-020-FR-003 | Kolonnu `aliasMap` — daudzas nosaukumu variācijas. |
| SPEC-020-FR-004 | `runWriteWithMissingColumnRetry` — adaptē pie esošām kolonnām. |
| SPEC-020-FR-005 | Vienreizēja uzturēšana: `pv_db_maintenance_v3` (jomu/GP meta labojumi). |
| SPEC-020-FR-006 | NA/Joma: localStorage fallback, ja tabula trūkst. |
| SPEC-020-FR-007 | Migrāciju secība: sk. `migrations/README.md` (7 faili). |
| SPEC-020-FR-008 | `catalog_items_json` kolonna migrācijā — **neizmanto** `DB.js`. |

## 5. Lietotāja darbības
Nav tiešu.

## 6. Sistēmas reakcija
- CRUD caur `window.DB.*`; kļūdas caur `mapDbError`.

## 7. Datu avoti un glabāšana
Supabase PostgreSQL + localStorage (sk. indeksu zemāk).

## 8. Validācijas noteikumi
DB līmenī: NOT NULL aizpildīšana ar `"—"` retry laikā.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Trūkstoša tabula (NA/Joma) | `[]` / localStorage |
| Trūkstoša kolonna | Retry bez kolonnas |

## 10. Integrācijas
Supabase; migrācijas SQL Editor.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-020-AC-001 | `DB.load()` atgriež masīvu pēc veiksmīga savienojuma. |
| SPEC-020-AC-002 | Pēc migrāciju palaišanas NA CRUD raksta `normativie_akti`, ne tikai localStorage. |

## 12. Saistītās specifikācijas
Visi CRUD bloki; SPEC-021.

---

# SPEC-021 — Drošība un piekļuves ierobežojumi

## 1. Mērķis
Dokumentēt zināmos drošības mehānismus un riskus esošajā implementācijā.

## 2. Darbības joma
Frontend, Supabase RLS, Storage policies.

## 3. Lietotāju lomas
**Nav īstas autentifikācijas** — lomas uzticamas klienta pusē.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-021-FR-001 | Frontend izmanto tikai **anon** atslēgu. |
| SPEC-021-FR-002 | RLS migrācijās: permissive `anon`/`authenticated` CRUD (`USING (true)`). |
| SPEC-021-FR-003 | Storage prasa manuāli izveidotu bucket un politikas. |
| SPEC-021-FR-004 | `config.js` netiek commitots; dev atslēga `DB.js` — publiska frontend paradigmā. |
| SPEC-021-FR-005 | Service role **nedrīkst** būt frontendā (dokumentācijas prasība). |

## 5. Lietotāja darbības
Nav specifisku.

## 6. Sistēmas reakcija
RLS kļūda → `mapDbError` ar RLS ziņojumu.

## 7. Datu avoti un glabāšana
Supabase politikas.

## 8. Validācijas noteikumi
Nav lietotāja līmeņa autentifikācijas.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| RLS bloķē operāciju | Kļūdas ziņojums |
| localStorage loma = admin_edit | UI atļauj mēģināt rakstīt |

## 10. Integrācijas
Supabase Auth — **NĀKOTNE** (tehniskā specifikācija §15).

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-021-AC-001 | Repozitorijā nav `service_role` atslēgas frontend failos. |
| SPEC-021-AC-002 | RLS bloķēšanas gadījumā lietotājs redz saprotamu kļūdu (ne klusu neveiksmi). |

## 12. Saistītās specifikācijas
SPEC-002, SPEC-020

---

# SPEC-022 — Mērījumi (NĀKOTNE — nav implementēts)

## 1. Mērķis
**NĀKOTNE:** procesu mērījumu statistika un ievade.

## 2. Darbības joma
`metricsCard` — tikai placeholder.

## 3. Lietotāju lomas
N/A

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-022-FR-001 | **NĀKOTNE:** UI rāda hint «Nākotnē šeit būs statistika par procesu mērījumiem un funkcija mērījumu ievadei.» |

## 5–10. (Saīsināti — nav implementēts)
Nav lietotāja plūsmu.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-022-AC-001 | Sadaļa atveras bez kļūdām un rāda placeholder tekstu. |

## 12. Saistītās specifikācijas
SPEC-003

---

# SPEC-023 — UI iestatījumi un kopīgošana

## 1. Mērķis
Tēma, saites kopīgošana un līmeņa parametri URL.

## 2. Darbības joma
`#settingsPanel`, `#themeToggleBtn`, `#shareBtn`, `#emailBtn`.

## 3. Lietotāju lomas
Visas.

## 4. Funkcionālās prasības

| ID | Prasība |
|----|---------|
| SPEC-023-FR-001 | Gaišs/tumšs režīms → `localStorage.pv_theme_mode`. |
| SPEC-023-FR-002 | Kopīgotā saite iekļauj `user` un `level` parametrus. |
| SPEC-023-FR-003 | E-pasta poga: mailto ar lapas URL. |

## 5. Lietotāja darbības
- Pārslēdz tēmu; kopīgo saiti; sūta saiti e-pastā.

## 6. Sistēmas reakcija
- Saglabā tēmu; kopē URL uz starpliktuves / atver mailto.

## 7. Datu avoti un glabāšana
`pv_theme_mode`; URL parametri.

## 8. Validācijas noteikumi
Nav.

## 9. Kļūdu un izņēmumu scenāriji
| Scenārijs | Reakcija |
|-----------|----------|
| Clipboard nav pieejams | Alert: neizdevās kopēt |

## 10. Integrācijas
mailto; clipboard API.

## 11. Pieņemšanas kritēriji

| ID | Kritērijs |
|----|-----------|
| SPEC-023-AC-001 | Tēma saglabājas pēc pārlādes. |
| SPEC-023-AC-002 | Kopīgošana iekļauj `level` vērtību URL. |

## 12. Saistītās specifikācijas
SPEC-002, SPEC-004

---


# II. daļa — Lietotāja darbību plūsmas (UF)

> **Formāts:** Lietotājs izdara X → Sistēma izdara Y → Lietotājs redz Z


## 0. Vispārīgi

### UF-001 — Pirmā ielāde (SPEC-001, SPEC-020)

| | |
|---|---|
| **Lietotājs izdara** | Atver lietotni pārlūkā caur HTTPS (GitHub Pages, Live Server u.c.). |
| **Sistēma izdara** | Ielādē `index.html`, JS moduļus, Supabase CDN; `init()` → `loadRoles()` → `loadDb()` → `renderTable()`; startē `DB.startSync({ pollMs: 7000 })`. |
| **Lietotājs redz** | Galveno lapu ar procesu reģistru (ja dati ielādēti), statusa joslu, navigāciju kreisajā panelī. |

### UF-002 — Atvēršana ar file:// (SPEC-001)

| | |
|---|---|
| **Lietotājs izdara** | Atver HTML ar dubultklikšķi (bez web servera). |
| **Sistēma izdara** | `warnIfFileProtocol()` brīdina; DB pieprasījumi bieži neizdodas. |
| **Lietotājs redz** | Brīdinājumu statusa joslā; pie saglabāšanas — `mapDbError` ar norādi izmantot HTTP serveri. |

### UF-003 — Lomu maiņa (SPEC-002)

| | |
|---|---|
| **Lietotājs izdara** | Augšējā rīkjoslā izvēlas lietotāju (`#userSelect`), lomu (`#roleSelect`), nospiež **Saglabāt lomu**. |
| **Sistēma izdara** | Raksta `localStorage.roleMap`; pārrēķina `canEdit()`; atjauno tabulas, redaktoru `disabled` stāvokli; `refreshHelpAdminVisibility()`. |
| **Lietotājs redz** | `admin_edit` — aktīvi saglabāšanas lauki; `viewer` — bloķēti lauki, paslēpta **Saglabāt lomu** (ja viewer); admin panelis palīdzībai tikai `admin_edit`. |

### UF-004 — Navigācija starp sadaļām (SPEC-003)

| | |
|---|---|
| **Lietotājs izdara** | Kreisajā panelī noklikšķina uz sadaļas (piem., Procesu reģistrs, GP katalogs, NA). |
| **Sistēma izdara** | `closeAllMainSections()` paslēpj visas kartes; atver izvēlēto `#...Card`; izsauc attiecīgo render (`NormAkti.render`, `Rokasgramata.render`, u.c.). |
| **Lietotājs redz** | Tikai vienu galveno sadaļu; aktīvā navigācijas poga ar `nav-active`. |

### UF-005 — Tēmas pārslēgšana (SPEC-023)

| | |
|---|---|
| **Lietotājs izdara** | Iestatījumos nospiež **Gaišais/tumšais režīms**. |
| **Sistēma izdara** | Maina CSS klases; saglabā `localStorage.pv_theme_mode`. |
| **Lietotājs redz** | Atjauninātu dizainu; pēc pārlādes — saglabāto tēmu. |

### UF-006 — Kopīgot saiti (SPEC-023)

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Kopīgot** (share). |
| **Sistēma izdara** | Ģenerē URL ar `user` un `level` parametriem; kopē starpliktuvē. |
| **Lietotājs redz** | Alert **Saite nokopēta.** vai kļūdu par starpliktuves piekļuvi. |

---

## 1. Procesu reģistrs (SPEC-004)

### UF-101 — Skatīt procesu sarakstu (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā izvēlas **Procesu reģistrs**. |
| **Sistēma izdara** | Rāda `processListCard`; `renderTable()` — apvieno DB rindas, GP akordeonus, lapošanu (noklus. 100 rindas/lapa). |
| **Lietotājs redz** | Procesu tabulu ar GP apakšrindām, statistikas pīrāgu, «Lapa X/Y • ieraksti N». |

### UF-102 — Detalizētais / kompaktais skats (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Detalizētais skats**; maina **Pamatskats / Paplašinātais skats** (`#levelSelect`: 1 vai 2). |
| **Sistēma izdara** | Pārslēdz `processDetailedViewMode` un `applyLevel()` — rāda/slēpj `.col-extended` kolonnas. |
| **Lietotājs redz** | Tabulu ar vairāk vai mazāk kolonnām (iniciators, saistītie procesi, IT u.c.). |

### UF-103 — Atvērt procesa kartiņu skatīšanai (viewer / admin_view)

| | |
|---|---|
| **Lietotājs izdara** | Tabulā nospiež **Atvērt kartiņu**. |
| **Sistēma izdara** | `openEditor(r)`: paslēpj procesu tabulu; atver `editorCard`; aizpilda formu; **visi lauki disabled**; paslēpj **Dzēst**; `#modeHint` = «Skatīšanās režīms.» |
| **Lietotājs redz** | Procesa kartiņu ar datiem (pamatinformācija, GP, NA, izpildītāji, pielikumi), bet nevar rediģēt. |

### UF-104 — Labot esošu procesu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | (`admin_edit`) Atver kartiņu, maina laukus, nospiež **Saglabāt**. |
| **Sistēma izdara** | 1) Pārbauda `canEdit()`; 2) `confirm()` apstiprinājums; 3) `DB.update()` → `procesu_registrs`; 4) opc. sinhronizē procesa Nr.; 5) `reloadAllData()`; 6) `emitSync`. |
| **Lietotājs redz** | Atgriešanos procesu tabulā; statuss **Saglabāts.**; atjauninātas vērtības tabulā. |

### UF-105 — Jauns process (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Jauns process**, aizpilda laukus (obligāts: **Process** — nosaukums), saglabā. |
| **Sistēma izdara** | Ja nosaukums tukšs — statusa kļūda; citādi `confirm()` → `DB.insert()` → numerācijas ieteikums jaunam ierakstam; reload. |
| **Lietotājs redz** | Jaunu procesu tabulā vai kļūdu, ja nosaukums nav ievadīts. |

### UF-106 — Dzēst procesu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Kartiņā nospiež **Dzēst**, apstiprina. |
| **Sistēma izdara** | Atrod visas DB rindas ar tādu pašu `processNo` un/vai normalizētu nosaukumu; `DB.remove()` katrai; reload. |
| **Lietotājs redz** | **Dzēsts (N ieraksts/-i).** vai kļūdu, ja dzēšana neizdevās (RLS, atslēgas). |

### UF-107 — viewer mēģina saglabāt procesu (SPEC-002)

| | |
|---|---|
| **Lietotājs izdara** | (`viewer`) Mēģina saglabāt (ja somehow forma aktīva) vai atver jaunu procesu. |
| **Sistēma izdara** | Submit: `alert` «Labošana pieejama tikai admin (labot).»; lauki disabled. |
| **Lietotājs redz** | Kļūdas dialogu; dati nemainās. |

### UF-108 — Meklēt un filtrēt procesus (SPEC-012)

| | |
|---|---|
| **Lietotājs izdara** | Raksta `#searchInput`; izvēlas skatu (`#viewFilterSelect`: uzdevums / īpašnieks / GP / process); izmanto kolonnu header filtrus. |
| **Sistēma izdara** | Filtrē DOM rindas; reset lapošanu uz 1; var automātiski atvērt akordeonus. |
| **Lietotājs redz** | Tikai atbilstošās rindas. |

### UF-109 — Eksportēt procesu tabulu uz Excel

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Eksportēt uz Excel** procesu reģistrā. |
| **Sistēma izdara** | `exportTableToExcel("processTable", "procesu_registrs")`. |
| **Lietotājs redz** | Lejupielādētu `.xls` failu. |

### UF-110 — Atcelt saglabāšanu (confirm)

| | |
|---|---|
| **Lietotājs izdara** | Saglabāšanas dialogā nospiež **Atcelt**. |
| **Sistēma izdara** | Neizsauc DB; kartiņa paliek atvērta. |
| **Lietotājs redz** | Nemainītus datus redaktorā. |

---

## 2. Galaproduktu katalogs (SPEC-005)

### UF-201 — Skatīt GP katalogu (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā izvēlas **Galaproduktu katalogs**. |
| **Sistēma izdara** | `loadCatalogTypes()` (single-table: GP no `procesu_registrs`); render tabulu ar filtriem. |
| **Lietotājs redz** | GP sarakstu ar kolonnām (Nr., nosaukums, process, joma u.c.). |

### UF-202 — Labot GP kartiņu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Atver GP kartiņu, maina laukus (obligāts: **GP nosaukums**), saglabā. |
| **Sistēma izdara** | Validē nosaukumu; `confirm()`; `DB.updateCatalog()` → atjaunina procesa `products` + `GP_kartinas_papildu_JSON`; reload. |
| **Lietotājs redz** | Atjauninātu katalogu; statuss **Saglabāts.** |

### UF-203 — Jauns GP no kataloga (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Katalogā **Jauns GP**, aizpilda, saglabā. |
| **Sistēma izdara** | `DB.insertCatalog()` — pievieno GP procesam. |
| **Lietotājs redz** | Jaunu GP kataloga tabulā. |

### UF-204 — Jauns GP no procesa kartiņas (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Procesa kartiņā nospiež **Pievienot jaunu galaproduktu**. |
| **Sistēma izdara** | Aizver procesa kartiņu; atver GP redaktoru ar prefilla procesa datiem; GP nosaukums/Nr. tukši; `Numeracija.applyGpNumberSuggestion`. |
| **Lietotājs redz** | GP kartiņu ar aizpildītu procesu, tukšu GP nosaukumu. |

### UF-205 — Dzēst GP (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | GP kartiņā **Dzēst**, apstiprina. |
| **Sistēma izdara** | `DB.removeCatalog()` — noņem GP no procesa saraksta (nevis visu procesu). |
| **Lietotājs redz** | GP pazudusi no kataloga. |

### UF-206 — Piesaistīt jomu GP (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | GP kartiņā izvēlas **Darbības joma** (`#cDarbibasJoma`), saglabā. |
| **Sistēma izdara** | Saglabā `darbibasJoma` GP meta / kataloga rindā. |
| **Lietotājs redz** | GP jomu skatā un statistikā zem izvēlētās jomas. |

### UF-207 — Eksportēt katalogu uz Excel

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Eksportēt uz Excel** katalogā. |
| **Sistēma izdara** | `exportTableToExcel("catalogTable", "gp_katalogs")`. |
| **Lietotājs redz** | Lejupielādētu Excel failu. |

---

## 3. Numerācija (SPEC-006)

### UF-301 — Automātisks procesa numura ieteikums (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Izveido jaunu procesu vai maina **Procesa grupu** (pamatdarbība / atbalsts / pārvaldība). |
| **Sistēma izdara** | `Numeracija.applyProcessNumberSuggestion` — prefikss P/A/M, nākamais brīvais numurs. |
| **Lietotājs redz** | Ieteikto numuru laukā **Procesa Nr.** (piem. `P-1`, `A-2`). |

### UF-302 — Automātisks GP numura ieteikums (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Izveido jaunu GP, saistīts ar procesu. |
| **Sistēma izdara** | `Numeracija.applyGpNumberSuggestion` — formāts `{prefix}-{procNum}-{sub}`. |
| **Lietotājs redz** | Ieteikto GP Nr. (piem. `P-1-1`). |

---

## 4. Procesu jomas (SPEC-007)

### UF-401 — Skatīt jomu sarakstu (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā **Jomas (piesaiste galaproduktiem)**. |
| **Sistēma izdara** | `renderProcessJomasView()` — jomu pīrāgs, tabula ar GP akordeoniem. |
| **Lietotājs redz** | Jomas, GP skaitu, procesus; var atvērt GP no akordeona. |

### UF-402 — Atvērt jomu kartiņu no saraksta (visas / admin_edit labošanai)

| | |
|---|---|
| **Lietotājs izdara** | Klikšķina uz jomas nosaukuma tabulā. |
| **Sistēma izdara** | `openJomaEditor(jomaName)` — atver `jomaEditorCard`, ielādē datus. |
| **Lietotājs redz** | Jomu kartiņu (nosaukums, skaidrojums, saistītie NA). |

### UF-403 — Pievienot jaunu jomu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Jomu skatā nospiež **Pievienot jaunu jomu**. |
| **Sistēma izdara** | `openNewJoma()` — tukša jomu kartiņa. |
| **Lietotājs redz** | Jaunas jomas redaktoru. |

---

## 5. Jomu kartiņas (SPEC-008)

### UF-501 — Saglabāt jomu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Ievada **jomas nosaukumu** un skaidrojumu, nospiež **Saglabāt**. |
| **Sistēma izdara** | Validē nosaukumu; `DB.upsertJomaCard()` + localStorage; atjauno pielāgoto jomu sarakstu. |
| **Lietotājs redz** | Aizvērtu kartiņu; joma parādās jomu skatos un GP select. |

### UF-502 — Pārdēvēt jomu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Maina jomas nosaukumu kartiņā, saglabā. |
| **Sistēma izdara** | `saveCardWithRename`; atjauno saistītos NA (`renameJomaInNormActs`). |
| **Lietotājs redz** | Jauno nosaukumu visur, kur joma tiek rādīta. |

### UF-503 — Dzēst jomu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Kartiņā **Dzēst**, apstiprina. |
| **Sistēma izdara** | `DB.deleteJomaCard()` + localStorage tīrīšana. |
| **Lietotājs redz** | Joma pazudusi no sarakstiem. |

---

## 6. Normatīvie akti — NA (SPEC-009)

### UF-601 — Skatīt NA sarakstu (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā **Procesus reglamentējoši normatīvie akti**. |
| **Sistēma izdara** | `NormAkti.render()` — tabula no DB vai localStorage. |
| **Lietotājs redz** | NA sarakstu; kolonnas: veids, nosaukums, numurs, pants/punkts u.c. |

### UF-602 — Meklēt NA (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Raksta `#naSearchInput`. |
| **Sistēma izdara** | Filtrē pēc substring visos NA laukos. |
| **Lietotājs redz** | Sašaurinātu sarakstu. |

### UF-603 — Izveidot jaunu NA (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | **Jauns NA**, aizpilda (obligāts: **nosaukums**), saglabā. |
| **Sistēma izdara** | `DB.insertNormAct()`; ja tabulas nav — localStorage + brīdinājums par migrāciju. |
| **Lietotājs redz** | Jaunu NA tabulā vai brīdinājumu par lokālu saglabāšanu. |

### UF-604 — Labot / dzēst NA (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Atver NA kartiņu, labo vai dzēš ar apstiprinājumu. |
| **Sistēma izdara** | `updateNormAct` / `deleteNormAct`. |
| **Lietotājs redz** | Atjauninātu sarakstu. |

### UF-605 — Saistīt NA ar procesu no procesa kartiņas (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Procesa kartiņā NA sadaļā **Pievienot normatīvo aktu**, atzīmē esošus NA checkbox sarakstā. |
| **Sistēma izdara** | Atjaunina NA ieraksta laukus `procesa_nr`, `process_nosaukums`; **jaunu NA šeit neveido**. |
| **Lietotājs redz** | Saistīto NA sarakstu ar linkiem; var **Noņemt** atsevišķu saiti. |

### UF-606 — Saistīt NA ar GP (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | GP kartiņā izmanto NA picker (kā UF-605). |
| **Sistēma izdara** | Atjaunina NA laukus `gp_nr`, `gp_nosaukums`. |
| **Lietotājs redz** | Saistītos NA GP kartiņā. |

### UF-607 — Saistīt NA ar jomu (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Jomu kartiņā izmanto NA saites UI (`renderJomaLinks`). |
| **Sistēma izdara** | Atjaunina NA lauku `procesu_joma`. |
| **Lietotājs redz** | NA sarakstu jomu kartiņā. |

---

## 7. Procesu grupas (SPEC-010)

### UF-701 — Skatīt grupu pārskatu (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā **Procesu grupas**. |
| **Sistēma izdara** | `renderProcessGroupsView()` — pīrāga diagramma, tabula. |
| **Lietotājs redz** | Grupu sadalījumu (pamatdarbība, atbalsts, pārvaldība), procesu sarakstu pa grupām. |

### UF-702 — Atvērt procesu no grupu tabulas

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Atvērt kartiņu** / procesa saiti grupu tabulā. |
| **Sistēma izdara** | `openEditor(r)` — skatīšanās vai labošanas režīms pēc lomas. |
| **Lietotājs redz** | Procesa kartiņu. |

---

## 8. Statistika (SPEC-011)

### UF-801 — Skatīt statistiku (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā **Statistika**. |
| **Sistēma izdara** | `Statistika.js` — org / process / joma bloki ar bar charts. |
| **Lietotājs redz** | Trīs salokāmus statistikas paneļus ar diagrammām. |

---

## 9. Uzdevumu skats (SPEC-013) — ierobežota pieejamība

### UF-901 — Skatīt uzdevumu kopsavilkumu

| | |
|---|---|
| **Lietotājs izdara** | **NAV NOSKAIDROTS** — standarta navigācijā nav pogas; `tasksViewCard` pēc noklusējuma paslēpts. |
| **Sistēma izdara** | Ja karte redzama: `renderTasksView()` grupē pēc `taskNo`. |
| **Lietotājs redz** | Tabulu: uzdevuma Nr., nosaukums, procesu skaits, procesi, pakalpojumi. |

### UF-902 — Labot uzdevumu (admin_edit, ja sadaļa pieejama)

| | |
|---|---|
| **Lietotājs izdara** | Atver uzdevuma kartiņu, maina, saglabā. |
| **Sistēma izdara** | `DB.updateTaskByNo()` vai `insert()` jaunam. |
| **Lietotājs redz** | Atjauninātu uzdevumu skatu. |

---

## 10. Izpildītāji (SPEC-014)

### UF-1001 — Skatīt izpildītāju agregāciju (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā **Izpildītāji**. |
| **Sistēma izdara** | `renderExecutorsView()` — noņem placeholder, injicē tabulu: pārvalde → process → GP. |
| **Lietotājs redz** | Trīskolonu tabulu ar akordeoniem. |

### UF-1002 — Pāriet uz procesu/GP no izpildītāju skata

| | |
|---|---|
| **Lietotājs izdara** | Klikšķina uz procesa vai GP saites tabulā. |
| **Sistēma izdara** | Atver procesa vai GP kartiņu. |
| **Lietotājs redz** | Attiecīgo kartiņu (skatīšanās/labošana pēc lomas). |

### UF-1003 — Eksportēt izpildītājus uz Excel

| | |
|---|---|
| **Lietotājs izdara** | **Eksportēt uz Excel** izpildītāju sadaļā. |
| **Sistēma izdara** | `renderExecutorsView()` + `exportTableToExcel("executorsTable", "izpilditaji")`. |
| **Lietotājs redz** | Lejupielādētu Excel failu. |

---

## 11. Pielikumi (SPEC-015)

### UF-1101 — Pievienot pielikumu procesa kartiņā (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Procesa kartiņā izvēlas failu **Papildu informācija** sadaļā. |
| **Sistēma izdara** | `uploadCardAttachmentFiles` → Storage `kartinu_pielikumi/proc_{ProcesaNr}/`; pievieno RAM sarakstam. |
| **Lietotājs redz** | Pielikuma saiti sarakstā; pēc kartiņas saglabāšanas — persistēts JSON. |

### UF-1102 — Noņemt pielikumu no kartiņas (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Noņemt** pie pielikuma (pirms/pēc saglabāšanas atkarībā no plūsmas). |
| **Sistēma izdara** | Noņem no atmiņas saraksta; Storage failu **nedzēš**. |
| **Lietotājs redz** | Pielikumu vairs sarakstā nav. |

### UF-1103 — GP kartiņas pielikums (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Kā UF-1101, GP kartiņā (`cAttachmentsFile`). |
| **Sistēma izdara** | Augšupielāde uz `kartinu_pielikumi/gp_{GPNosaukums}/`. |
| **Lietotājs redz** | Pielikumu GP kartiņā. |

---

## 12. Izmaiņu pieteikums (SPEC-016)

### UF-1201 — Aizpildīt un nosūtīt pieteikumu (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | **Izmaiņu pieteikuma veidlapa** → aizpilda laukus → opc. pievieno failus → **Nosūtīt**. |
| **Sistēma izdara** | 1) Augšupielādē pielikumus Storage; 2) saliek pilnu tekstu; 3) opc. JSON snapshot `vesture/`; 4) `change_request_log` localStorage; 5) kopē pilnu tekstu starpliktuvē; 6) atver `mailto:irina.kupcova@vid.gov.lv`. |
| **Lietotājs redz** | E-pasta klientu (vai alert ielīmēt Ctrl+V); statusu par pielikumiem/snapshot. |

### UF-1202 — Pieteikums bez pielikumiem

| | |
|---|---|
| **Lietotājs izdara** | Nosūta veidlapu bez failiem. |
| **Sistēma izdara** | Izlaist augšupielādi; veido tekstu un mailto. |
| **Lietotājs redz** | E-pastu ar pieteikuma tekstu (saīsinātu body). |

### UF-1203 — Pielikumu augšupielādes kļūda

| | |
|---|---|
| **Lietotājs izdara** | Pievieno pielikumu, bet Storage bucket nav konfigurēts. |
| **Sistēma izdara** | `alert` ar «Bucket not found» un instrukcijām; submit apstājas. |
| **Lietotājs redz** | Detalizētu kļūdu; pieteikums netiek nosūtīts. |

---

## 13. Rokasgrāmata (SPEC-019)

### UF-1301 — Skatīt tehnisko specifikāciju Word (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | **Rokasgrāmata** → sadaļa **Pielikumi** → klikšķina uz **Procesu reģistrs — tehniskā specifikācija (Word)**. |
| **Sistēma izdara** | Atver `docs/Procesu_registrs_tehniska_specifikacija.docx` jaunā cilnē / lejupielādi. |
| **Lietotājs redz** | Word failu pārlūkā vai lejupielādi. |

### UF-1302 — Saglabāt specifikāciju datorā (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Nospiež **Saglabāt** pie pielikuma. |
| **Sistēma izdara** | `fetch` + blob lejupielāde `.docx`. |
| **Lietotājs redz** | Lejupielādētu failu. |

### UF-1303 — Nosūtīt specifikāciju e-pastā (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | **Nosūtīt e-pastā**. |
| **Sistēma izdara** | Atver `mailto:` ar saiti uz dokumentu. |
| **Lietotājs redz** | E-pasta compose logu. |

### UF-1304 — Noņemt pielikumu no saraksta (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | **Dzēst** pie builtin pielikuma. |
| **Sistēma izdara** | Pievieno ID `localStorage.pv_rokasgramata_hidden_v1`. |
| **Lietotājs redz** | Pielikumu vairs sarakstā nav (lokāli šim pārlūkam). |

### UF-1305 — Pievienot pielikumu rokasgrāmatai (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | **Pievienot pielikumu**, izvēlas failu. |
| **Sistēma izdara** | `uploadCardAttachmentFiles(..., "rokasgramata")`; metadati → `pv_rokasgramata_pielikumi_v1`. |
| **Lietotājs redz** | Jaunu pielikumu sarakstā ar Saglabāt/E-pasts/Dzēst. |

### UF-1306 — Metodika un koncepts

| | |
|---|---|
| **Lietotājs izdara** | **Procesu vadības metodika** vai **Koncepts**. |
| **Sistēma izdara** | Atver modāli; ja `PV_URLS.metodika` tukšs — hint/alert. |
| **Lietotājs redz** | Modāli ar saiti vai ziņu, ka URL nav iestatīts. |

---

## 14. Palīdzība un BUJ (SPEC-018)

### UF-1401 — Atvērt BUJ (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | **Biežāk uzdotie jautājumi un skaidrojumi**. |
| **Sistēma izdara** | `renderFaqModal()` no `pv_help_faq_v1`. |
| **Lietotājs redz** | BUJ modāli. |

### UF-1402 — Palīdzības ikona «i» (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Novieto kursoru virs «i» ikonas pie lauka. |
| **Sistēma izdara** | Rāda tooltip no `pv_help_icons_v1`. |
| **Lietotājs redz** | Īsu skaidrojumu. |

### UF-1403 — Admin: konfigurēt palīdzību (admin_edit)

| | |
|---|---|
| **Lietotājs izdara** | Navigācijā **Skaidrojuma ievietošana** → pievieno/labo ikonas vai BUJ. |
| **Sistēma izdara** | CRUD `localStorage` (`pv_help_icons_v1`, `pv_help_faq_v1`). |
| **Lietotājs redz** | Atjauninātu palīdzību visā lietotnē. |

### UF-1404 — Abreviatūru skaidrojums (visas lomas)

| | |
|---|---|
| **Lietotājs izdara** | Hover virs saīsinājuma (VID, IAD, u.c.). |
| **Sistēma izdara** | `Abreviaturas.js` tooltip. |
| **Lietotājs redz** | Pilno nosaukumu. |

---

## 15. Realtime sinhronizācija (SPEC-017) — netieša lietotāja plūsma

### UF-1501 — Cits lietotājs maina datus

| | |
|---|---|
| **Lietotājs A izdara** | Skatās procesu tabulu. |
| **Lietotājs B izdara** | (`admin_edit`) Saglabā procesu citā pārlūkā. |
| **Sistēma izdara** | Realtime/polling (7 s) → `app:db-sync` → `loadDb()`, `renderTable()`. |
| **Lietotājs A redz** | Tabulu atjauninātu bez manuālas pārlādes (ja sync darbojas). |

### UF-1502 — Redaktors atvērts sync laikā

| | |
|---|---|
| **Lietotājs izdara** | Rediģē jomu/NA kartiņu. |
| **Sistēma izdara** | Sync listener **izlaiž** pārlādi, ja attiecīgais redaktors atvērts. |
| **Lietotājs redz** | Netraucētu rediģēšanu; pēc aizvēršanas — nākamais sync atjaunina. |

---

## 16. Kļūdu scenāriji (kopā)

| UF ID | Lietotājs izdara | Sistēma izdara | Lietotājs redz |
|-------|------------------|----------------|----------------|
| UF-E01 | Saglabā bez procesa nosaukuma (jauns) | Statusa kļūda | «Ievadiet jaunā procesa nosaukumu…» |
| UF-E02 | Saglabā GP bez nosaukuma | Statusa kļūda | «Ievadiet galaprodukta nosaukumu.» |
| UF-E03 | Saglabā NA bez nosaukuma | `alert` | «Ievadiet normatīvā akta nosaukumu.» |
| UF-E04 | DB RLS bloķē | `mapDbError` | Alert + statuss «DB kļūda» |
| UF-E05 | Atceļ confirm() | Nav DB izsaukuma | Paliek redaktorā |
| UF-E06 | NA tabula DB nav | localStorage + brīdinājums | Dati lokāli; brīdinājums par migrāciju |
| UF-E07 | viewer mēģina CRUD | Guard / disabled | Alert vai neaktīvi lauki |

---

## 17. NĀKOTNE — nav lietotāja plūsmu

| Sadaļa | Statuss |
|--------|---------|
| Mērījumi (`metricsCard`) | Hint: «Nākotnē šeit būs…» — nav datu, nav CRUD |
| Procesu tabulas inline labošana | `processInlineEditMode` nekad netiek ieslēgts UI |
| Izpildītāju inline edit | Poga nemaina tabulas saturu |
| Supabase Auth | Nav implementēts |

---

## Plūsmu indekss (UF-ID)

| UF | Īss nosaukums | SPEC |
|----|---------------|------|
| UF-001–006 | Platforma, lomas, navigācija, tēma | 001–003, 023 |
| UF-101–110 | Procesu reģistrs | 004, 012 |
| UF-201–207 | GP katalogs | 005, 007 |
| UF-301–302 | Numerācija | 006 |
| UF-401–403 | Jomu skats | 007 |
| UF-501–503 | Jomu kartiņas | 008 |
| UF-601–607 | NA | 009 |
| UF-701–702 | Procesu grupas | 010 |
| UF-801 | Statistika | 011 |
| UF-901–902 | Uzdevumi (ierobežots) | 013 |
| UF-1001–1003 | Izpildītāji | 014 |
| UF-1101–1103 | Pielikumi kartiņās | 015 |
| UF-1201–1203 | Izmaiņu pieteikums | 016 |
| UF-1301–1306 | Rokasgrāmata | 019, 015 |
| UF-1401–1404 | Palīdzība | 018 |
| UF-1501–1502 | Realtime | 017 |
| UF-E01–07 | Kļūdas | vairāki |

---

*Dokuments sagatavots kopēšanai. Kods nav mainīts.*
# Kopējais specifikācijas indekss

| ID | Nosaukums | Statuss |
|----|-----------|---------|
| SPEC-001 | Platforma, piekļuve un vispārīgais konteksts | Esošs |
| SPEC-002 | Lietotāju lomas un tiesības | Esošs |
| SPEC-003 | Navigācija un sadaļu pārvaldība | Esošs |
| SPEC-004 | Procesu reģistrs | Esošs |
| SPEC-005 | Galaproduktu katalogs (GP) | Esošs |
| SPEC-006 | Procesu un GP numerācija | Esošs |
| SPEC-007 | Procesu jomas (skats un GP piesaiste) | Esošs |
| SPEC-008 | Jomu kartiņas | Esošs |
| SPEC-009 | Normatīvie akti | Esošs |
| SPEC-010 | Procesu grupas | Esošs |
| SPEC-011 | Statistika | Esošs |
| SPEC-012 | Filtrēšana un meklēšana | Esošs |
| SPEC-013 | Uzdevumu skats | Esošs (ierobežota pieejamība) |
| SPEC-014 | Izpildītāju skats | Esošs |
| SPEC-015 | Pielikumi un failu glabāšana | Esošs |
| SPEC-016 | Izmaiņu pieteikums | Esošs |
| SPEC-017 | Realtime sinhronizācija un keepalive | Esošs |
| SPEC-018 | Palīdzība, BUJ un abreviatūras | Esošs |
| SPEC-019 | Rokasgrāmata | Esošs |
| SPEC-020 | Datu slānis, Supabase un localStorage rezerve | Esošs |
| SPEC-021 | Drošība un piekļuves ierobežojumi | Esošs |
| SPEC-022 | Mērījumi | **NĀKOTNE** |
| SPEC-023 | UI iestatījumi un kopīgošana | Esošs |

### Lietotāja plūsmu indekss (II. daļa)

| UF | Īss nosaukums | SPEC |
|----|---------------|------|
| UF-001–006 | Platforma, lomas, navigācija, tēma | 001–003, 023 |
| UF-101–110 | Procesu reģistrs | 004, 012 |
| UF-201–207 | GP katalogs | 005, 007 |
| UF-301–302 | Numerācija | 006 |
| UF-401–403 | Jomu skats | 007 |
| UF-501–503 | Jomu kartiņas | 008 |
| UF-601–607 | NA | 009 |
| UF-701–702 | Procesu grupas | 010 |
| UF-801 | Statistika | 011 |
| UF-901–902 | Uzdevumi (ierobežots) | 013 |
| UF-1001–1003 | Izpildītāji | 014 |
| UF-1101–1103 | Pielikumi kartiņās | 015 |
| UF-1201–1203 | Izmaiņu pieteikums | 016 |
| UF-1301–1306 | Rokasgrāmata | 019, 015 |
| UF-1401–1404 | Palīdzība | 018 |
| UF-1501–1502 | Realtime | 017 |
| UF-E01–07 | Kļūdu scenāriji | vairāki |

---

# Atvērtie jautājumi / NAV NOSKAIDROTS

| # | Jautājums | Konteksts |
|---|-----------|-----------|
| OQ-001 | Kā lietotājam standarta UI atvērt `tasksViewCard`? | Nav nav pogas; karte `hidden`; toggle darbojas tikai iekš kartes |
| OQ-002 | Pilns obligāto lauku saraksts procesam/GP/uzdevumam UI un DB līmenī | UI validācija minimāla |
| OQ-003 | Vai `procesu_registrs` bāzes CREATE TABLE shēma ir dokumentēta ārpus repo | Migrācijās tikai ALTER |
| OQ-004 | `catalog_items_json` paredzētais lietojums | Kolonna migrācijā; `DB.js` neizmanto |
| OQ-005 | Vai DB ir unikalitātes ierobežojumi procesa/GP numuriem | Numerācija tikai klienta pusē |
| OQ-006 | Storage failu dzēšana pēc UI «Dzēst» | Kods noņem no saraksta/localStorage; bucket dzēšana nav |
| OQ-007 | Private bucket + signed URL prasības produkcijā | Tikai dokumentācijā |
| OQ-008 | Konfliktu risināšana sinhronizācijā (vairāki redaktori) | Nav versiju kontroles |
| OQ-009 | `assignRoleBtn` / `roleTable` HTML elementu esamība | Skripts referencē; **NAV NOSKAIDROTS** vai noņemts no UI |
| OQ-010 | `Dizains.js`, `Skata zona.js` — paredzētais lietojums | Faili mapē, nav ielādēti `index.html` |
| OQ-011 | `#extraViewsCard` admin palīdzības sarakstā | Elements **NAV NOSKAIDROTS** |
| OQ-012 | Filtra stāvokļa persistēšana pēc F5 | **NAV NOSKAIDROTS** |
| OQ-013 | `user_roles` tabula | Minēta migrācijas komentārā; lietotnē **NAV NOSKAIDROTS** |
| OQ-014 | `Filtrs.js` `levelSelect` vērtība `3` | Opcija index.html nav |
| OQ-015 | Pilna NA/localStorage fallback sinhronizācija starp lietotājiem | Rezerve ir lokāla |

---

# Nākotnes virzieni (nav spec prasības)

No `docs/Procesu_registrs_tehniska_specifikacija.md` §15 — **neietilpst** pašreizējā funkcionalitātē:

- Supabase Auth integrācija
- Service role / Edge Functions
- Personu datu bāzes saite izmaiņu pieteikumā
- Mērījumu moduļa pilna implementācija (SPEC-022)
- Build pipeline un automatizēti testi

---

# Spec Kit workflow ieteikums

| Solis | Darbība |
|-------|---------|
| **specify** | Šis dokuments — I daļa (SPEC) + II daļa (UF plūsmas) |
| **clarify** | Aizpildīt OQ-001–OQ-015; vienoties par uzdevumu skata pieejamību |
| **plan** | Prioritizēt OQ risinājumus vs. SPEC-022 |
| **tasks** | Katram SPEC-FR/AC un UF — atsevišķs uzdevums testam |
| **implement** | Tikai pēc apstiprinātas prasības; nemainīt SPEC/UF ID numerāciju |

---

*Vienots dokuments: funkcionālās prasības + lietotāja plūsmas. Kods nav mainīts.*
