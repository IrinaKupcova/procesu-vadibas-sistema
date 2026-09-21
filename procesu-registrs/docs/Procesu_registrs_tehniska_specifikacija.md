# PROCESU REĢISTRS — Tehniskā specifikācija



> Versija 1.0 · MAPES — Vadības sistēmas arhitektūra



PROCESU REĢISTRS



Tehniskā specifikācija



Versija: 1.0  

Datums: 18.08.2026



MAPES — Vadības sistēmas arhitektūra



---



## 1. Dokumenta mērķis un apjoms



Šis dokuments apraksta «Procesu reģistra» informācijas sistēmas tehnisko arhitektūru, datu modeli, integrācijas un izvietošanas prasības. Dokuments paredzēts izstrādes, uzturēšanas un pārcelšanas uz iestādes darba vidi (GitHub, Supabase, statiskā hostēšana) plānošanai.



**Saistītais dokuments:** funkcionālā specifikācija — `Procesu_registrs_funkcionala_specifikacija.md` (ko lietotājs dara; bez NPM detaļām).



---



## 2. Sistēmas kopsavilkums



Procesu reģistrs ir tīmekļa lietotne procesu, galaproduktu (GP), procesu jomu, normatīvo aktu (NA) un izpildītāju uzskaites un pārvaldības atbalstam. Lietotne ir statiska — HTML, CSS un JavaScript — bez build soļa un bez atsevišķa backend servera repozitorijā.



- Lietotāja saskarne: viens galvenais fails `index.html` + modulāri `.js` faili.

- Datu glabāšana: Supabase (PostgreSQL + Storage).

- Hostēšana: statisks HTTPS (GitHub Pages, iestādes web serveris u.c.).

- Neatbalstīts: atvēršana ar `file://` (dubultklikšķis uz HTML).



---



## 3. Tehnoloģiju stack un atkarības



Procesu reģistrs **neizmanto NPM pakotņu pārvaldību**. Repozitorijā nav `package.json`, nav `package-lock.json`, nav `node_modules` un nav build soļa (`npm install`, `npm run build`, bundler).



### 3.1. Stack kopsavilkums



| Komponents | Tehnoloģija | Piezīmes |

| --- | --- | --- |

| Frontend | HTML5, CSS3, Vanilla JavaScript | Nav React/Vue/Angular |

| Build | Nav | Nav package.json, nav bundlera |

| Datu bāze | Supabase / PostgreSQL | REST API caur supabase-js |

| Failu glabāšana | Supabase Storage | Bucket: pieteikumu-vesture |

| Realtime | Supabase Realtime + polling | app:db-sync notikums |

| CDN | @supabase/supabase-js v2 | jsDelivr; rezerve: unpkg |

| CI | GitHub Actions | Supabase keepalive (nedēļas ping) |



### 3.2. Ārējās runtime atkarības



| ID | Nosaukums | Versija | Avots | Obligāts | Mērķis |

| --- | --- | --- | --- | --- | --- |

| DEP-001 | @supabase/supabase-js | 2.x | jsDelivr CDN | Jā | Supabase REST, Realtime, Storage |

| DEP-001a | @supabase/supabase-js (rezerve) | 2.x | unpkg CDN | Nē | Fallback, ja jsDelivr nav pieejams |

| DEP-002 | Supabase (PostgreSQL + Storage) | — | Supabase projekts | Jā | Datu glabāšana, faili |

| DEP-003 | HTTP(S) serveris | — | GitHub Pages / iestāde | Jā | Statiskās lietotnes apkalpošana |



**Primārā CDN ielāde (`index.html`):**  

`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`



**Rezerves ielāde:**  

`https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js`



### 3.3. Kas netiek izmantots



| Nav projektā | Piezīme |

| --- | --- |

| NPM / package.json | Nav pakotņu pārvaldības |

| React, Vue, Angular | Nav frontend framework |

| Webpack, Vite, Parcel | Nav bundlera |

| TypeScript | Tīrs JavaScript |

| Backend serveris repozitorijā | Tikai Supabase kā ārējais serviss |



### 3.4. Palīgrīki (neietilpst lietotnes runtime)



| Rīks | Tehnoloģija | Mērķis | NPM atkarības |

| --- | --- | --- | --- |

| scripts/db-fix.mjs | Node.js 18+ | DB diagnostika un uzturēšana | Nav |

| scripts/generate_tehniska_specifikacija.py | Python 3 | Tehniskās specifikācijas .docx ģenerēšana | Nav |

| .github/workflows/supabase-keepalive.yml | GitHub Actions | Supabase projekta aktivitātes uzturēšana | Nav |



**Secinājums:** NPM instalācija nav nepieciešama ne deploy, ne ikdienas lietošanai pārlūkā.



---



## 4. Repozitorija un mapju struktūra



Git repozitorija sakne: `vadības sistēmas arhitektura/`. Galvenā lietotne atrodas mapē `procesu-registrs/`.



