# Procesu reģistrs

Statiska web lietotne (HTML + JavaScript) procesu, galaproduktu (GP), jomu un normatīvo aktu pārvaldībai. Dati glabājas **Supabase** (PostgreSQL + Storage); daļa moduļu atbalsta **localStorage** rezervi, ja DB tabula vēl nav izveidota.

## Repozitorija struktūra

```
vadības sistēmas arhitektura/     ← Git repozitorija sakne (GitHub)
├── .github/workflows/            ← CI (Supabase keepalive)
├── index.html                    ← MAPES kopsavilkuma lapa (nav procesu reģistrs)
├── procesu-registrs/             ← ★ Galvenā lietotne — deploy šo mapi
│   ├── index.html
│   ├── DB.js                     ← Supabase savienojums
│   ├── config.example.js         ← Paraugs iestādes videi
│   ├── migrations/               ← SQL migrācijas (secība: README)
│   ├── scripts/                  ← Palīgskripti (db-fix.mjs)
│   └── docs/                     ← Pārcelšanas instrukcijas
└── Root_kopskats/                ← CSV / vecais prototips (nav galvenā app)
```

**Svarīgi:** neizmantojiet mapi `procesu-registrs/procesu-vadibas-sistema/` — tā ir dublikāts un ir `.gitignore`.

## Ātrā palaišana (lokāli)

1. Visi faili jāatrodas **tajā pašā mapē** (`procesu-registrs/`).
2. **Neatveriet** `index.html` ar dubultklikšķi (`file://`) — Supabase nestrādās. Izmantojiet:
   - VS Code **Live Server**, vai
   - `python -m http.server` mapē `procesu-registrs`, vai
   - GitHub Pages / iestādes statisko hostu.
3. Pārlūkā: `http://localhost:.../index.html`

## Konfigurācija

| Fails | Mērķis |
|-------|--------|
| `config.example.js` | Paraugs — kopējiet uz `config.js` |
| `config.js` | Iestādes Supabase URL/atslēga (**netiek commitots**) |
| `DB.js` | Noklusējuma dev vide, ja `config.js` nav |

```bash
copy config.example.js config.js   # Windows
# Aizpildiet window.PV_SUPABASE_URL un window.PV_SUPABASE_ANON_KEY
```

**Anon atslēga** frontendā ir normāli (publiska); **service_role** nekad neliekiet repozitorijā.

## Datu bāze

1. Izveidojiet Supabase projektu iestādē.
2. Palaidiet SQL migrācijas secībā — sk. `migrations/README.md`.
3. Storage bucket un politikas — sk. `SUPABASE_STORAGE_izmainu_pielikumi.md`.

## Moduļi (JS faili)

| Fails | Funkcija |
|-------|----------|
| `DB.js` | Supabase CRUD, sinhronizācija |
| `Procesu registrs.js` | Procesu tabula, kartiņa |
| `GP kataogs.js` | GP katalogs |
| `Joma.js`, `Joma kartina.js` | Procesu jomas |
| `Norm_akti.js` | Normatīvie akti |
| `Izpilditaji.js` | Izpildītāju skats |
| `Filtrs.js` | Kolonnu filtri |
| `Statistika.js` | Statistika |
| `Izmainu_pieteikums.js` | Izmaiņu pieteikums + Storage |
| `Skaidrojumi.js`, `Abreviaturas.js`, `Navigacija.js`, `Numeracija.js` | UI palīgi |

## Pārcelšana uz iestādes GitHub / hostu

Detalizēti: **[docs/DEPLOY_IESTADE.md](docs/DEPLOY_IESTADE.md)**

Īss checklist:

- [ ] Jauns Supabase projekts iestādē
- [ ] Migrācijas palaistas
- [ ] `config.js` ar jauno URL/anon key
- [ ] Storage bucket `pieteikumu-vesture` (vai cits + `PV_SUPABASE_STORAGE_BUCKET`)
- [ ] Statiskā hostēšana (HTTPS)
- [ ] RLS politikas pārbaudītas
- [ ] `.github/workflows/supabase-keepalive.yml` atjaunināts ar jauno projektu (ja vajag)

## Git / GitHub

Repozitorija sakne: **`vadības sistēmas arhitektura`**, ne tikai `procesu-registrs`.

```bash
git add .
git commit -m "Apraksts par izmaiņām"
git push origin main
```

Pēc `git pull` — pārlūkā **Ctrl+F5** (cache).

## Papildu dokumentācija

- [PUBLICET_LASI.md](PUBLICET_LASI.md) — publiskā saite / hostēšana
- [SUPABASE_STORAGE_izmainu_pielikumi.md](SUPABASE_STORAGE_izmainu_pielikumi.md) — pielikumu bucket
- [docs/DEPLOY_IESTADE.md](docs/DEPLOY_IESTADE.md) — pārcelšana uz iestādi
- [docs/Procesu_registrs_tehniska_specifikacija.md](docs/Procesu_registrs_tehniska_specifikacija.md) — tehniskā specifikācija (**atveriet šo — Cursor, Notepad, GitHub**)
- [docs/Procesu_registrs_tehniska_specifikacija.html](docs/Procesu_registrs_tehniska_specifikacija.html) — PDF drukāšanai pārlūkā (Ctrl+P)
- [docs/Procesu_registrs_tehniska_specifikacija.docx](docs/Procesu_registrs_tehniska_specifikacija.docx) — Word (vajag Microsoft Word vai Word Online)
