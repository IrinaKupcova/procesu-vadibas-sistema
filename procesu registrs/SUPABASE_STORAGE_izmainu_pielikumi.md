# Supabase Storage — «Pieteikumu vesture»

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

Kods: `DB.js` — `STORAGE_BUCKET_PIETEIKUMI`, `uploadChangeRequestFiles`, `savePieteikumuVestureSnapshot`.
