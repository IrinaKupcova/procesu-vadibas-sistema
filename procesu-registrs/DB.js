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
  const SINGLE_TABLE_MODE = (() => {
    try {
      if (typeof window !== "undefined" && window.PV_SINGLE_TABLE_MODE != null) return !!window.PV_SINGLE_TABLE_MODE;
    } catch (_) {}
    return true;
  })();
  const GROUPS = new Set([
    "pamatdarbība",
    "atbalsts",
    "pārvaldība",
  ]);

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let syncChannel = null;
  let pollTimer = null;

  let dbCols = new Set();
  let catalogCols = new Set();

  const fk = (o, a) => a.find((k) => Object.prototype.hasOwnProperty.call(o, k));
  const gv = (o, a) => {
    const k = fk(o, a);
    return k ? o[k] : "";
  };
  const gid = (o) => fk(o, ["id", "ID", "Id"]) || null;
  const normGroup = (g) => {
    const t = String(g || "").trim().toLowerCase();
    if (GROUPS.has(t)) return t;
    if (t.includes("pamatdarb")) return "pamatdarbība";
    if (t.includes("atbal")) return "atbalsts";
    if (t.includes("vad") || t.includes("pārvald")) return "pārvaldība";
    return "pamatdarbība";
  };
  const pgCol = (name) => {
    const s = String(name || "");
    // PostgREST path parserim kolonnas ar punktiem/atstarpēm jāiekļauj pēdiņās.
    return /^[A-Za-z0-9_]+$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`;
  };
  const qeq = (query, key, value) => query.eq(pgCol(key), value);
  const nkey = (v) => String(v || "").normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  function splitCatalogProducts(v) {
    if (v instanceof Set) {
      return Array.from(v).map((x) => String(x || "").trim()).filter(Boolean);
    }
    if (Array.isArray(v)) {
      return v.map((x) => String(x || "").trim()).filter(Boolean);
    }
    const raw = String(v || "");
    const base = raw
      .split(/[;\n]/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
    if (base.length > 1) return base;
    const commaCount = (raw.match(/,/g) || []).length;
    if (commaCount >= 2) {
      return raw
        .split(",")
        .map((x) => String(x || "").trim())
        .filter(Boolean);
    }
    return base;
  }
  function splitCatalogTypeNos(v) {
    if (v instanceof Set) return Array.from(v).map((x) => String(x || "").trim());
    if (Array.isArray(v)) return v.map((x) => String(x || "").trim());
    return String(v || "")
      .split(/[;,\n]+/)
      .map((x) => String(x || "").trim());
  }
  function joinCatalogTypeNos(arr) {
    return (arr || []).map((x) => String(x || "").trim()).join("; ");
  }
  function getProcessTypeNoColFromRaw(raw) {
    const candidates = [
      "Procesa_galaprodukta_Nr.",
      "Procesa_galaprodukta_Nr",
      "procesa_galaprodukta_nr",
      "Procesa_galaprodukta_nr",
      "Galaproduktu_veida_Nr.",
      "Galaproduktu_veida_Nr",
    ];
    for (const c of candidates) {
      if (raw && Object.prototype.hasOwnProperty.call(raw, c)) return c;
      if (dbCols && dbCols.has(c)) return c;
    }
    return "Procesa_galaprodukta_Nr.";
  }
  function findSingleTableTargetRow(rows, procNo, type) {
    const p = String(procNo || "").trim();
    const tKey = nkey(type || "");
    if (p) {
      const byProc = (rows || []).find((r) => String((r && r.processNo) || "").trim() === p);
      if (byProc) return byProc;
    }
    if (tKey) {
      const byToken = (rows || []).find((r) => splitCatalogProducts((r && r.products) || "").some((x) => nkey(x) === tKey));
      if (byToken) return byToken;
      // Fallback migrācijas/veco datu gadījumiem, kad products nav korekti tokenizēts.
      const byRawContains = (rows || []).find((r) => nkey((r && r.products) || "").includes(tKey));
      if (byRawContains) return byRawContains;
      const byProcessName = (rows || []).find((r) => nkey((r && r.process) || "") === tKey);
      if (byProcessName) return byProcessName;
      return null;
    }
    return null;
  }
  function joinCatalogProducts(arr) {
    return (arr || []).map((x) => String(x || "").trim()).filter(Boolean).join("; ");
  }
  const emitSync = (kind, source) => {
    try {
      window.dispatchEvent(new CustomEvent("app:db-sync", { detail: { kind, source } }));
    } catch (_) {}
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
  function extractMissingColumnName(err) {
    const msg = String((err && err.message) || "");
    const m = msg.match(/Could not find the '([^']+)' column/i);
    return m ? String(m[1] || "").trim() : "";
  }
  function extractGeneratedAlwaysColumnName(err) {
    const details = String((err && err.details) || "");
    const msg = String((err && err.message) || "");
    let m = details.match(/Column "([^"]+)" is an identity column defined as GENERATED ALWAYS/i);
    if (m) return String(m[1] || "").trim();
    m = msg.match(/column "([^"]+)" can only be updated to DEFAULT/i);
    return m ? String(m[1] || "").trim() : "";
  }
  async function runWriteWithMissingColumnRetry(initialPayload, runner) {
    let payload = Object.assign({}, initialPayload || {});
    let lastErr = null;
    for (let i = 0; i < 12; i += 1) {
      const { data, error } = await runner(payload);
      if (!error) return { data, payload };
      lastErr = error;
      const missing = extractMissingColumnName(error);
      if (missing) {
        if (!Object.prototype.hasOwnProperty.call(payload, missing)) throw error;
        delete payload[missing];
        continue;
      }
      const generatedAlwaysCol = extractGeneratedAlwaysColumnName(error);
      if (generatedAlwaysCol) {
        if (!Object.prototype.hasOwnProperty.call(payload, generatedAlwaysCol)) throw error;
        delete payload[generatedAlwaysCol];
        continue;
      }
      throw error;
    }
    throw lastErr || new Error("Neizdevās izpildīt DB rakstīšanu.");
  }

  function pickKey(raw, choices) {
    if (!choices || !choices.length) return null;
    // update: izmantojam kolonnas nosaukumu no esošā ieraksta
    if (raw) {
      const k = fk(raw, choices);
      if (k) return k;
    }
    // insert: tikai kolonnas, kas patiešām ir tabulā (citādi PGRST204 / nepareizs nosaukums)
    if (dbCols && dbCols.size > 0) {
      return choices.find((c) => dbCols.has(c)) || null;
    }
    return choices[0] || null;
  }

  function pickCatalogCol(candidates, fallback) {
    if (catalogCols && catalogCols.size) {
      for (const c of candidates || []) {
        if (catalogCols.has(c)) return c;
      }
    }
    return fallback || (candidates && candidates.length ? candidates[0] : null);
  }
  function pickCatalogRowCol(raw, candidates, fallback) {
    if (raw) {
      const k = fk(raw, candidates || []);
      if (k) return k;
    }
    return pickCatalogCol(candidates || [], fallback);
  }
  function pickCatalogExistingCol(candidates) {
    if (!catalogCols || !catalogCols.size) return null;
    for (const c of candidates || []) {
      if (catalogCols.has(c)) return c;
    }
    return null;
  }

  const aliasMap = {
    group: ["Procesa_grupa", "procesa_grupa", "Procesu_grupa", "procesu_grupa", "Procesu grupa", "group", "procGroup", "procesuGrupa"],
    taskNo: ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"],
    task: ["Uzdevums", "uzdevums", "task"],
    processNo: ["Procesa_Nr.", "procesa_nr", "Procesa Nr.", "processNo"],
    process: ["Procesi, kas nodrošina uzdevuma dzīves ciklu", "procesi_dzives_ciklam", "processLife"],
    darbibasJoma: ["Darbibas_joma", "darbibas_joma", "Darbības joma", "darbibasJoma"],
    owner: ["Procesa_īpašnieks", "procesa_ipasnieks", "Procesa īpašnieks", "processOwner"],
    products: ["galaprodukti", "outputProducts", "normativie_akti", "Normatīvie akti", "laws"],
    productTypes: ["galaproduktu_veidi", "outputTypes", "procesa_dokumentacija", "Procesa dokumentācija", "docs"],
    input: ["procesa_iniciators", "input", "Procesa iniciātors (input)"],
    relatedProcesses: ["saistitie_procesi", "relatedProcesses", "galaproduktu_skaits", "outputCount"],
    services: ["pakalpojumi", "services", "videjais_izpildes_laiks", "outputAvgTime"],
    flowcharts: ["plusmas_shemas", "plūsmas_shēmas", "flowcharts", "kpi"],
    itResources: ["it_resursi", "itResources", "riski", "riskInfo"],
    optimization: ["optimizacija", "optimization"],
    executorPatstaviga: [
      "Procesa_izpilditajs-patstaviga_strukturvieniba",
      "procesa_izpilditajs-patstaviga_strukturvieniba",
      "Procesa_izpilditajs_patstaviga_strukturvieniba",
      "procesa_izpilditajs_patstaviga_strukturvieniba",
    ],
    executorDala: [
      "Strukturvieniba_dala",
      "strukturvieniba_dala",
      "Dala_nodala",
      "Dala,_nodala",
      "Dala, nodala",
      "Daļa,_nodaļa",
      "Daļa_nodaļa",
      "Daļa, nodaļa",
      "executorDala",
    ],
    otherMetrics: ["citi_raditaji", "otherMetrics"],
  };

  // Papildu aliasi, lai saskaņotu ar tavu tabulas shēmu:
  // "Procesa_numurs", "Procesa_galaprodukti", "Pakalpojumi" u.c.
  aliasMap.processNo = (aliasMap.processNo || []).concat(["Procesa_numurs", "procesa_numurs"]);
  aliasMap.process = (aliasMap.process || []).concat(["Process"]);
  aliasMap.darbibasJoma = (aliasMap.darbibasJoma || []).concat(["Darbibas_joma", "darbibas_joma", "darbibasJoma"]);
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
    // Atļaujam tiešos DB kolonnu nosaukumus (piem., Procesa_galaprodukta_Nr.)
    // updateCatalog/insertCatalog single-table režīmā tos nodod tieši.
    Object.keys(formVals || {}).forEach((k) => {
      if (!k || Object.prototype.hasOwnProperty.call(aliasMap, k)) return;
      const hasInRaw = raw && Object.prototype.hasOwnProperty.call(raw, k);
      const hasInDb = dbCols && dbCols.size ? dbCols.has(k) : false;
      if (!hasInRaw && !hasInDb) return;
      p[k] = formVals[k] == null ? "" : formVals[k];
    });

    // Obligātie lauki — tikai reālās kolonnas no dbCols (bez „minētas” kolonnas, kuras tabulā nav).
    if (formVals.taskNo) {
      const candidate =
        dbCols.has("Uzdevuma_Nr.") ? "Uzdevuma_Nr." :
        dbCols.has("uzdevuma_nr") ? "uzdevuma_nr" :
        dbCols.has("Uzdevuma Nr.") ? "Uzdevuma Nr." :
        dbCols.has("taskNo") ? "taskNo" :
        null;
      if (candidate && !Object.prototype.hasOwnProperty.call(p, candidate)) p[candidate] = formVals.taskNo;
      else if (!dbCols.size && !Object.prototype.hasOwnProperty.call(p, "Uzdevuma_Nr.")) p["Uzdevuma_Nr."] = formVals.taskNo;
    }

    if (formVals.processNo) {
      const candidate =
        dbCols.has("Procesa_Nr.") ? "Procesa_Nr." :
        dbCols.has("procesa_nr") ? "procesa_nr" :
        dbCols.has("Procesa Nr.") ? "Procesa Nr." :
        dbCols.has("processNo") ? "processNo" :
        dbCols.has("Procesa_numurs") ? "Procesa_numurs" :
        dbCols.has("procesa_numurs") ? "procesa_numurs" :
        null;
      if (candidate && !Object.prototype.hasOwnProperty.call(p, candidate)) p[candidate] = formVals.processNo;
      else if (!dbCols.size && !Object.prototype.hasOwnProperty.call(p, "Procesa_Nr.")) p["Procesa_Nr."] = formVals.processNo;
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
      group: normGroup(gv(d, ["Procesa_grupa", "procesa_grupa", "procesu_grupa", "Procesu grupa", "group", "procGroup", "procesuGrupa"])),
      taskNo: gv(d, ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"]),
      task: gv(d, ["Uzdevums", "uzdevums", "task"]),
      processNo: gv(d, ["procesa_nr", "Procesa_Nr.", "Procesa Nr.", "processNo", "Procesa_numurs", "procesa_numurs"]),
      process: gv(d, ["Procesi, kas nodrošina uzdevuma dzīves ciklu", "procesi_dzives_ciklam", "processLife", "Process"]),
      darbibasJoma: gv(d, ["Darbibas_joma", "darbibas_joma", "Darbības joma", "darbibasJoma"]),
      owner: gv(d, ["procesa_ipasnieks", "Procesa_ipasnieks", "Procesa_īpašnieks", "Procesa īpašnieks", "processOwner"]),
      input: gv(d, ["procesa_iniciators", "Procesa_iniciators", "input"]),
      executorPatstaviga: gv(d, [
        "Procesa_izpilditajs-patstaviga_strukturvieniba",
        "procesa_izpilditajs-patstaviga_strukturvieniba",
        "Procesa_izpilditajs_patstaviga_strukturvieniba",
        "procesa_izpilditajs_patstaviga_strukturvieniba",
      ]),
      executorDala: gv(d, [
        "Strukturvieniba_dala",
        "strukturvieniba_dala",
        "Dala_nodala",
        "Dala,_nodala",
        "Dala, nodala",
        "Daļa,_nodaļa",
        "Daļa_nodaļa",
        "Daļa, nodaļa",
        "executorDala",
      ]),
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
    const chunk = 1000;
    let from = 0;
    let rows = [];
    while (true) {
      const to = from + chunk - 1;
      const { data, error } = await supabaseClient.from(TABLE).select("*").range(from, to);
      if (error) throw error;
      const part = data || [];
      rows = rows.concat(part);
      if (part.length < chunk) break;
      from += chunk;
    }

    dbCols = new Set();
    rows.forEach((r) => {
      Object.keys(r || {}).forEach((k) => dbCols.add(k));
    });

    return rows.map(mapDbRowToUiRow);
  }

  async function insert(formVals) {
    let payload = toPayload(formVals, null);
    // Dubulta drošība: neinsertējam laukus, ko shēmā nav (pēc pirmā load dbCols)
    if (dbCols && dbCols.size > 0) {
      const cleaned = {};
      Object.keys(payload).forEach((k) => {
        if (dbCols.has(k)) cleaned[k] = payload[k];
      });
      payload = cleaned;
    }
    const result = await runWriteWithMissingColumnRetry(payload, (p) => {
      return supabaseClient.from(TABLE).insert(p);
    });
    emitSync("process", "html");
    return result.payload;
  }

  async function update(row, formVals) {
    if (!row) throw new Error("Nav derīga ieraksta atjaunināšanai.");
    const payload = toPayload(formVals, row.raw || null);
    const keys = Array.isArray(row.matchKeys) ? row.matchKeys.filter((k) => k && k.key && k.value !== undefined && k.value !== null && String(k.value) !== "") : [];
    if (!keys.length && !(row.idKey && row.id !== undefined && row.id !== null)) {
      throw new Error("Nav derīgas primārās atslēgas atjaunināšanai.");
    }
    const result = await runWriteWithMissingColumnRetry(payload, (p) => {
      let q = supabaseClient.from(TABLE).update(p);
      if (keys.length) {
        keys.forEach((k) => {
          q = qeq(q, k.key, k.value);
        });
      } else {
        q = qeq(q, row.idKey, row.id);
      }
      return q;
    });
    emitSync("process", "html");
    return result.payload;
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

    const { error } = await q;
    if (error) throw error;
    emitSync("process", "html");
    return true;
  }

  function mapCatalogRow(r) {
    const typeNoKey = pickCatalogRowCol(
      r,
      [
        "Procesa_galaprodukta_Nr.",
        "Procesa_galaprodukta_Nr",
        "procesa_galaprodukta_nr",
        "Procesa_galaprodukta_nr",
        "Galaproduktu_veida_Nr.",
        "Galaproduktu_veida_Nr",
      ],
      "Procesa_galaprodukta_Nr."
    );
    const idKey = gid(r) || typeNoKey;
    const matchKeys = [];
    if (idKey) {
      const v = gv(r, [idKey]);
      if (v !== undefined && v !== null && String(v) !== "") matchKeys.push({ key: idKey, value: v });
    }
    const procNoKey = fk(r, [
      "Procesa_numurs",
      "procesa_numurs",
      "Procesa_Nr.",
      "procesa_nr",
      "Procesa Nr.",
      "processNo",
    ]);
    if (procNoKey) {
      const v = gv(r, [procNoKey]);
      if (v !== undefined && v !== null && String(v) !== "") matchKeys.push({ key: procNoKey, value: v });
    }
    const taskNoKey = fk(r, ["Uzdevuma_Nr.", "uzdevuma_nr", "Uzdevuma Nr.", "taskNo"]);
    if (taskNoKey) {
      const v = gv(r, [taskNoKey]);
      if (v !== undefined && v !== null && String(v) !== "") matchKeys.push({ key: taskNoKey, value: v });
    }
    let typeCol = pickCatalogRowCol(
      r,
      [
        "Procesa_galaprodukti",
        "procesa_galaprodukti",
        "Procesa galaprodukti",
        "Galaprodukta_veids",
        "galaprodukta_veids",
        "Galaprodukta veids",
      ],
      "Procesa_galaprodukti"
    );
    if (!typeCol) {
      typeCol = Object.keys(r || {}).find((k) => {
        const key = String(k || "");
        return /galaprodukt/i.test(key) && !/(nr|numur|id)/i.test(key);
      }) || null;
    }
    if (typeCol) {
      const v = gv(r, [typeCol]);
      if (v !== undefined && v !== null && String(v) !== "") matchKeys.push({ key: typeCol, value: v });
    }
    const typeNoValue = gv(r, [
      "Procesa_galaprodukta_Nr.",
      "Procesa_galaprodukta_Nr",
      "procesa_galaprodukta_nr",
      "Procesa_galaprodukta_nr",
      "Galaproduktu_veida_Nr.",
      "Galaproduktu_veida_Nr",
    ]);
    const typeNoFallback = String(typeNoValue || "").trim() ? typeNoValue : gv(r, [idKey]);
    return {
      key: idKey,
      id: gv(r, [idKey]),
      matchKeys,
      typeNo: typeNoFallback,
      type: gv(r, [
        typeCol,
        "Procesa_galaprodukti",
        "procesa_galaprodukti",
        "Procesa galaprodukti",
        "Galaprodukta_veids",
        "galaprodukta_veids",
        "Galaprodukta veids",
      ]),
      unit: gv(r, [
        "Procesa_izpilditajs-patstaviga_strukturvieniba",
        "Procesa_izpilditajs_patstaviga_strukturvieniba",
        "procesa_izpilditajs-patstaviga_strukturvieniba",
        "Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu",
      ]),
      department: gv(r, [
        "Daļa, nodaļa",
        "Dala_nodala",
        "Dala,_nodala",
        "Dala, nodala",
        "Dala, nodaļa",
        "Daļa,_nodaļa",
        "Daļa, nodala",
        "Daļa, nodaļa",
        "Daļa_nodaļa",
        "dala_nodala",
      ]),
      taskNo: gv(r, ["Uzdevuma_Nr.", "Uzdevuma_Nr", "uzdevuma_nr", "taskNo"]),
      procNo: gv(r, [
        "Procesa_numurs",
        "procesa_numurs",
        "Procesa_Nr.",
        "Procesa_Nr",
        "procesa_nr",
        "Procesa Nr.",
        "processNo",
      ]),
      process: gv(r, ["Process", "Procesi, kas nodrošina uzdevuma dzīves ciklu", "processLife"]),
      group: gv(r, ["Procesa_grupa", "Procesu_grupa", "procesa_grupa", "procesu_grupa", "group"]),
      darbibasJoma: gv(r, ["Darbibas_joma", "darbibas_joma", "Darbības joma", "darbibasJoma", "Joma_piesaiste_galaproduktam"]),
      /** Sensitīvitātes pakāpe / sasaiste ar korupcijas riskiem (ja kolonna ir DB) */
      sensitivity: gv(r, [
        "Sensitivitates_pakape",
        "Sensitīvitātes_pakāpe",
        "sensitivitates_pakape",
        "Korupcijas_riska_sasaiste",
      ]),
      additionalInfo: gv(r, ["Papildu informācija", "Papildu informācija", "additionalInfo"]),
      raw: r,
    };
  }
  function getByKeyCI(obj, key) {
    if (!obj || !key) return "";
    const exact = Object.prototype.hasOwnProperty.call(obj, key) ? key : null;
    if (exact) return obj[exact];
    const kk = String(key).toLowerCase();
    const hit = Object.keys(obj).find((k) => String(k || "").toLowerCase() === kk);
    return hit ? obj[hit] : "";
  }
  function getUnifiedVal(row, preferred, fallback) {
    const nestedK = row && row.katalogs_row && typeof row.katalogs_row === "object" ? row.katalogs_row : null;
    const nestedR = row && row.registrs_row && typeof row.registrs_row === "object" ? row.registrs_row : null;
    const keys = [];
    if (preferred) keys.push(preferred, "k__" + preferred, "r__" + preferred);
    if (fallback) keys.push(fallback, "k__" + fallback, "r__" + fallback);
    const k = fk(row || {}, keys);
    if (k) return row[k];
    for (const key of keys) {
      const v = getByKeyCI(row, key);
      if (v !== undefined && v !== null && String(v) !== "") return v;
    }
    const kk = fk(nestedK || {}, [preferred, fallback].filter(Boolean));
    if (kk) return nestedK[kk];
    for (const key of [preferred, fallback].filter(Boolean)) {
      const v = getByKeyCI(nestedK, key);
      if (v !== undefined && v !== null && String(v) !== "") return v;
    }
    const kr = fk(nestedR || {}, [preferred, fallback].filter(Boolean));
    if (kr) return nestedR[kr];
    for (const key of [preferred, fallback].filter(Boolean)) {
      const v = getByKeyCI(nestedR, key);
      if (v !== undefined && v !== null && String(v) !== "") return v;
    }
    return "";
  }
  function getUnifiedCatalogVal(row, keys) {
    const list = Array.isArray(keys) ? keys : [];
    const nestedK = row && row.katalogs_row && typeof row.katalogs_row === "object" ? row.katalogs_row : null;
    for (const key of list) {
      if (!key) continue;
      const prefixed = "k__" + key;
      const vPref = getByKeyCI(row, prefixed);
      if (vPref !== undefined && vPref !== null && String(vPref) !== "") return vPref;
      const vNested = getByKeyCI(nestedK, key);
      if (vNested !== undefined && vNested !== null && String(vNested) !== "") return vNested;
    }
    // Fallback: tikai ja view nav prefiksu/nested struktūras.
    for (const key of list) {
      const v = getByKeyCI(row, key);
      if (v !== undefined && v !== null && String(v) !== "") return v;
    }
    return "";
  }
  function mapCatalogUnifiedRow(r) {
    const merged = Object.assign({}, r || {});
    // GP identitāte primāri no KATALOGA daļas (k__), nevis no procesu_registrs.
    const kTypeNo = getUnifiedCatalogVal(r, ["Procesa_galaprodukta_Nr.", "Galaproduktu_veida_Nr."]);
    const kType = getUnifiedCatalogVal(r, ["Procesa_galaprodukti", "Galaprodukta_veids"]);
    const kUnit = getUnifiedCatalogVal(r, ["Procesa_izpilditajs-patstaviga_strukturvieniba", "Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu"]);
    const kDept = getUnifiedCatalogVal(r, ["Daļa, nodaļa", "Dala_nodala"]);
    const kProcNo = getUnifiedCatalogVal(r, ["Procesa_Nr.", "Procesa_numurs"]);
    const kProcess = getUnifiedCatalogVal(r, ["Process"]);
    const kGroup = getUnifiedCatalogVal(r, ["Procesa_grupa"]);
    const kJoma = getUnifiedCatalogVal(r, ["Darbibas_joma", "Joma_piesaiste_galaproduktam"]);
    const kInfo = getUnifiedCatalogVal(r, ["Papildu informācija", "additionalInfo"]);

    if (kTypeNo !== "") merged["Procesa_galaprodukta_Nr."] = kTypeNo;
    if (kType !== "") merged["Procesa_galaprodukti"] = kType;
    if (kUnit !== "") merged["Procesa_izpilditajs-patstaviga_strukturvieniba"] = kUnit;
    if (kDept !== "") merged["Daļa, nodaļa"] = kDept;
    if (kProcNo !== "") merged["Procesa_Nr."] = kProcNo;
    if (kProcess !== "") merged["Process"] = kProcess;
    if (kGroup !== "") merged["Procesa_grupa"] = kGroup;
    if (kJoma !== "") merged["Darbibas_joma"] = kJoma;
    if (kInfo !== "") merged["Papildu informācija"] = kInfo;

    // Ja view dod arī procesu_registrs kolonnas, tās izmantojam kā fallback aizpildījumam.
    const regProcNo = getUnifiedVal(r, "Procesa_numurs", "Procesa_Nr.");
    const regProcess = getUnifiedVal(r, "Process", null);
    const regJoma = getUnifiedVal(r, "Darbibas_joma", null);
    if (!merged["Procesa_Nr."] && regProcNo !== "") merged["Procesa_Nr."] = regProcNo;
    if (!merged["Process"] && regProcess !== "") merged["Process"] = regProcess;
    if (!merged["Darbibas_joma"] && regJoma !== "") merged["Darbibas_joma"] = regJoma;

    return mapCatalogRow(merged);
  }
  function mapProcessRegistryRowForCatalog(r) {
    return {
      typeNo: gv(r, ["Procesa_galaprodukta_Nr.", "Procesa_galaprodukta_Nr", "procesa_galaprodukta_nr", "Procesa_galaprodukta_nr"]),
      type: gv(r, ["Procesa_galaprodukti", "procesa_galaprodukti", "Galaprodukta_veids", "galaprodukta_veids"]),
      procNo: gv(r, ["Procesa_numurs", "procesa_numurs", "Procesa_Nr.", "Procesa_Nr", "procesa_nr", "Procesa Nr.", "processNo"]),
      process: gv(r, ["Process", "Procesi, kas nodrošina uzdevuma dzīves ciklu", "processLife"]),
      group: gv(r, ["Procesa_grupa", "Procesu_grupa", "procesa_grupa", "procesu_grupa", "group"]),
      darbibasJoma: gv(r, ["Darbibas_joma", "darbibas_joma", "Darbības joma", "darbibasJoma"]),
      unit: gv(r, [
        "Procesa_izpilditajs-patstaviga_strukturvieniba",
        "Procesa_izpilditajs_patstaviga_strukturvieniba",
        "procesa_izpilditajs-patstaviga_strukturvieniba",
        "Procesa_izpilditajs,_parvalde",
        "Procesa_izpildītājs,_pārvalde",
        "Procesa izpildītājs, pārvalde",
      ]),
      department: gv(r, ["Daļa, nodaļa", "Strukturvieniba_dala", "strukturvieniba_dala", "Dala_nodala", "Dala,_nodala", "Daļa_nodaļa"]),
    };
  }
  async function fillCatalogMissingFromProcessRegistry(rows) {
    const { data, error } = await supabaseClient.from(TABLE).select("*");
    if (error) return rows;
    const byProcNo = new Map();
    const byTypeNo = new Map();
    (data || []).forEach((r) => {
      const mapped = mapProcessRegistryRowForCatalog(r || {});
      const k = String(mapped.procNo || "").trim();
      if (!k || byProcNo.has(k)) return;
      byProcNo.set(k, mapped);
    });
    (data || []).forEach((r) => {
      const mapped = mapProcessRegistryRowForCatalog(r || {});
      const k = String(mapped.typeNo || "").trim();
      if (!k || byTypeNo.has(k)) return;
      byTypeNo.set(k, mapped);
    });
    return (rows || []).map((x) => {
      const procNo = String((x && x.procNo) || "").trim();
      const typeNo = String((x && x.typeNo) || "").trim();
      const pByProc = byProcNo.get(procNo);
      const pByType = byTypeNo.get(typeNo);
      if (!pByProc && !pByType) return x;
      const out = Object.assign({}, x);
      // GP identitāti (numurs/nosaukums) no procesu_registrs NEaizpildām,
      // lai nepārrakstītu korekto procesi_unified kataloga GP ar "salīmētu" tekstu.
      // Procesa metadatus drīkstam ņemt no procNo fallback.
      const pMeta = pByProc || pByType;
      if (pMeta) {
        if (!String(out.procNo || "").trim()) out.procNo = String(pMeta.procNo || "").trim();
        if (!String(out.process || "").trim()) out.process = String(pMeta.process || "").trim();
        if (!String(out.group || "").trim()) out.group = String(pMeta.group || "").trim();
        if (!String(out.darbibasJoma || "").trim()) out.darbibasJoma = String(pMeta.darbibasJoma || "").trim();
        if (!String(out.unit || "").trim()) out.unit = String(pMeta.unit || "").trim();
        if (!String(out.department || "").trim()) out.department = String(pMeta.department || "").trim();
      }
      return out;
    });
  }

  async function loadCatalogTypes() {
    if (SINGLE_TABLE_MODE) {
      const { data, error } = await supabaseClient.from(TABLE).select("*");
      if (error) throw error;
      dbCols = new Set();
      (data || []).forEach((r) => Object.keys(r || {}).forEach((k) => dbCols.add(k)));
      const processRows = (data || []).map(mapDbRowToUiRow);
      const out = [];
      processRows.forEach((p) => {
        const procNo = String((p && p.processNo) || "").trim();
        const gps = splitCatalogProducts((p && p.products) || "");
        const raw = (p && p.raw) || {};
        const typeNoCol = getProcessTypeNoColFromRaw(raw);
        const nos = splitCatalogTypeNos(raw ? raw[typeNoCol] : "");
        gps.forEach((gp) => {
          const type = String(gp || "").trim();
          if (!type) return;
          out.push({
            key: p.idKey,
            id: p.id,
            matchKeys: Array.isArray(p.matchKeys) ? p.matchKeys.slice() : [],
            typeNo: String(nos.shift() || "").trim(),
            type,
            unit: String((p && p.executorPatstaviga) || "").trim(),
            department: String((p && p.executorDala) || "").trim(),
            taskNo: String((p && p.taskNo) || "").trim(),
            procNo,
            process: String((p && p.process) || "").trim(),
            group: String((p && p.group) || "").trim(),
            darbibasJoma: String((p && p.darbibasJoma) || "").trim(),
            additionalInfo: "",
            raw: p.raw || null,
          });
        });
      });
      return out;
    }
    let data = null;
    let error = null;

    // Primāri lasām tieši no GP kataloga tabulas.
    ({ data, error } = await supabaseClient.from(CATALOG_TABLE).select("*"));
    if (error) {
      const fb = await supabaseClient.from("procesu_galaproduktu_veidu_katalogs").select("*");
      data = fb.data;
      error = fb.error;
    }
    if (error) throw error;

    catalogCols = new Set();
    (data || []).forEach((r) => {
      Object.keys(r || {}).forEach((k) => catalogCols.add(k));
    });

    const mapped = (data || []).map(mapCatalogRow);
    return await fillCatalogMissingFromProcessRegistry(mapped);
  }

  async function insertCatalog(row) {
    if (SINGLE_TABLE_MODE) {
      const procNo = String((row && row.procNo) || "").trim();
      const gp = String((row && row.type) || "").trim();
      if (!gp) throw new Error("Galaprodukta veids ir obligāts.");
      const processRows = await load();
      const target = findSingleTableTargetRow(processRows || [], procNo, gp);
      if (!target) throw new Error("Nav atrasts process ar norādīto procesa Nr.");
      const existing = splitCatalogProducts(target.products);
      const raw = (target && target.raw) || {};
      const typeNoCol = getProcessTypeNoColFromRaw(raw);
      const existingNos = splitCatalogTypeNos(raw ? raw[typeNoCol] : "");
      if (!existing.some((x) => nkey(x) === nkey(gp))) existing.push(gp);
      if (!existingNos.length && existing.length) existingNos.push("");
      existingNos[existing.length - 1] = String((row && row.typeNo) || existingNos[existing.length - 1] || "").trim();
      const payload = {
        group: row.group != null ? row.group : targetResolved.group,
        taskNo: row.taskNo != null ? row.taskNo : target.taskNo,
        task: target.task,
        processNo: procNo,
        process: row.process != null ? row.process : target.process,
        darbibasJoma: row.darbibasJoma != null ? row.darbibasJoma : target.darbibasJoma,
        owner: target.owner,
        products: joinCatalogProducts(existing),
        [typeNoCol]: joinCatalogTypeNos(existingNos.slice(0, existing.length)),
        productTypes: target.productTypes,
        input: target.input,
        relatedProcesses: target.relatedProcesses,
        services: target.services,
        flowcharts: target.flowcharts,
        itResources: target.itResources,
        optimization: target.optimization,
        executorPatstaviga: row.unit != null ? row.unit : target.executorPatstaviga,
        executorDala: row.department != null ? row.department : target.executorDala,
        otherMetrics: target.otherMetrics,
      };
      await update(target, payload);
      emitSync("catalog", "html");
      return payload;
    }
    const unitCandidates = [
      "Procesa_izpilditajs-patstaviga_strukturvieniba",
      "Procesa_izpilditajs_patstaviga_strukturvieniba",
      "Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu",
    ];
    const deptCandidates = [
      "Daļa,_nodaļa",
      "Daļa_nodaļa",
      "Daļa, nodala",
      "Daļa, nodaļa",
      "Dala_nodala",
      "Dala,_nodala",
      "Dala, nodala",
      "Dala, nodaļa",
      "dala_nodala",
    ];
    const unitCol = pickCatalogCol(unitCandidates, "Procesa_izpilditajs-patstaviga_strukturvieniba");
    const deptCol = pickCatalogCol(deptCandidates, "Dala_nodala");
    const typeNoCol = pickCatalogCol(
      [
        "Procesa_galaprodukta_Nr.",
        "Procesa_galaprodukta_Nr",
        "procesa_galaprodukta_nr",
        "Procesa_galaprodukta_nr",
        "Galaproduktu_veida_Nr.",
        "Galaproduktu_veida_Nr",
      ],
      "Procesa_galaprodukta_Nr."
    );
    const typeCol = pickCatalogCol(
      [
        "Procesa_galaprodukti",
        "procesa_galaprodukti",
        "Procesa galaprodukti",
        "Galaprodukta_veids",
        "galaprodukta_veids",
        "Galaprodukta veids",
      ],
      "Procesa_galaprodukti"
    );
    const processCol = pickCatalogCol(["Process", "process", "Procesi, kas nodrošina uzdevuma dzīves ciklu"], null);
    const groupCol = pickCatalogCol(["Procesa_grupa", "Procesu_grupa", "procesa_grupa", "procesu_grupa", "group"], null);
    const jomaCol = pickCatalogExistingCol(["Darbibas_joma", "darbibas_joma", "Darbības joma", "darbibasJoma", "Joma_piesaiste_galaproduktam"]);

    const typeNoVal = String(row.typeNo || "").trim();
    const payload = {
      [typeCol]: String(row.type || "").trim(),
      [unitCol]: String(row.unit || "").trim(),
      "Uzdevuma_Nr.": String(row.taskNo || "").trim(),
      "Procesa_Nr.": String(row.procNo || "").trim(),
      [deptCol]: String(row.department || "").trim(),
      "Papildu informācija": String(row.additionalInfo || "").trim(),
    };
    if (typeNoVal) payload[typeNoCol] = typeNoVal;
    if (processCol) payload[processCol] = String(row.process || "").trim();
    if (groupCol) payload[groupCol] = String(row.group || "").trim();
    if (jomaCol) payload[jomaCol] = String(row.darbibasJoma || "").trim();
    if (!String(payload[typeCol] || "").trim()) {
      throw new Error("Galaprodukta veids ir obligāts.");
    }
    const result = await runWriteWithMissingColumnRetry(payload, (p) => {
      return supabaseClient
        .from(CATALOG_TABLE)
        .insert(p);
    });
    emitSync("catalog", "html");
    return result.payload;
  }

  async function updateCatalog(current, row) {
    if (SINGLE_TABLE_MODE) {
      const processRows = await load();
      const prevProcNo = String((current && current.procNo) || "").trim();
      const nextProcNo = String((row && row.procNo) || "").trim();
      const procNo = nextProcNo || prevProcNo;
      const target = (processRows || []).find((r) => String((r && r.processNo) || "").trim() === procNo);
      const prevType = String((current && current.type) || "").trim();
      const nextType = String((row && row.type) || "").trim();
      if (!nextType) throw new Error("Galaprodukta veids ir obligāts.");
      const targetResolved = target || findSingleTableTargetRow(processRows || [], procNo, prevType || nextType);
      if (!targetResolved) throw new Error("Nav atrasts process atjaunināšanai.");
      let list = splitCatalogProducts(targetResolved.products);
      const raw = (targetResolved && targetResolved.raw) || {};
      const typeNoCol = getProcessTypeNoColFromRaw(raw);
      let nos = splitCatalogTypeNos(raw ? raw[typeNoCol] : "");
      while (nos.length < list.length) nos.push("");
      const pairs = list.map((name, idx) => ({ name, no: String(nos[idx] || "").trim() }));
      const prevKey = nkey(prevType);
      let replaced = false;
      if (prevKey) {
        for (let i = 0; i < pairs.length; i += 1) {
          if (nkey(pairs[i].name) === prevKey) {
            pairs[i].name = nextType;
            pairs[i].no = String((row && row.typeNo) || "").trim();
            replaced = true;
            break;
          }
        }
      }
      if (!replaced && !pairs.some((x) => nkey(x.name) === nkey(nextType))) {
        pairs.push({ name: nextType, no: String((row && row.typeNo) || "").trim() });
      }
      list = pairs.map((x) => x.name);
      nos = pairs.map((x) => x.no);
      const payload = {
        group: row.group != null ? row.group : target.group,
        taskNo: row.taskNo != null ? row.taskNo : targetResolved.taskNo,
        task: targetResolved.task,
        processNo: procNo,
        process: row.process != null ? row.process : targetResolved.process,
        darbibasJoma: row.darbibasJoma != null ? row.darbibasJoma : targetResolved.darbibasJoma,
        owner: targetResolved.owner,
        products: joinCatalogProducts(list),
        [typeNoCol]: joinCatalogTypeNos(nos),
        productTypes: targetResolved.productTypes,
        input: targetResolved.input,
        relatedProcesses: targetResolved.relatedProcesses,
        services: targetResolved.services,
        flowcharts: targetResolved.flowcharts,
        itResources: targetResolved.itResources,
        optimization: targetResolved.optimization,
        executorPatstaviga: row.unit != null ? row.unit : targetResolved.executorPatstaviga,
        executorDala: row.department != null ? row.department : targetResolved.executorDala,
        otherMetrics: targetResolved.otherMetrics,
      };
      await update(targetResolved, payload);
      emitSync("catalog", "html");
      return payload;
    }
    function buildCatalogFallbackKeys(src) {
      const s = src || {};
      const knownKeys = new Set(Object.keys((s && s.raw) || s || {}));
      const canUse = (k) => !knownKeys.size || knownKeys.has(k);
      const out = [];
      const typeNo = String(s.typeNo || s.id || "").trim();
      const procNo = String(s.procNo || "").trim();
      const type = String(s.type || "").trim();
      if (typeNo) {
        [
          "Procesa_galaprodukta_Nr.",
          "Procesa_galaprodukta_Nr",
          "Procesa_galaprodukta_nr",
          "Galaproduktu_veida_Nr.",
          "Galaproduktu_veida_Nr",
        ].forEach((k) => { if (canUse(k)) out.push({ key: k, value: typeNo }); });
      }
      if (procNo) {
        [
          "Procesa_Nr.",
          "Procesa_Nr",
          "Procesa_numurs",
          "processNo",
        ].forEach((k) => { if (canUse(k)) out.push({ key: k, value: procNo }); });
      }
      if (type) {
        [
          "Procesa_galaprodukti",
          "Procesa galaprodukti",
          "Galaprodukta_veids",
          "Galaprodukta veids",
        ].forEach((k) => { if (canUse(k)) out.push({ key: k, value: type }); });
      }
      return out;
    }
    const key = current && current.key
      ? current.key
      : pickCatalogCol(
        [
          "Procesa_galaprodukta_Nr.",
          "Procesa_galaprodukta_Nr",
          "procesa_galaprodukta_nr",
          "Procesa_galaprodukta_nr",
          "Galaproduktu_veida_Nr.",
          "Galaproduktu_veida_Nr",
        ],
        "Procesa_galaprodukta_Nr."
      );
    const id = current ? current.id : null;
    let keys = Array.isArray(current && current.matchKeys)
      ? current.matchKeys.filter((k) => k && k.key && k.value !== undefined && k.value !== null && String(k.value) !== "")
      : [];
    if (!keys.length) keys = buildCatalogFallbackKeys(current);
    if (!keys.length) keys = buildCatalogFallbackKeys(row);
    if (!id && !keys.length) throw new Error("Nav kataloga primārās atslēgas.");

    const unitCandidates = [
      "Procesa_izpilditajs-patstaviga_strukturvieniba",
      "Procesa_izpilditajs_patstaviga_strukturvieniba",
      "Strukturvieniba_izpilditajs_kas_rada_galaprodukta_veidu",
    ];
    const deptCandidates = [
      "Daļa,_nodaļa",
      "Daļa_nodaļa",
      "Daļa, nodala",
      "Daļa, nodaļa",
      "Dala_nodala",
      "Dala,_nodala",
      "Dala, nodala",
      "Dala, nodaļa",
      "dala_nodala",
    ];
    const unitCol = pickCatalogCol(unitCandidates, "Procesa_izpilditajs-patstaviga_strukturvieniba");
    const deptCol = pickCatalogCol(deptCandidates, "Dala_nodala");
    const typeCol = pickCatalogCol(
      [
        "Procesa_galaprodukti",
        "procesa_galaprodukti",
        "Procesa galaprodukti",
        "Galaprodukta_veids",
        "galaprodukta_veids",
        "Galaprodukta veids",
      ],
      "Procesa_galaprodukti"
    );
    const processCol = pickCatalogCol(["Process", "process", "Procesi, kas nodrošina uzdevuma dzīves ciklu"], null);
    const groupCol = pickCatalogCol(["Procesa_grupa", "Procesu_grupa", "procesa_grupa", "procesu_grupa", "group"], null);
    const jomaCol = pickCatalogExistingCol(["Darbibas_joma", "darbibas_joma", "Darbības joma", "darbibasJoma", "Joma_piesaiste_galaproduktam"]);

    const payload = {
      [typeCol]: String(row.type || "").trim(),
      [unitCol]: String(row.unit || "").trim(),
      "Uzdevuma_Nr.": String(row.taskNo || "").trim(),
      "Procesa_Nr.": String(row.procNo || "").trim(),
      [deptCol]: String(row.department || "").trim(),
      "Papildu informācija": String(row.additionalInfo || "").trim(),
    };
    if (processCol) payload[processCol] = String(row.process || "").trim();
    if (groupCol) payload[groupCol] = String(row.group || "").trim();
    if (jomaCol) payload[jomaCol] = String(row.darbibasJoma || "").trim();
    if (!String(payload[typeCol] || "").trim()) {
      throw new Error("Galaprodukta veids ir obligāts.");
    }
    const result = await runWriteWithMissingColumnRetry(payload, (p) => {
      let q = supabaseClient
        .from(CATALOG_TABLE)
        .update(p);
      if (keys.length) {
        keys.forEach((mk) => {
          q = qeq(q, mk.key, mk.value);
        });
      } else {
        q = q.eq(pgCol(key), id);
      }
      return q;
    });
    emitSync("catalog", "html");
    return result.payload;
  }

  async function removeCatalog(current) {
    if (SINGLE_TABLE_MODE) {
      const processRows = await load();
      const procNo = String((current && current.procNo) || "").trim();
      const type = String((current && current.type) || "").trim();
      if (!type) throw new Error("Dzēšanai vajadzīgs galaprodukta nosaukums.");
      const target = findSingleTableTargetRow(processRows || [], procNo, type);
      if (!target) throw new Error("Nav atrasts process dzēšanai.");
      const tKey = nkey(type);
      const raw = (target && target.raw) || {};
      const typeNoCol = getProcessTypeNoColFromRaw(raw);
      const list0 = splitCatalogProducts(target.products);
      const nos0 = splitCatalogTypeNos(raw ? raw[typeNoCol] : "");
      while (nos0.length < list0.length) nos0.push("");
      const kept = [];
      for (let i = 0; i < list0.length; i += 1) {
        if (nkey(list0[i]) === tKey) continue;
        kept.push({ name: list0[i], no: String(nos0[i] || "").trim() });
      }
      const list = kept.map((x) => x.name);
      const nos = kept.map((x) => x.no);
      const payload = {
        group: target.group,
        taskNo: target.taskNo,
        task: target.task,
        processNo: target.processNo,
        process: target.process,
        darbibasJoma: target.darbibasJoma,
        owner: target.owner,
        products: joinCatalogProducts(list),
        [typeNoCol]: joinCatalogTypeNos(nos),
        productTypes: target.productTypes,
        input: target.input,
        relatedProcesses: target.relatedProcesses,
        services: target.services,
        flowcharts: target.flowcharts,
        itResources: target.itResources,
        optimization: target.optimization,
        executorPatstaviga: target.executorPatstaviga,
        executorDala: target.executorDala,
        otherMetrics: target.otherMetrics,
      };
      await update(target, payload);
      emitSync("catalog", "html");
      return true;
    }
    function buildCatalogFallbackKeys(src) {
      const s = src || {};
      const knownKeys = new Set(Object.keys((s && s.raw) || s || {}));
      const canUse = (k) => !knownKeys.size || knownKeys.has(k);
      const out = [];
      const typeNo = String(s.typeNo || s.id || "").trim();
      const procNo = String(s.procNo || "").trim();
      const type = String(s.type || "").trim();
      if (typeNo) {
        [
          "Procesa_galaprodukta_Nr.",
          "Procesa_galaprodukta_Nr",
          "Procesa_galaprodukta_nr",
          "Galaproduktu_veida_Nr.",
          "Galaproduktu_veida_Nr",
        ].forEach((k) => { if (canUse(k)) out.push({ key: k, value: typeNo }); });
      }
      if (procNo) {
        [
          "Procesa_Nr.",
          "Procesa_Nr",
          "Procesa_numurs",
          "processNo",
        ].forEach((k) => { if (canUse(k)) out.push({ key: k, value: procNo }); });
      }
      if (type) {
        [
          "Procesa_galaprodukti",
          "Procesa galaprodukti",
          "Galaprodukta_veids",
          "Galaprodukta veids",
        ].forEach((k) => { if (canUse(k)) out.push({ key: k, value: type }); });
      }
      return out;
    }
    const key = current && current.key
      ? current.key
      : pickCatalogCol(
        [
          "Procesa_galaprodukta_Nr.",
          "Procesa_galaprodukta_Nr",
          "procesa_galaprodukta_nr",
          "Procesa_galaprodukta_nr",
          "Galaproduktu_veida_Nr.",
          "Galaproduktu_veida_Nr",
        ],
        "Procesa_galaprodukta_Nr."
      );
    const id = current ? current.id : null;
    let keys = Array.isArray(current && current.matchKeys)
      ? current.matchKeys.filter((k) => k && k.key && k.value !== undefined && k.value !== null && String(k.value) !== "")
      : [];
    if (!keys.length) keys = buildCatalogFallbackKeys(current);
    if (!id && !keys.length) throw new Error("Nav kataloga primārās atslēgas dzēšanai.");
    let q = supabaseClient
      .from(CATALOG_TABLE)
      .delete();
    if (keys.length) {
      keys.forEach((mk) => {
        q = qeq(q, mk.key, mk.value);
      });
    } else {
      q = q.eq(pgCol(key), id);
    }
    const { error } = await q;
    if (error) throw error;
    emitSync("catalog", "html");
    return true;
  }

  /**
   * Supabase Storage — krātuve «Pieteikumu vesture».
   * Bucket **jāizveido** Supabase → Storage → New bucket (Name = id, piem. pieteikumu-vesture).
   * Citam id: pirms DB.js iestatiet window.PV_SUPABASE_STORAGE_BUCKET = "jusu-bucket-id";
   *
   * Mapes: pielikumi_uz_pieteikumiem/ , vesture/
   */
  const DEFAULT_STORAGE_BUCKET_PIETEIKUMI = "pieteikumu-vesture";

  function getPieteikumiStorageBucket() {
    try {
      const w = typeof window !== "undefined" ? window : null;
      if (w && w.PV_SUPABASE_STORAGE_BUCKET != null) {
        const s = String(w.PV_SUPABASE_STORAGE_BUCKET).trim();
        if (s) return s;
      }
    } catch (_) {}
    return DEFAULT_STORAGE_BUCKET_PIETEIKUMI;
  }

  const STORAGE_PREFIX_ATTACH = "pielikumi_uz_pieteikumiem";
  const STORAGE_PREFIX_VESTURE = "vesture";

  function sanitizeFileName(name) {
    return String(name || "file")
      .replace(/[^\w.\-\u0100-\u024F]/g, "_")
      .slice(0, 180);
  }

  async function uploadChangeRequestFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f && f.size > 0);
    if (!files.length) return [];
    const out = [];
    for (const file of files) {
      const safe = sanitizeFileName(file.name);
      const bucket = getPieteikumiStorageBucket();
      const path = `${STORAGE_PREFIX_ATTACH}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safe}`;
      const { error } = await supabaseClient.storage.from(bucket).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
        cacheControl: "3600",
      });
      if (error) throw error;
      const { data: pub } = supabaseClient.storage.from(bucket).getPublicUrl(path);
      out.push({ name: file.name, path, url: pub.publicUrl });
    }
    return out;
  }

  /**
   * Saglabā pilna pieteikuma tekstu + pielikumu metadatus JSON veidā krātuvē «Pieteikumu vesture».
   */
  async function savePieteikumuVestureSnapshot(bodyText, attachmentRecords, meta) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const path = `${STORAGE_PREFIX_VESTURE}/pieteikums_${id}.json`;
    const payload = JSON.stringify(
      {
        saglabatsUtc: new Date().toISOString(),
        meta: meta && typeof meta === "object" ? meta : {},
        pielikumi: Array.isArray(attachmentRecords) ? attachmentRecords : [],
        pieteikuma_teksts: String(bodyText || ""),
      },
      null,
      2
    );
    const bucket = getPieteikumiStorageBucket();
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const { error } = await supabaseClient.storage.from(bucket).upload(path, blob, {
      contentType: "application/json",
      upsert: false,
      cacheControl: "60",
    });
    if (error) throw error;
    const { data: pub } = supabaseClient.storage.from(bucket).getPublicUrl(path);
    return { path, publicUrl: pub.publicUrl, id };
  }

  function stopSync() {
    if (syncChannel) {
      try { supabaseClient.removeChannel(syncChannel); } catch (_) {}
      syncChannel = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startSync(opts) {
    const options = opts || {};
    const pollMs = Number(options.pollMs || 7000);
    stopSync();

    // Realtime DB -> HTML
    syncChannel = supabaseClient.channel("app-db-sync");
    syncChannel
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => emitSync("process", "db"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: CATALOG_TABLE },
        () => emitSync("catalog", "db")
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") emitSync("all", "db");
      });
    if (SINGLE_TABLE_MODE) {
      try { supabaseClient.removeChannel(syncChannel); } catch (_) {}
      syncChannel = supabaseClient.channel("app-db-sync");
      syncChannel
        .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, () => emitSync("all", "db"))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") emitSync("all", "db");
        });
    }

    // Fallback polling (ja realtime nav pieejams/RLS kanālu ierobežojumi)
    pollTimer = setInterval(() => {
      emitSync("all", "db");
    }, pollMs);
  }

  function getTaskNoCol() {
    if (dbCols && dbCols.size) {
      if (dbCols.has("Uzdevuma_Nr.")) return "Uzdevuma_Nr.";
      if (dbCols.has("uzdevuma_nr")) return "uzdevuma_nr";
      if (dbCols.has("Uzdevuma Nr.")) return "Uzdevuma Nr.";
      if (dbCols.has("taskNo")) return "taskNo";
    }
    return "Uzdevuma_Nr.";
  }

  function getTaskNameCol() {
    if (dbCols && dbCols.size) {
      if (dbCols.has("Uzdevums")) return "Uzdevums";
      if (dbCols.has("uzdevums")) return "uzdevums";
      if (dbCols.has("task")) return "task";
    }
    return "Uzdevums";
  }

  async function updateTaskByNo(oldTaskNo, updates) {
    const taskNoCol = getTaskNoCol();
    const taskNameCol = getTaskNameCol();
    const oldNo = String(oldTaskNo || "").trim();
    if (!oldNo) throw new Error("Uzdevuma Nr. (oldTaskNo) nav norādīts.");

    const payload = {};
    if (updates && updates.taskNo != null) payload[taskNoCol] = String(updates.taskNo || "").trim();
    if (updates && updates.task != null) payload[taskNameCol] = String(updates.task || "").trim();

    if (!Object.keys(payload).length) return null;

    let q = supabaseClient.from(TABLE).update(payload);
    q = qeq(q, taskNoCol, oldNo);

    const { data, error } = await q.select("*");
    if (error) throw error;
    emitSync("process", "html");
    return data;
  }

  async function removeTaskByNo(taskNo) {
    const taskNoCol = getTaskNoCol();
    const oldNo = String(taskNo || "").trim();
    if (!oldNo) throw new Error("Uzdevuma Nr. nav norādīts.");

    let q = supabaseClient.from(TABLE).delete();
    q = qeq(q, taskNoCol, oldNo);

    const { data, error } = await q.select("*");
    if (error) throw error;
    emitSync("process", "html");
    return data;
  }

  async function updateProcessJomaByProcessNo(processNo, darbibasJoma) {
    const procNo = String(processNo || "").trim();
    if (!procNo) throw new Error("Procesa Nr. nav norādīts.");
    const joma = String(darbibasJoma || "").trim();
    if (!dbCols || !dbCols.size) {
      try { await load(); } catch (_) {}
    }
    const procNoCol =
      (dbCols && dbCols.has("Procesa_numurs")) ? "Procesa_numurs" :
      (dbCols && dbCols.has("procesa_numurs")) ? "procesa_numurs" :
      (dbCols && dbCols.has("Procesa_Nr.")) ? "Procesa_Nr." :
      (dbCols && dbCols.has("procesa_nr")) ? "procesa_nr" :
      (dbCols && dbCols.has("processNo")) ? "processNo" :
      "Procesa_Nr.";
    const jomaCol =
      (dbCols && dbCols.has("Darbibas_joma")) ? "Darbibas_joma" :
      (dbCols && dbCols.has("darbibas_joma")) ? "darbibas_joma" :
      (dbCols && dbCols.has("Darbības joma")) ? "Darbības joma" :
      (dbCols && dbCols.has("darbibasJoma")) ? "darbibasJoma" :
      "Darbibas_joma";
    let q = supabaseClient.from(TABLE).update({ [jomaCol]: joma });
    q = qeq(q, procNoCol, procNo);
    const { error } = await q;
    if (error) throw error;
    emitSync("process", "html");
    return true;
  }
  async function updateProcessNoBulk(oldProcessNo, processName, newProcessNo) {
    if (!dbCols || !dbCols.size) {
      try { await load(); } catch (_) {}
    }
    const oldNo = String(oldProcessNo || "").trim();
    const newNo = String(newProcessNo || "").trim();
    const pName = String(processName || "").trim();
    const procNoCol =
      (dbCols && dbCols.has("Procesa_numurs")) ? "Procesa_numurs" :
      (dbCols && dbCols.has("procesa_numurs")) ? "procesa_numurs" :
      (dbCols && dbCols.has("Procesa_Nr.")) ? "Procesa_Nr." :
      (dbCols && dbCols.has("procesa_nr")) ? "procesa_nr" :
      (dbCols && dbCols.has("processNo")) ? "processNo" :
      "Procesa_Nr.";
    const processCol =
      (dbCols && dbCols.has("Process")) ? "Process" :
      (dbCols && dbCols.has("Procesi, kas nodrošina uzdevuma dzīves ciklu")) ? "Procesi, kas nodrošina uzdevuma dzīves ciklu" :
      "Process";
    let changed = false;
    if (oldNo) {
      let q = supabaseClient.from(TABLE).update({ [procNoCol]: newNo });
      q = qeq(q, procNoCol, oldNo);
      const { error } = await q;
      if (error) throw error;
      changed = true;
    }
    if (!changed && pName) {
      let q = supabaseClient.from(TABLE).update({ [procNoCol]: newNo });
      q = qeq(q, processCol, pName);
      const { error } = await q;
      if (error) throw error;
      changed = true;
    }
    emitSync("process", "html");
    return true;
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
    updateTaskByNo,
    removeTaskByNo,
    updateProcessJomaByProcessNo,
    updateProcessNoBulk,
    startSync,
    stopSync,
    mapDbError,
    uploadChangeRequestFiles,
    savePieteikumuVestureSnapshot,
    getPieteikumiStorageBucket,
    get STORAGE_BUCKET_PIETEIKUMI() {
      return getPieteikumiStorageBucket();
    },
    get STORAGE_BUCKET_CHANGE_REQ() {
      return getPieteikumiStorageBucket();
    },
    STORAGE_PREFIX_ATTACH,
    STORAGE_PREFIX_VESTURE,
  };
})();




