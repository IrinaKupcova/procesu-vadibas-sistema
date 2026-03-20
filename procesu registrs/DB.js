/* DB slānis (frontendam): Supabase savienojums + CRUD + kolonu mapping.
   Pieņem, ka HTML jau ielādē @supabase/supabase-js (window.supabase). */
(function () {
  "use strict";

  const SUPABASE_URL = "https://ettesmdcpizztgwewhpx.supabase.co";
  // Anon/public (JWT) key no UI (tāds kā iepriekš ielikts HTML).
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dGVzbWRjcGl6enRnd2V3aHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDM2MjcsImV4cCI6MjA4OTIxOTYyN30.Mv5SZpzQJCiIahOfs5i-j07EsJo5SRrowolKD6Vs0es";

  const TABLE = "procesu_registrs";
  const CATALOG_TABLE = "Procesu_galaproduktu_veidu_katalogs";
  const GROUPS = new Set([
    "pamatdarbības procesi",
    "atbalsta procesi",
    "vadības procesi",
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
    return GROUPS.has(t) ? t : "pamatdarbības procesi";
  };
  const pgCol = (name) => {
    const s = String(name || "");
    // PostgREST path parserim kolonnas ar punktiem/atstarpēm jāiekļauj pēdiņās.
    return /^[A-Za-z0-9_]+$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`;
  };
  const qeq = (query, key, value) => query.eq(pgCol(key), value);

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

  // Papildu aliasi, lai saskaņotu ar tavu tabulas shēmu:
  // "Procesa_numurs", "Procesa_galaprodukti", "Pakalpojumi" u.c.
  aliasMap.processNo = (aliasMap.processNo || []).concat(["Procesa_numurs", "procesa_numurs"]);
  aliasMap.process = (aliasMap.process || []).concat(["Process"]);
  aliasMap.owner = (aliasMap.owner || []).concat(["Procesa_ipasnieks"]);
  aliasMap.products = (aliasMap.products || []).concat(["Procesa_galaprodukti"]);
  aliasMap.productTypes = (aliasMap.productTypes || []).concat(["Procesa_galaproduktu_veidi"]);
  aliasMap.input = (aliasMap.input || []).concat(["Procesa_iniciators"]);
  aliasMap.relatedProcesses = (aliasMap.relatedProcesses || []).concat(["Saistitie_procesi", "Procesa_galaproduktu_skaits"]);
  aliasMap.services = (aliasMap.services || []).concat(["Pakalpojumi", "Procesa_galaproduktu videjais_izpildes_laiks"]);
  aliasMap.flowcharts = (aliasMap.flowcharts || []).concat(["Plusma_shema"]);
  aliasMap.itResources = (aliasMap.itResources || []).concat(["IT_resursi", "Risku_vadiba"]);
  aliasMap.optimization = (aliasMap.optimization || []).concat(["Optimizacija"]);
  aliasMap.otherMetrics = (aliasMap.otherMetrics || []).concat(["Citi_raditaji", "Uzdevuma_procesa_KPI"]);

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
    const taskNoKey = fk(d, ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"]);
    const procNoKey = fk(d, ["Procesa_numurs", "procesa_numurs", "Procesa_Nr.", "procesa_nr", "Procesa Nr.", "processNo"]);
    const matchKeys = [];
    if (idKey) matchKeys.push({ key: idKey, value: d[idKey] });
    if (taskNoKey) matchKeys.push({ key: taskNoKey, value: d[taskNoKey] });
    if (procNoKey) matchKeys.push({ key: procNoKey, value: d[procNoKey] });

    return {
      id: gv(d, ["id", "ID", "Id"]),
      idKey,
      matchKeys,
      raw: d,
      group: normGroup(gv(d, ["procesu_grupa", "Procesu grupa", "group", "procGroup", "procesuGrupa"])),
      taskNo: gv(d, ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"]),
      task: gv(d, ["Uzdevums", "uzdevums", "task"]),
      processNo: gv(d, ["procesa_nr", "Procesa_Nr.", "Procesa Nr.", "processNo", "Procesa_numurs", "procesa_numurs"]),
      process: gv(d, ["Procesi, kas nodrošina uzdevuma dzīves ciklu", "procesi_dzives_ciklam", "processLife", "Process"]),
      owner: gv(d, ["procesa_ipasnieks", "Procesa_ipasnieks", "Procesa_īpašnieks", "Procesa īpašnieks", "processOwner"]),
      input: gv(d, ["procesa_iniciators", "Procesa_iniciators", "input"]),
      products: gv(d, ["galaprodukti", "outputProducts", "normativie_akti", "Normatīvie akti", "laws", "Procesa_galaprodukti"]),
      productTypes: gv(d, ["galaproduktu_veidi", "outputTypes", "procesa_dokumentacija", "Procesa dokumentācija", "docs", "Procesa_galaproduktu_veidi"]),
      relatedProcesses: gv(d, ["saistitie_procesi", "Saistitie_procesi", "relatedProcesses", "galaproduktu_skaits", "outputCount", "Procesa_galaproduktu_skaits"]),
      services: gv(d, ["pakalpojumi", "Pakalpojumi", "services", "videjais_izpildes_laiks", "outputAvgTime", "Procesa_galaproduktu videjais_izpildes_laiks"]),
      flowcharts: gv(d, ["plusmas_shemas", "plūsmas_shēmas", "flowcharts", "kpi", "Plusma_shema"]),
      itResources: gv(d, ["it_resursi", "IT_resursi", "itResources", "riski", "riskInfo", "Risku_vadiba"]),
      optimization: gv(d, ["optimizacija", "optimization", "Optimizacija"]),
      otherMetrics: gv(d, ["citi_raditaji", "Citi_raditaji", "otherMetrics", "Uzdevuma_procesa_KPI"]),
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
    if (!row) throw new Error("Nav derīga ieraksta atjaunināšanai.");
    const payload = toPayload(formVals, row.raw || null);
    let q = supabaseClient.from(TABLE).update(payload);

    const keys = Array.isArray(row.matchKeys) ? row.matchKeys.filter((k) => k && k.key && k.value !== undefined && k.value !== null && String(k.value) !== "") : [];
    if (keys.length) {
      keys.forEach((k) => {
        q = qeq(q, k.key, k.value);
      });
    } else if (row.idKey && row.id !== undefined && row.id !== null) {
      q = qeq(q, row.idKey, row.id);
    } else {
      throw new Error("Nav derīgas primārās atslēgas atjaunināšanai.");
    }

    const { data, error } = await q.select("*").single();
    if (error) throw error;
    return data;
  }

  async function remove(row) {
    if (!row) throw new Error("Nav derīga ieraksta dzēšanai.");
    let q = supabaseClient.from(TABLE).delete();

    const keys = Array.isArray(row.matchKeys) ? row.matchKeys.filter((k) => k && k.key && k.value !== undefined && k.value !== null && String(k.value) !== "") : [];
    if (keys.length) {
      keys.forEach((k) => {
        q = qeq(q, k.key, k.value);
      });
    } else if (row.idKey && row.id !== undefined && row.id !== null) {
      q = qeq(q, row.idKey, row.id);
    } else {
      throw new Error("Nav derīgas primārās atslēgas dzēšanai.");
    }

    const { data, error } = await q.select("*").single();
    if (error) throw error;
    return data;
  }

  function mapCatalogRow(r) {
    const key = "Galaproduktu_veida_Nr.";
    return {
      key,
      id: gv(r, [key]),
      typeNo: gv(r, [key]),
      type: gv(r, ["Galaprodukta_veids"]),
      unit: gv(r, ["Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu"]),
      taskNo: gv(r, ["Uzdevuma_Nr."]),
      procNo: gv(r, ["Procesa_Nr."]),
      raw: r,
    };
  }

  async function loadCatalogTypes() {
    let data = null;
    let error = null;

    ({ data, error } = await supabaseClient.from(CATALOG_TABLE).select("*"));
    if (error) {
      const fb = await supabaseClient.from("procesu_galaproduktu_veidu_katalogs").select("*");
      data = fb.data;
      error = fb.error;
    }
    if (error) throw error;

    return (data || []).map(mapCatalogRow);
  }

  async function insertCatalog(row) {
    const payload = {
      "Galaproduktu_veida_Nr.": String(row.typeNo || "").trim(),
      "Galaprodukta_veids": String(row.type || "").trim(),
      "Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu": String(row.unit || "").trim(),
      "Uzdevuma_Nr.": String(row.taskNo || "").trim(),
      "Procesa_Nr.": String(row.procNo || "").trim(),
    };
    if (!payload["Galaproduktu_veida_Nr."] || !payload["Galaprodukta_veids"]) {
      throw new Error("Galaproduktu veida Nr. un Galaprodukta veids ir obligāti.");
    }
    const { data, error } = await supabaseClient
      .from(CATALOG_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw error;
    return mapCatalogRow(data);
  }

  async function updateCatalog(current, row) {
    const key = current && current.key ? current.key : "Galaproduktu_veida_Nr.";
    const id = current ? current.id : null;
    if (!id) throw new Error("Nav kataloga primārās atslēgas.");

    const payload = {
      "Galaprodukta_veids": String(row.type || "").trim(),
      "Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu": String(row.unit || "").trim(),
      "Uzdevuma_Nr.": String(row.taskNo || "").trim(),
      "Procesa_Nr.": String(row.procNo || "").trim(),
    };
    if (!payload["Galaprodukta_veids"]) {
      throw new Error("Galaprodukta veids ir obligāts.");
    }
    const { data, error } = await supabaseClient
      .from(CATALOG_TABLE)
      .update(payload)
      .eq(pgCol(key), id)
      .select("*")
      .single();
    if (error) throw error;
    return mapCatalogRow(data);
  }

  async function removeCatalog(current) {
    const key = current && current.key ? current.key : "Galaproduktu_veida_Nr.";
    const id = current ? current.id : null;
    if (!id) throw new Error("Nav kataloga primārās atslēgas dzēšanai.");
    const { data, error } = await supabaseClient
      .from(CATALOG_TABLE)
      .delete()
      .eq(pgCol(key), id)
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
    loadCatalogTypes,
    insertCatalog,
    updateCatalog,
    removeCatalog,
    mapDbError,
  };
})();
