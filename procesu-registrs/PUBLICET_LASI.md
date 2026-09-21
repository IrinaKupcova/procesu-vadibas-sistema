# Publiskā saite / statiskā hostēšana

Projekta mape: **`procesu-registrs/`** (Git repozitorijā: `vadības sistēmas arhitektura/procesu-registrs/`).

## Obligātie faili

Lai `index.html` strādātu pilnībā, **tajā pašā mapē** jābūt visiem `.js` failiem, ko ielādē `index.html` (ar `%20` kodējumu failiem ar atstarpēm nosaukumā).

Galvenie: `DB.js`, `Procesu registrs.js`, `GP kataogs.js`, `Filtrs.js`, `Norm_akti.js`, `Joma.js`, u.c. — pilns saraksts: [README.md](README.md).

## Hostēšana

- **Nedarbojas:** atvērt `index.html` ar dubultklikšķi (`file://`).
- **Darbojas:** GitHub Pages, iestādes web serveris, Live Server, `python -m http.server`.

## Supabase

- Anon atslēga frontendā ir paredzēta publiska; **service_role** necommitot.
- Iestādei: izmantojiet `config.js` (sk. `config.example.js` un [docs/DEPLOY_IESTADE.md](docs/DEPLOY_IESTADE.md)).

## Pēc izmaiņām GitHub

```bash
git pull origin main
```

Pārlūkā: **Ctrl+F5**.
