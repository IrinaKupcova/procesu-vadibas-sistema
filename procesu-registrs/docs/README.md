# Procesu reģistrs — dokumentācija

Šeit atrodas specifikācijas un deploy materiāli. **Lietotnes kods** (`index.html`, `.js` faili u.c.) ir mapē `procesu-registrs/` — šī `docs/` mape to nemaina.

---

## Kuri dokuments kam domāts

| Dokuments | Formāts | Kam domāts |
| --- | --- | --- |
| **Procesu_registrs_funkcionala_specifikacija.md** | Markdown | Ko sistēma dara, lietotāja plūsmas, pieņemšanas kritēriji |
| **Procesu_registrs_tehniska_specifikacija.md** | Markdown | Stack, NPM/atkarības, DB, deploy, moduļi |
| **Procesu_registrs_tehniska_specifikacija.html** | HTML | Tehniskā specifikācija drukai / PDF |
| **DEPLOY_IESTADE.md** | Markdown | Pārcelšana uz iestādes vidi |
| **Procesu_registrs_lietotaja_darbibas_specifikacija.md** | Markdown | Papildu lietotāja darbību apraksts (ja nepieciešams) |

---

## Numerācija — ko lietot Word dokumentā

Tev Word dokumentā ir **vienkārša nodaļu numerācija 1–11**. **Tā ir pareiza un pietiekama** galvenajam lasītājam. Nemaini to uz SPEC-001 utt.

Ir **trīs dažādi numuri** — tie nav jājauc:

| Numurs | Piemērs | Kur lietot | Vai vajag Word |
| --- | --- | --- | --- |
| **Nodaļas** | 1, 2, 3 … 11 | Word satura rādītājs | **Jā** — galvenā struktūra |
| **SPEC-NNN** | SPEC-004, UF-101 | Testēšana, izstrāde, saites starp prasībām | **Ne obligāti** — pielikumos, ja vajag traceability |
| **MAPES prasības** | SPEC-01 … SPEC-23 | Sākotnējās biznesa prasības no MAPES | **Ne obligāti** — atsevišķs pielikums «Prasību izcelsme» |
| **Mapju ceļi** | `procesu-registrs/DB.js` | Tehniskā specifikācija, deploy | **Nē Word funkcionālajā** — tas nav numerācija, bet failu ceļi |

### Īsā atbilde uz jautājumu «vai mapju numurus vajag?»

- **Word nodaļu numurus (1–11) — jā, turpini lietot.**
- **Mapju ceļus (`procesu-registrs/`, `migrations/`) — neliec funkcionālajā Word; tie ir tikai tehniskajā specifikācijā un deploy instrukcijā.**
- **SPEC-001, UF-101 u.tml. — nav jāliek katrai nodaļai; pietiek pielikumā A un B, ja testē.**

---

## Kas kurā dokumentā par NPM

| Tēma | Funkcionālā (Word / .md) | Tehniskā (.md) |
| --- | --- | --- |
| Ko lietotājs redz/dara | Jā | Īss kopsavilkums §11 |
| Nav NPM, nav build | 1 teikums §2 Platforma | Pilns §3 |
| CDN supabase-js | 1 rinda §6 Datu avoti | §3.2 tabula |
| Moduļu saraksts | Nē | §5 |
| Deploy soļi | Nē | §13 + DEPLOY_IESTADE.md |

---

## Word funkcionālajai specifikācijai — minimālais papildinājums

Ja Word versijā vēl nav, pievieno:

**2. nodaļa, rinda «Platforma»:**  
«Lietotne neizmanto NPM (`package.json` nav). Vienīgā ārējā bibliotēka: `@supabase/supabase-js` v2 (CDN). Tehniskās detaļas — Tehniskās specifikācijas 3. nodaļā.»

**6. nodaļa, tabulā jauna rinda:**  
`@supabase/supabase-js (CDN)` | Supabase savienojums pārlūkā; NPM instalācija nav nepieciešama

**11. Pielikumi — jauna rinda:**  
`Procesu_registrs_tehniska_specifikacija.md` | Tehniskā arhitektūra, atkarības, deploy

---

## Ģenerēšana

Tehniskās specifikācijas `.docx` vari ģenerēt (ja ir Python un python-docx):

```bash
python scripts/generate_tehniska_specifikacija.py
```

HTML versija: atver `Procesu_registrs_tehniska_specifikacija.html` pārlūkā → Ctrl+P → PDF.
