/**
 * DB diagnostika + per-GP meta migrācija (ja kolonna eksistē).
 * Palaišana: node scripts/db-fix.mjs
 */
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");
const dbJs = readFileSync(join(root, "DB.js"), "utf8");
let configJs = "";
try {
  configJs = readFileSync(join(root, "config.js"), "utf8");
} catch (_) {}

function pick(re, text) {
  const m = text && re.exec(text);
  return m ? m[1] : "";
}

const SUPABASE_URL =
  pick(/window\.PV_SUPABASE_URL\s*=\s*"([^"]+)"/, configJs) ||
  (dbJs.match(/"(https:\/\/[^"]+\.supabase\.co)"/) || [])[1];
const KEY =
  pick(/window\.PV_SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/, configJs) ||
  (dbJs.match(/"(eyJ[^"]+)"/) || [])[1];

if (!SUPABASE_URL || !KEY) {
  console.error("Nevar nolasīt Supabase konfigurāciju no config.js vai DB.js");
  process.exit(1);
}
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const nkey = (v) =>
  String(v || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function splitProducts(v) {
  const raw = String(v || "");
  const base = raw
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (base.length > 1) return base;
  if ((raw.match(/,/g) || []).length >= 2) {
    return raw
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return base;
}

function parseMeta(v) {
  if (v == null || v === "") return {};
  if (typeof v === "object" && !Array.isArray(v)) return v;
  try {
    const o = JSON.parse(String(v));
    return o && typeof o === "object" && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function singleProcessVal(v) {
  const s = String(v || "").trim();
  if (!s || /[;,\n]/.test(s)) return "";
  return s;
}

async function rest(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, ...opts });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === "object" ? JSON.stringify(data) : String(data);
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  return data;
}

async function main() {
  console.log("=== Procesu reģistra DB pārbaude ===\n");

  // 1) Vai GP meta kolonna eksistē?
  let sample;
  try {
    sample = await rest("procesu_registrs?select=id,GP_kartinas_papildu_JSON&limit=1");
    console.log("✓ Kolonna GP_kartinas_papildu_JSON eksistē");
  } catch (e) {
    console.error("✗ Kolonna GP_kartinas_papildu_JSON NAV pieejama.");
    console.error("  Kļūda:", e.message);
    console.error("\n→ Palaid Supabase SQL Editor:\n");
    console.error(`  ALTER TABLE public.procesu_registrs ADD COLUMN IF NOT EXISTS "GP_kartinas_papildu_JSON" jsonb NOT NULL DEFAULT '{}'::jsonb;`);
    console.error(`  NOTIFY pgrst, 'reload schema';`);
    process.exit(2);
  }

  // 2) Ielādēt procesus
  const rows = await rest(
    "procesu_registrs?select=id,Procesa_numurs,Procesa_galaprodukti,Darbibas_joma,Procesa_izpilditajs-patstaviga_strukturvieniba,Strukturvieniba_dala,GP_kartinas_papildu_JSON"
  );
  console.log(`\nProcesu rindas: ${rows.length}`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const id = row.id;
    const gps = splitProducts(row["Procesa_galaprodukti"] || row.procesa_galaprodukti || "");
    if (!gps.length) {
      skipped++;
      continue;
    }

    const meta = parseMeta(row.GP_kartinas_papildu_JSON);
    const hasMeta = Object.keys(meta).some((k) => {
      const s = meta[k];
      return s && (String(s.unit || "").trim() || String(s.darbibasJoma || "").trim() || String(s.department || "").trim());
    });

    if (hasMeta) {
      skipped++;
      continue;
    }

    const seedUnit = singleProcessVal(
      row["Procesa_izpilditajs-patstaviga_strukturvieniba"] || row.Procesa_izpilditajs_patstaviga_strukturvieniba
    );
    const seedDept = singleProcessVal(row.Strukturvieniba_dala || row.strukturvieniba_dala);
    const seedJoma = singleProcessVal(row.Darbibas_joma || row.darbibas_joma);

    if (!seedUnit && !seedDept && !seedJoma) {
      skipped++;
      continue;
    }

    const newMeta = { ...meta };
    gps.forEach((gp) => {
      const k = nkey(gp);
      if (!k) return;
      if (!newMeta[k] || typeof newMeta[k] !== "object") newMeta[k] = {};
      if (seedUnit && !String(newMeta[k].unit || "").trim()) newMeta[k].unit = seedUnit;
      if (seedDept && !String(newMeta[k].department || "").trim()) newMeta[k].department = seedDept;
      if (seedJoma && !String(newMeta[k].darbibasJoma || "").trim()) newMeta[k].darbibasJoma = seedJoma;
    });

    await rest(`procesu_registrs?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ GP_kartinas_papildu_JSON: newMeta }),
    });
    updated++;
    console.log(`  Migrēts id=${id}, GP: ${gps.join("; ")}`);
  }

  console.log(`\nMeta migrācija: atjauninātas ${updated}, izlaistas ${skipped}`);

  // 3) Jomu reģistrs
  const jomas = await rest("procesu_jomas?select=joma_nosaukums,joma_key");
  console.log(`\nJomu reģistrā: ${jomas.length} ieraksti`);
  const labels = jomas.map((j) => String(j.joma_nosaukums || "").trim()).filter(Boolean);
  const metodika = labels.filter((l) => nkey(l).includes("metodika"));
  if (metodika.length) console.log("  Metodika jomas:", metodika.join(", "));
  else console.log("  'Metodika un analītika' nav jomu reģistrā — dropdown to ņem no procesu datiem (tiks labots kodā).");

  console.log("\n=== Gatavs ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
