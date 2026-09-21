# Pārcelšana uz iestādes darba vidi

Šis dokuments ir soli pa solim plāns, kā pārvietot **procesu reģistru** no privātās dev vides uz iestādes GitHub un hostu **bez koda pārbūves**.

## 1. Kas tiek pārnests

| Komponents | Kur | Piezīmes |
|------------|-----|----------|
| Frontend | `procesu-registrs/` | Statiski faili — GitHub Pages vai iestādes web serveris |
| Datu bāze | Supabase (iestādes konts) | Jauns projekts, ne kopēt dev projektu bez plāna |
| Pielikumi | Supabase Storage | Bucket `pieteikumu-vesture` (sk. storage MD) |
| Secrets | `config.js` (lokāli) / GitHub Secrets (CI) | Netiek commitoti |

## 2. Kas **netiek** commitots

- `config.js` (`.gitignore`)
- `.env` faili
- Service role atslēgas
- Lietotāju dati no localStorage (tās paliek pārlūkā)

## 3. Supabase — jauns projekts

1. Izveidojiet projektu iestādes Supabase kontā.
2. SQL Editor — palaidiet migrācijas **secībā** (`migrations/README.md`).
3. Pārbaudiet tabulas: `procesu_registrs`, `procesu_jomas`, `normativie_akti`, u.c.
4. Iestatiet **RLS** un politikas (INSERT/UPDATE/DELETE anon/authenticated lomai atbilstoši iestādes politikai).
5. Storage → izveidojiet bucket, sk. `SUPABASE_STORAGE_izmainu_pielikumi.md`.

## 4. Frontend konfigurācija

```bash
cd procesu-registrs
copy config.example.js config.js
```

`config.js`:

```javascript
window.PV_SUPABASE_URL = "https://XXXX.supabase.co";
window.PV_SUPABASE_ANON_KEY = "eyJ...anon...";
window.PV_SUPABASE_STORAGE_BUCKET = "pieteikumu-vesture";
```

Ja `config.js` nav (piem. GitHub Pages build), lietotne lieto noklusējumu no `DB.js` — **pirms produkcijas pārliecinieties**, ka noklusējums nav dev projekts.

## 5. GitHub repozitorijs

### Ieteicamā struktūra

- Repozitorijs: `vadības sistēmas arhitektura` (vai atsevišķs `procesu-registrs`, ja IT prasa tikai app mapi).
- Branch: `main` — stabilā versija.
- `.gitignore` repozitorija saknē — jau pievienots.

### Pirmā augšupielāde

```bash
git status
git add procesu-registrs/ .gitignore
git commit -m "Procesu reģistrs — sagatavots iestādes deploy"
git push -u origin main
```

### GitHub Pages (ja atļauts)

- Settings → Pages → Source: `main`, folder `/` vai `/procesu-registrs`
- URL būs `https://<org>.github.io/.../procesu-registrs/index.html`
- **Obligāti HTTPS** — Supabase nestrādā no `file://`

## 6. CI — Supabase keepalive

Fails: `.github/workflows/supabase-keepalive.yml`

Ja iestādē ir cits Supabase projekts, atjauniniet:

- GitHub → Settings → Secrets → `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- Vai tieši workflow env mainīgos (anon key frontendā tāpat ir publisks)

## 7. Datu migrācija (dev → iestāde)

| Datu avots | Rīcība |
|------------|--------|
| Supabase dev | Export CSV/SQL no dev, import iestādes projektā (IT atbalsts) |
| localStorage | Nav automātiskas migrācijas — tikai pārlūka kešs |
| CSV mapē `Root_kopskats/` | Vēsturiski importa avoti — ne produkcijas avots |

Plānojiet **vienreizēju** datu ielādi pēc shēmas izveides.

## 8. Pārbaude pēc deploy

- [ ] Lapa atveras pa HTTPS (nav `file://`)
- [ ] Procesu tabula ielādējas no DB
- [ ] Jauna procesa kartiņa — saglabāšana
- [ ] GP katalogs
- [ ] Jomas kartiņa
- [ ] NA sadaļa (tabula `normativie_akti` eksistē)
- [ ] Izpildītāji — akordeoni, kolonnu izkārtojums
- [ ] Izmaiņu pieteikums — pielikuma augšupielāde (Storage)
- [ ] Ctrl+F5 pēc `git pull` — jaunākā JS versija

## 9. Riski un kā tos mazināt

| Risks | Mazināšana |
|-------|------------|
| Dev Supabase paliek produkcijā | `config.js` iestādē + pārbaude pirms go-live |
| Trūkst migrācijas | `migrations/README.md` secība; kļūdas konsolē |
| Duplicēts repo `procesu-vadibas-sistema/` | Dzēst lokāli vai ignorēt (.gitignore) |
| `.xlsm` / `.exe` repozitorijā | Ilgtermiņā izņemt no git (nav vajadzīgi runtime) |
| RLS bloķē saglabāšanu | Supabase politikas pārbaude |

## 10. Atbalsts un kontakti

Norādiet iestādē:

- Supabase projekta īpašnieks (admin)
- GitHub repo maintainer
- Atbildīgais par RLS / drošības politiku