| Ceļš | Mērķis |

| --- | --- |

| procesu-registrs/index.html | Lietotnes ieejas punkts |

| procesu-registrs/DB.js | Datu slānis (Supabase) |

| procesu-registrs/migrations/ | SQL migrācijas |

| procesu-registrs/docs/ | Specifikācijas un deploy dokumentācija |

| procesu-registrs/config.example.js | Supabase konfigurācijas paraugs |

| procesu-registrs/config.js | Iestādes konfigurācija (nav commitots) |

| (repo sakne) index.html | MAPES kopsavilkuma lapa |

| (repo sakne) CSV, diagrammas | Arhīvi un shēmas |



---



## 5. Programmatūras moduļi



Liela daļa biznesa loģikas (tabulu renderēšana, kartiņu redaktori, lomu pārvaldība) ir iekļauta `index.html` inline skriptā (~3500 rindas).



| Modulis | Atbildība |

| --- | --- |

| DB.js | Supabase klients, CRUD, kolonnu mapēšana, Storage, sinhronizācija |

| Procesu registrs.js | Procesu tabulas datu apvienošana un attēlošana |

| Procesa kartina.js | Procesa kartiņa, pielikumi |

| GP kataogs.js | GP kataloga skats, jutīgums |

| Pievienot jaunu procesu.js | Jauna procesa izveide |

| Joma.js / Joma kartina.js | Procesu jomas, jomu kartiņa |

| Norm_akti.js | Normatīvie akti (NA), saistīšana ar procesiem/GP/jomām |

| Izpilditaji.js | Izpildītāju skats (agregēta tabula) |

| Filtrs.js | Kolonnu filtri, globālā meklēšana |

| Statistika.js | Statistikas sadaļas |

| Izmainu_pieteikums.js | Izmaiņu pieteikums, pielikumi, e-pasts |

| Skaidrojumi.js | Palīdzības ikonas, BUJ (localStorage) |

| Abreviaturas.js | Saīsinājumu skaidrojumi |

| Navigacija.js | Sānu navigācija |

| Numeracija.js | Procesu/GP numerācijas noteikumi (P/A/M) |



**Neielādēti faili (nav aktīvi):** `Dizains.js`, `Skata zona.js` — nav `<script>` atsauces `index.html`.



---



## 6. Datu modelis



### 6.1. Hierarhija



Uzdevums → Process(es) → Galaprodukts(i) → (saistības: joma, NA, izpildītājs)



### 6.2. Galvenās entītijas



| Entītija | Glabāšana | Galvenie lauki / piezīmes |

| --- | --- | --- |

| Uzdevums | procesu_registrs | Uzdevuma_Nr., Uzdevums |

| Process | procesu_registrs | Procesa_numurs, Process, Procesa_grupa |

| GP | procesu_registrs + JSON | galaprodukti; GP_kartinas_papildu_JSON |

| Joma | procesu_jomas + Darbibas_joma | Jomu reģistrs un kartiņas |

| NA | normativie_akti | Saistība ar procesu, GP, jomu |

| Klasifikatori | norm_akti_klasifikatori | NA veidi, institūcijas |



Procesu grupas: pamatdarbība, atbalsts, pārvaldība (prefiksi P / A / M).  

Single-table režīms (noklusējums): GP dati glabājas procesu reģistra tabulā, ne atsevišķā kataloga tabulā.



---



## 7. Datu bāzes tabulas



| Tabula | Mērķis |

| --- | --- |

| procesu_registrs | Galvenā biznesa tabula — procesi, uzdevumi, GP |

| procesu_jomas | Procesu jomu kartiņas |

| normativie_akti | Normatīvie akti |

| norm_akti_klasifikatori | NA klasifikatoru vērtības |



Mantots: `Procesu_galaproduktu_veidu_katalogs` — aizstāts ar single-table modeli (2026-05-05 migrācija).



---



## 8. SQL migrācijas (secība)



Migrācijas jāpalaida Supabase SQL Editor secīgi. Detalizēti: `migrations/README.md`.



| Nr. | Fails | Mērķis |

| --- | --- | --- |

| 1 | 2026-04-30_joma_un_saglabasana.sql | Jomas lauki |

| 2 | 2026-05-05_single-table-procesu-registrs.sql | Vienas tabulas modelis |

| 3 | 2026-06-18_procesu_jomas.sql | Tabula procesu_jomas |

| 4 | 2026-06-19_procesu_jomas_lauki.sql | Papildu jomu lauki |

| 5 | 2026-07-03_gp-nr-to-text.sql | GP numurs → teksts |

| 6 | 2026-07-06_gp-kartinas-meta-json.sql | GP kartiņas meta JSON |

| 7 | 2026-07-31_normativie_akti.sql | Normatīvie akti |



---



## 9. Supabase integrācija



- Savienojums: anon (public) atslēga frontendā — standarta Supabase statiskām lietotnēm.

