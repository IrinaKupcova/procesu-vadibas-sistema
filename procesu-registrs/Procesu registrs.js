(function () {
  "use strict";

  /** Datu korektūra procesu reģistra tabulai: visas DB `procesu_registrs` rindas ar GP → viena apvienota karte, GP rindas zemāk, joma no attiecīgās DB rindas, pārvaldes viena rinda ar komatiem. */

  function normTextKey(v) {
    return String(v || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function sanitizeGpName(v) {
    let s = String(v || "").trim();
    s = s.replace(/^\[object\s+[^\]]+\]\s*/i, "").trim();
    if (!s) return "";
    if (s.length > 180) return "";
    return s;
  }

  function splitProductValues(v) {
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

  function splitTypeNoValues(v) {
    return String(v || "")
      .split(/[;,\n]/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function rowProcessKey(r) {
    const procNo = String((r && r.processNo) || "").trim();
    const proc = String((r && r.process) || "").trim();
    return normTextKey(proc || procNo);
  }

  function mergedRowKey(m) {
    return normTextKey(String((m && m.process) || "").trim() || String((m && m.processNo) || "").trim());
  }

  function gpTypeNosFromRaw(r) {
    const raw = (r && r.raw) || {};
    const gpTypeNoRaw = String(
      raw["Procesa_galaprodukta_Nr."] ||
        raw["Procesa_galaprodukta_Nr"] ||
        raw["procesa_galaprodukta_nr"] ||
        raw["Procesa_galaprodukta_nr"] ||
        ""
    ).trim();
    return splitTypeNoValues(gpTypeNoRaw);
  }

  function collectExecutorsFromRawList(list) {
    const seen = new Set();
    const out = [];
    (list || []).forEach((r) => {
      String((r && r.executorPatstaviga) || "")
        .split(/[,\n;]+/)
        .map((x) => String(x || "").replace(/\.+$/g, "").trim())
        .filter(Boolean)
        .forEach((unit) => {
          const low = unit.toLowerCase();
          if (seen.has(low)) return;
          seen.add(low);
          out.push(unit);
        });
    });
    return out.join(", ");
  }

  function buildGpItemsFromRawRows(rawList) {
    const gpItems = [];
    (rawList || []).forEach((r) => {
      const joma = String((r && r.darbibasJoma) || "").trim();
      const productsField = (r && r.products) != null ? r.products : "";
      const tokens = splitProductValues(productsField).map(sanitizeGpName).filter(Boolean);
      const typeNos = gpTypeNosFromRaw(r);
      const procNo = String((r && r.processNo) || "").trim();
      tokens.forEach((name, idx) => {
        gpItems.push({
          name,
          typeNosText: String(typeNos[idx] || "").trim(),
          jomaText: joma,
          executorText: "",
          procNo,
        });
      });
    });
    return gpItems;
  }

  /**
   * @param {Array} mergedRows — buildProcessRegisterRows rezultāts
   * @param {Array} rawRows — processRows no DB (getProcessRows slice)
   */
  function applyProcessRegisterDataPatch(mergedRows, rawRows) {
    if (!Array.isArray(mergedRows) || !Array.isArray(rawRows)) return mergedRows || [];

    const rawByKey = new Map();
    rawRows.forEach((r) => {
      const k = rowProcessKey(r);
      if (!k) return;
      if (!rawByKey.has(k)) rawByKey.set(k, []);
      rawByKey.get(k).push(r);
    });

    const uniqProc = new Set();
    rawRows.forEach((r) => {
      const k = rowProcessKey(r);
      if (k) uniqProc.add(k);
    });
    const nUniq = uniqProc.size;
    if (nUniq !== 50) {
      console.warn("[Procesu registrs] Unikālo procesu (atslēga pēc Process / Procesa Nr.) skaits:", nUniq, "(pārbaudes kritērijs: 50).");
    }

    const patched = mergedRows.map((m) => {
      const k = mergedRowKey(m);
      const list = k ? rawByKey.get(k) : null;
      if (!list || !list.length) return m;

      const gpItems = buildGpItemsFromRawRows(list);
      const combinedExec = collectExecutorsFromRawList(list);
      if (gpItems.length) {
        gpItems[0].executorText = combinedExec;
      }

      const productsText = gpItems.length ? gpItems.map((g) => g.name).filter(Boolean).join("\n") : String(m.productsText || "");
      const jomaParts = gpItems.map((g) => String(g.jomaText || "").trim()).filter(Boolean);
      const jomaSearchText = [m.jomaSearchText, ...jomaParts].filter(Boolean).join(" ").trim();

      return Object.assign({}, m, {
        gpItems,
        productsText,
        productTypes: productsText ? productsText.replace(/\n/g, "; ") : String(m.productTypes || ""),
        executorPatstaviga: combinedExec,
        jomaSearchText,
      });
    });

    return patched;
  }

  window.applyProcessRegisterDataPatch = applyProcessRegisterDataPatch;

  const $ = (id) => document.getElementById(id);

  function moveControlsToRegistry() {
    const row = $("searchInput") ? $("searchInput").parentElement : null;
    const processRight = $("processListCard") ? $("processListCard").querySelector(".toolbar .right") : null;
    if (!row || !processRight) return;

    const levelSelect = $("levelSelect");
    const levelWrap =
      levelSelect &&
      (levelSelect.closest(".toolbar-inline-control") || levelSelect.closest("label"));
    if (levelWrap && !processRight.contains(levelWrap)) processRight.prepend(levelWrap);

    const newBtn = $("newBtn");
    if (newBtn && !processRight.contains(newBtn)) processRight.appendChild(newBtn);
  }

  function getFieldText(tr, mode) {
    const tds = Array.from(tr.children);
    if (mode === "task") return `${tds[1]?.textContent || ""} ${tds[2]?.textContent || ""}`;
    if (mode === "owner") return `${tds[5]?.textContent || ""}`;
    if (mode === "output") return `${tds[8]?.textContent || ""}`;
    return `${tds[3]?.textContent || ""} ${tds[4]?.textContent || ""}`;
  }

  function applyMainSearchByView() {
    const table = $("processTable");
    const input = $("searchInput");
    const select = $("viewFilterSelect");
    if (!table || !input || !select) return;

    const q = String(input.value || "").trim().toLowerCase();
    if (!q) return;
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach((tr) => {
      const text = getFieldText(tr, select.value).toLowerCase();
      tr.style.display = text.includes(q) ? "" : "none";
    });
  }

  function setup() {
    moveControlsToRegistry();

    const searchInput = $("searchInput");
    const viewSelect = $("viewFilterSelect");
    if (searchInput) searchInput.addEventListener("input", applyMainSearchByView);
    if (viewSelect) viewSelect.addEventListener("change", applyMainSearchByView);

    const originalRender = window.renderTable;
    if (typeof originalRender === "function" && !window.__procRegHooked) {
      window.renderTable = function () {
        originalRender();
        applyMainSearchByView();
      };
      window.__procRegHooked = true;
    }

    window.renderExtraViews = function () {};
  }

  function boot() {
    if (!$("processListCard")) {
      setTimeout(boot, 200);
      return;
    }
    setup();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
