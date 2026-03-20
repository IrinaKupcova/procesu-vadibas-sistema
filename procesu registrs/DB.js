/* DB slānis (frontendam): Supabase savienojums + CRUD + kolonu mapping.
   Pieņem, ka HTML jau ielādē @supabase/supabase-js (window.supabase). */
(function () {
  "use strict";

  const SUPABASE_URL = "https://ettesmdcpizztgwewhpx.supabase.co";
  // Anon/public (JWT) key no UI (tāds kā iepriekš ielikts HTML).
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dGVzbWRjcGl6enRnd2V3aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDM2MjcsImV4cCI6MjA4OTIxOTYyN30.Mv5SZpzQJCiIahOfs5i-j07EsJo5SRrowolKD6Vs0es";

  const TABLE = "procesu_registrs";
  const GROUPS = new Set([
    "pamatdarbības procesi",
    "atbalsta procesi",
    "vadības procesi",
    "citi procesi",
  ]);

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let dbCols = new Set();

  const fk = (o, a) => a.find((k) => Object.prototype.hasOwnProperty.call(o, k));
  const gv = (o, a) => {
    const k = fk(o, a);
    return k ? o[k] : "";
  };
  const gid = (o) => fk(o, ["id", "ID", "Id"]) || null;
  const normGroup = (g) => {
    const t = String(g || "").trim().toLowerCase();
    return GROUPS.has(t) ? t : "citi procesi";
  };

  function mapDbError(err) {
    const msg = String((err && err.message) || err || "");
    if (msg.toLowerCase().includes("row-level security policy")) {
      return "Nav DB piekļuves tiesību (RLS). Supabase jāatļauj INSERT/UPDATE/DELETE politikās šai lomai.";
    }
    const code = err && err.code ? String(err.code) : null;
    const details = err && err.details ? String(err.details) : null;
    const hint = err && err.hint ? String(err.hint) : null;
    const extra = [code ? "code=" + code : null, details ? "details=" + details : null, hint ? "hint=" + hint : null]
      .filter(Boolean)
      .join(" | ");
    return extra ? (msg || "DB kļūda") + " (" + extra + ")" : msg || "Nezināma DB kļūda";
  }

  function pickKey(raw, choices) {
    // update gadījumā mums biežāk ir `raw` ar precīzām kolonnām.
    if (raw) {
      const k = fk(raw, choices);
      if (k) return k;
    }
    // insert gadījumā izvēlamies tikai tos kandidātus, kas parādās shēmā (no iepriekš ielādētajiem datiem).
    return choices.find((c) => dbCols.has(c)) || null;
  }

  const aliasMap = {
    group: ["Procesu_grupa", "procesu_grupa", "Procesu grupa", "group", "procGroup", "procesuGrupa"],
    taskNo: ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"],
    task: ["Uzdevums", "uzdevums", "task"],
    processNo: ["Procesa_Nr.", "procesa_nr", "Procesa Nr.", "processNo"],
    process: ["Procesi, kas nodrošina uzdevuma dzīves ciklu", "procesi_dzives_ciklam", "processLife"],
    owner: ["Procesa_īpašnieks", "procesa_ipasnieks", "Procesa īpašnieks", "processOwner"],
    products: ["galaprodukti", "outputProducts", "normativie_akti", "Normatīvie akti", "laws"],
    productTypes: ["galaproduktu_veidi", "outputTypes", "procesa_dokumentacija", "Procesa dokumentācija", "docs"],
    input: ["procesa_iniciators", "input", "Procesa iniciātors (input)"],
    relatedProcesses: ["saistitie_procesi", "relatedProcesses", "galaproduktu_skaits", "outputCount"],
    services: ["pakalpojumi", "services", "videjais_izpildes_laiks", "outputAvgTime"],
    flowcharts: ["plusmas_shemas", "plūsmas_shēmas", "flowcharts", "kpi"],
    itResources: ["it_resursi", "itResources", "riski", "riskInfo"],
    optimization: ["optimizacija", "optimization"],
    otherMetrics: ["citi_raditaji", "otherMetrics"],
  };

  function toPayload(formVals, rowRawOrNull) {
    const raw = rowRawOrNull || null;
    const p = {};
    Object.keys(aliasMap).forEach((logicalKey) => {
      const choices = aliasMap[logicalKey];
      const key = pickKey(raw, choices);
      if (key) p[key] = formVals[logicalKey] || "";
    });

    // Obligātais lauks (jo DB rāda NOT NULL tieši `Uzdevuma_Nr.`):
    if (formVals.taskNo) {
      const candidate =
        dbCols.has("Uzdevuma_Nr.") ? "Uzdevuma_Nr." : dbCols.has("uzdevuma_nr") ? "uzdevuma_nr" : null;
      if (candidate && !Object.prototype.hasOwnProperty.call(p, candidate)) p[candidate] = formVals.taskNo;
      if (!candidate && !Object.prototype.hasOwnProperty.call(p, "Uzdevuma_Nr.")) p["Uzdevuma_Nr."] = formVals.taskNo;
    }

    return p;
  }

  function mapDbRowToUiRow(d) {
    const idKey = gid(d);
    return {
      id: gv(d, ["id", "ID", "Id"]),
      idKey,
      raw: d,
      group: normGroup(gv(d, ["procesu_grupa", "Procesu grupa", "group", "procGroup", "procesuGrupa"])),
      taskNo: gv(d, ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"]),
      task: gv(d, ["Uzdevums", "uzdevums", "task"]),
      processNo: gv(d, ["procesa_nr", "Procesa_Nr.", "Procesa Nr.", "processNo"]),
      process: gv(d, ["Procesi, kas nodrošina uzdevuma dzīves ciklu", "procesi_dzives_ciklam", "processLife"]),
      owner: gv(d, ["procesa_ipasnieks", "Procesa_īpašnieks", "Procesa īpašnieks", "processOwner"]),
      input: gv(d, ["procesa_iniciators", "input"]),
      products: gv(d, ["galaprodukti", "outputProducts", "normativie_akti", "Normatīvie akti", "laws"]),
      productTypes: gv(d, ["galaproduktu_veidi", "outputTypes", "procesa_dokumentacija", "Procesa dokumentācija", "docs"]),
      relatedProcesses: gv(d, ["saistitie_procesi", "relatedProcesses", "galaproduktu_skaits", "outputCount"]),
      services: gv(d, ["pakalpojumi", "services", "videjais_izpildes_laiks", "outputAvgTime"]),
      flowcharts: gv(d, ["plusmas_shemas", "plūsmas_shēmas", "flowcharts", "kpi"]),
      itResources: gv(d, ["it_resursi", "itResources", "riski", "riskInfo"]),
      optimization: gv(d, ["optimizacija", "optimization"]),
      otherMetrics: gv(d, ["citi_raditaji", "otherMetrics"]),
    };
  }

  async function load() {
    const { data, error } = await supabaseClient.from(TABLE).select("*");
    if (error) throw error;
    const rows = data || [];

    dbCols = new Set();
    rows.forEach((r) => {
      Object.keys(r || {}).forEach((k) => dbCols.add(k));
    });

    return rows.map(mapDbRowToUiRow);
  }

  async function insert(formVals) {
    const payload = toPayload(formVals, null);
    const { data, error } = await supabaseClient.from(TABLE).insert(payload).select("*").single();
    if (error) throw error;
    return data;
  }

  async function update(row, formVals) {
    if (!row || !row.idKey || row.id === undefined || row.id === null) {
      throw new Error("Nav derīgas primārās atslēgas atjaunināšanai.");
    }
    const payload = toPayload(formVals, row.raw || null);
    const { data, error } = await supabaseClient
      .from(TABLE)
      .update(payload)
      .eq(row.idKey, row.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async function remove(row) {
    if (!row || !row.idKey || row.id === undefined || row.id === null) {
      throw new Error("Nav derīgas primārās atslēgas dzēšanai.");
    }
    const { data, error } = await supabaseClient
      .from(TABLE)
      .delete()
      .eq(row.idKey, row.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  window.DB = {
    TABLE,
    load,
    insert,
    update,
    remove,
    mapDbError,
  };
})();
