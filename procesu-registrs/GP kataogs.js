/**
 * Galaproduktu veidu kataloga paplašinātais skats (līdzīgi kā procesu reģistra līmeņi):
 * — «Pamatskats» — standarta kolonnas;
 * — «Paplašinātais skats» — papildu kolonna «Sensitīvitātes pakāpe» (korupcijas risku sasaiste).
 *
 * Sensitīvitātes vērtības glabājas localStorage (atslēga: Galaprodukta veida Nr.), ja DB kolonna
 * nav pieejama; ja DB atgriež lauku Sensitivitates_pakape, tas tiek izmantots, kad lokālais ir tukšs.
 */
(function () {
  "use strict";

  const STORAGE_SENS = "pv_gp_sensitivity_v1";

  function loadSensMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SENS) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveSensMap(m) {
    try {
      localStorage.setItem(STORAGE_SENS, JSON.stringify(m));
    } catch (_) {}
  }

  window.mergeCatalogSensitivity = function (row) {
    if (!row || typeof row !== "object") return row;
    const m = loadSensMap();
    const k = String(row.typeNo || row.id || "").trim();
    const fromDb = String(row.sensitivity || "").trim();
    const fromLoc = k ? String(m[k] || "").trim() : "";
    row.sensitivity = fromLoc || fromDb || "";
    return row;
  };

  window.persistCatalogSensitivity = function (typeNo, value) {
    const k = String(typeNo || "").trim();
    if (!k) return;
    const m = loadSensMap();
    const v = String(value || "").trim();
    if (v) m[k] = v;
    else delete m[k];
    saveSensMap(m);
  };

  window.removeCatalogSensitivity = function (typeNo) {
    const k = String(typeNo || "").trim();
    if (!k) return;
    const m = loadSensMap();
    delete m[k];
    saveSensMap(m);
  };

  window.applyGpCatalogView = function () {
    const table = document.getElementById("catalogTable");
    if (!table) return;
    // Vienots kataloga skats: vienmēr redzams pilnais skats.
    table.classList.add("catalog-view--expanded");
    table.classList.remove("catalog-view--compact");
  };

  function ensureToolbar() {
    // Skata pārslēdzējs vairs netiek rādīts.
    window.applyGpCatalogView();
  }

  function norm(v) {
    return String(v || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function splitList(v) {
    return String(v || "")
      .split(/[;\n]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function splitUnits(v) {
    return String(v || "")
      .split(/[,\n;]+/)
      .map((x) => String(x || "").replace(/\.+$/g, "").trim())
      .filter(Boolean);
  }

  function splitTypeNos(v) {
    return String(v || "")
      .split(/[;,\n]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function gpTypeNosFromRawRow(r) {
    const raw = (r && r.raw) || {};
    return splitTypeNos(
      String(
        raw["Procesa_galaprodukta_Nr."] ||
          raw["Procesa_galaprodukta_Nr"] ||
          raw["procesa_galaprodukta_nr"] ||
          raw["Procesa_galaprodukta_nr"] ||
          ""
      )
    );
  }

  function buildCatalogFromProcessRows(rows) {
    const detailed = [];
    const cardByProcGp = new Map();
    const rowSig = new Set();

    (rows || []).forEach((r) => {
      const procNo = String((r && r.processNo) || "").trim();
      if (!procNo) return;
      const process = String((r && r.process) || "").trim();
      const group = String((r && r.group) || "").trim();
      const joma = String((r && r.darbibasJoma) || "").trim();
      const department = String((r && r.executorDala) || "").trim();
      const units = splitUnits((r && r.executorPatstaviga) || "");
      const unitList = units.length ? units : [String((r && r.executorPatstaviga) || "").trim()];
      const gpNames = splitList((r && r.products) || "");
      const typeNos = gpTypeNosFromRawRow(r);

      gpNames.forEach((gpName, idx) => {
        const gp = String(gpName || "").trim();
        if (!gp) return;
        const typeNo = String(typeNos[idx] || "").trim();
        const cardKey = `${procNo}|${norm(gp)}`;
        if (!cardByProcGp.has(cardKey)) {
          cardByProcGp.set(cardKey, {
            typeNo,
            type: gp,
            unit: "",
            department: "",
            procNo,
            process,
            group,
            darbibasJoma: joma,
            additionalInfo: "",
            __unitSet: new Set(),
            __departmentSet: new Set(),
            __jomaSet: new Set(),
          });
        }
        const card = cardByProcGp.get(cardKey);
        unitList.forEach((u) => {
          if (u) card.__unitSet.add(u);
          const sig = `${procNo}|${norm(gp)}|${norm(u)}|${norm(department)}|${norm(joma)}|${typeNo}`;
          if (rowSig.has(sig)) return;
          rowSig.add(sig);
          detailed.push({
            typeNo,
            type: gp,
            unit: u,
            department,
            procNo,
            process,
            group,
            darbibasJoma: joma,
            additionalInfo: "",
            __cardKey: cardKey,
          });
        });
        if (department) card.__departmentSet.add(department);
        if (joma) card.__jomaSet.add(joma);
      });
    });

    detailed.forEach((d) => {
      const c = cardByProcGp.get(d.__cardKey);
      if (!c) return;
      c.unit = Array.from(c.__unitSet).join(", ");
      c.department = Array.from(c.__departmentSet).join(", ");
      c.darbibasJoma = Array.from(c.__jomaSet).join(", ");
      delete c.__unitSet;
      delete c.__departmentSet;
      delete c.__jomaSet;
      d.__catalogSourceRow = c;
    });
    return detailed;
  }

  function installCatalogDataBridge() {
    if (!window.DB || typeof window.DB.loadCatalogTypes !== "function") return false;
    if (window.__gpCatalogBridgeInstalled) return true;
    const originalLoadCatalogTypes = window.DB.loadCatalogTypes.bind(window.DB);
    window.DB.loadCatalogTypes = async function () {
      let processRows = [];
      if (typeof window.getProcessRows === "function") {
        processRows = window.getProcessRows() || [];
      }
      if (!Array.isArray(processRows) || !processRows.length) {
        if (typeof window.DB.load === "function") {
          try {
            processRows = await window.DB.load();
          } catch (_) {
            processRows = [];
          }
        }
      }
      const derived = buildCatalogFromProcessRows(processRows);
      if (derived.length) return derived;
      // Fallback only if process-based derivation is unavailable.
      return originalLoadCatalogTypes();
    };
    window.__gpCatalogBridgeInstalled = true;
    return true;
  }

  function boot() {
    ensureToolbar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

