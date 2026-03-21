# Supabase Storage — «Pieteikumu vesture»

## «Bucket not found» pārlūkā

Tas nozīmē: projektā **nav** Storage bucket ar **tieši tādu pašu id**, kādu lieto kods (noklusējums: `pieteikumu-vesture`).

1. Supabase Dashboard → **Storage** → pārbaudiet sarakstu.
2. Ja tāda nav: **New bucket** → laukā **Name** ierakstiet `pieteikumu-vesture` (bez atstarpēm, mazie burti).
3. Public bucket vai pievienojiet **policies** (INSERT), sk. zemāk.
4. Ja bucket izveidojāt ar **citu** Name, `index.html` pirms `DB.js` iestatiet:
   `window.PV_SUPABASE_STORAGE_BUCKET = "jusu-izveidotais-id";`

---

Viens **bucket** visam: pielikumi + katra pieteikuma JSON pieraksts.

| Kas | Bucket **id** (Name) | Ceļš mapē |
|-----|----------------------|-----------|
| Pielikumi | `pieteikumu-vesture` | `pielikumi_uz_pieteikumiem/<fails>` |
| Pieteikumu vēsture (JSON) | `pieteikumu-vesture` | `vesture/pieteikums_<id>.json` |

**Izveide:** Supabase → **Storage** → **New bucket** → Name: `pieteikumu-vesture`  
(Var pievienot aprakstu latviski: *Pieteikumu vesture*.)

**Svarīgi:** bez **Storage policies** augšupielāde no anon atslēgas neizdosies.

### Politiku piemērs (Dashboard → Storage → Policies)

Ļaut **anon** augšupielādēt un lasīt (vienkāršots tests — produkcijā ierobežojiet):

1. **INSERT** (upload):  
   - Target roles: `anon`  
   - Policy: `bucket_id = 'pieteikumu-vesture'`

2. **SELECT** (ja lietojat `getPublicUrl` un publisku URL):  
   - Bucket jāatzīmē kā **public**, **vai** jālieto parakstītas saites.

Ja bucket ir **private**, `getPublicUrl` dod URL, bet fails var būt nepieejams bez signed URL — tad jāpielāgo kods (`createSignedUrl`).

### Projekta adrese

- API: `https://ettesmdcpizztgwewhpx.supabase.co`
- S3-saderīgs endpoints (servisiem):  
  `https://ettesmdcpizztgwewhpx.storage.supabase.co/storage/v1/s3`  
  Pārlūka **Izmaiņu pieteikums** izmanto `@supabase/supabase-js` `storage.from(...).upload` — tas automātiski izmanto pareizo REST ceļu.

Kods: `DB.js` — `getPieteikumiStorageBucket()`, `uploadChangeRequestFiles`, `savePieteikumuVestureSnapshot`; konfigurācija: `window.PV_SUPABASE_STORAGE_BUCKET` (`index.html`).