- Konfigurācija: `config.js` (iestāde) vai noklusējums `DB.js` (dev vide).

- Storage: bucket `pieteikumu-vesture` — izmaiņu pieteikumu pielikumi, vēsture, kartiņu pielikumi.

- Realtime: `postgres_changes` uz galvenajām tabulām; rezerves polling ik 7 s.

- RLS: migrācijās permissive politikas anon/authenticated; produkcijā jāpārskata drošības prasības.

- Keepalive: klienta ping + GitHub Actions workflow (free tier neaktivitātes novēršanai).



---



## 10. Lietotāju lomas un tiesības



Lomas glabājas pārlūka localStorage (`roleMap`). Nav Supabase Auth pieslēguma — tiesības ir klienta pusē; DB RLS ir galvenais servera līmeņa aizsardzības mehānisms.



Skata līmeņi (`levelSelect`): 1 — Pamatskats, 2 — Paplašinātais skats (kolonnu redzamība).



| Loma (kods) | Nosaukums | Tiesības |

| --- | --- | --- |

| viewer | skatītājs | Tikai skatīšana |

| admin_view | administrators (skatīt) | Skatīšana (redaktors bloķēts) |

| admin_edit | administrators (labot) | Izveide, labošana, dzēšana |



---



## 11. Galvenās funkcionalitātes



- Procesu reģistrs — tabula, akordeoni, lapošana, Excel eksports

- GP katalogs — GP saraksts un paplašinātais skats

- Uzdevumu skats — kopsavilkums pa uzdevumiem

- Procesu jomas — reģistrs un jomu kartiņas

- Procesu grupas — grupēšana un statistika

- Izpildītāji — agregēts skats pa pārvaldēm

- Normatīvie akti — CRUD, saistīšana ar procesiem/GP/jomām

- Statistika — organizācijas, procesu, jomu griezumā

- Izmaiņu pieteikums — forma, pielikumi (Storage), e-pasts administratoram

- Filtrēšana — kolonnu filtri, globālā meklēšana

- Palīdzība — «i» ikonas, BUJ (admin konfigurējams)

- Tēmas — gaišs / tumšs režīms



Detalizēts funkcionālais apraksts: `Procesu_registrs_funkcionala_specifikacija.md`.



---



## 12. localStorage rezerves kopijas



Daži moduļi glabā rezerves datus pārlūkā, ja DB tabula nav pieejama vai migrācija nav palaista:



| Atslēga / modulis | Saturs |

| --- | --- |

| roleMap | Lietotāju lomas |

| pv_joma_kartinas_v1 | Jomu kartiņas |

| pv_norm_akti_v1 | Normatīvie akti |

| pv_gp_sensitivity_v1 | GP jutīgums |

| pv_help_* | Palīdzības saturs |

| change_request_log | Pieteikumu vēsture (teksts) |



---



## 13. Konfigurācija un izvietošana



- Kopēt `config.example.js` → `config.js`; aizpildīt `PV_SUPABASE_URL` un `PV_SUPABASE_ANON_KEY`.

- `config.js` netiek commitots (`.gitignore`).

- Deploy mape: `procesu-registrs/` (visi `.js` blakus `index.html`).

- Pēc git pull — pārlūkā Ctrl+F5 (JS cache bust ar `?v=` parametriem).

- Detalizēts plāns: `docs/DEPLOY_IESTADE.md`.



**NPM instalācija deploy laikā nav nepieciešama.**



---



## 14. Drošība un riski



| Risks | Mitigācija |

| --- | --- |

| Service role atslēga repozitorijā | Tikai anon key frontendā; service_role nekad necommitot |

| Klienta lomas | Produkcijā pārskatīt RLS; nepaļauties tikai uz UI |

| Dev Supabase produkcijā | Obligāts config.js iestādes projektam |

| Trūkstoša migrācija | Sekot migrations/README.md secībai |

| file:// atvēršana | Obligāts HTTP(S) serveris |



---



## 15. Nākamie attīstības virzieni (informatīvi)



- Supabase Auth integrācija (īsta lietotāju autentifikācija)

- Service role / Edge Functions sensitīvām operācijām

- Personu datu bāzes saite izmaiņu pieteikumā

- Mērījumu moduļa pilna implementācija

- Build pipeline (opcionāli) un automatizēts tests



---



## 16. Saistītie dokumenti



| Dokuments | Mērķis |

| --- | --- |

| docs/Procesu_registrs_funkcionala_specifikacija.md | Funkcionālās prasības, UF plūsmas, AC |

| docs/README.md | Dokumentu indekss un numerācijas skaidrojums |

| procesu-registrs/README.md | Ātrais starts |

| docs/DEPLOY_IESTADE.md | Iestādes vide |

| migrations/README.md | SQL migrāciju secība |

| SUPABASE_STORAGE_izmainu_pielikumi.md | Storage bucket un politikas |

| PUBLICET_LASI.md | Publicēšanas instrukcijas |


