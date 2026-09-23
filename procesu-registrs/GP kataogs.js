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

  /** GP numurs kārtošanai (ņem no typeNo vai raw kolonnas). */
  function typeNoOf(row) {
    if (!row) return "";
    let v = String(row.typeNo || "").trim();
    if (!v) v = String(gpTypeNosFromRawRow(row)[0] || "").trim();
    return v;
  }

  /** Kārto GP pēc numura augošā secībā (naturāli); tukši numuri — beigās. */
  function sortByTypeNoAsc(list) {
    if (!Array.isArray(list)) return list;
    return list.slice().sort((a, b) => {
      const ka = typeNoOf(a);
      const kb = typeNoOf(b);
      if (!ka && !kb) return 0;
      if (!ka) return 1;
      if (!kb) return -1;
      return ka.localeCompare(kb, undefined, { numeric: true, sensitivity: "base" });
    });
  }

  function readGpMetaMapFromRaw(raw) {
    const keys = ["GP_kartinas_papildu_JSON", "gp_kartinas_papildu_json", "GP_kartinas_metadata_JSON"];
    for (const k of keys) {
      if (!raw || raw[k] == null || raw[k] === "") continue;
      const v = raw[k];
      if (typeof v === "object" && !Array.isArray(v)) return v;
      try {
        const o = JSON.parse(String(v));
        if (o && typeof o === "object" && !Array.isArray(o)) return o;
      } catch (_) {}
    }
    return {};
  }

  function gpMetaSlot(raw, gpName) {
    const map = readGpMetaMapFromRaw(raw || {});
    return (map[norm(gpName)] && typeof map[norm(gpName)] === "object") ? map[norm(gpName)] : {};
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
      const raw = (r && r.raw) || {};
      const metaMap = readGpMetaMapFromRaw(raw);
      const procUnitFallback =
        String((r && r.executorPatstaviga) || "").trim() &&
        !/[;,]/.test(String((r && r.executorPatstaviga) || ""))
          ? String((r && r.executorPatstaviga) || "").trim()
          : "";
      const gpNames = splitList((r && r.products) || "");
      const typeNos = gpTypeNosFromRawRow(r);

      gpNames.forEach((gpName, idx) => {
        const gp = String(gpName || "").trim();
        if (!gp) return;
        const typeNo = String(typeNos[idx] || "").trim();
        const slot = metaMap[norm(gp)] || {};
        const unit = String(slot.unit != null ? slot.unit : "").trim();
        const department = String(slot.department != null ? slot.department : "").trim();
        const gpJoma = String(slot.darbibasJoma != null ? slot.darbibasJoma : "").trim();
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
            darbibasJoma: gpJoma,
            additionalInfo: String(slot.additionalInfo != null ? slot.additionalInfo : ""),
            cardAttachments: Array.isArray(slot.cardAttachments) ? slot.cardAttachments : [],
            __unitSet: new Set(),
            __departmentSet: new Set(),
            __jomaSet: new Set(),
          });
        }
        const card = cardByProcGp.get(cardKey);
        if (unit) card.__unitSet.add(unit);
        const sig = `${procNo}|${norm(gp)}|${norm(unit)}|${norm(department)}|${norm(gpJoma || joma)}|${typeNo}`;
        if (!rowSig.has(sig)) {
          rowSig.add(sig);
          detailed.push({
            typeNo,
            type: gp,
            unit,
            department,
            procNo,
            process,
            group,
            darbibasJoma: gpJoma,
            additionalInfo: String(slot.additionalInfo != null ? slot.additionalInfo : ""),
            __cardKey: cardKey,
          });
        }
        if (department) card.__departmentSet.add(department);
        if (gpJoma) card.__jomaSet.add(gpJoma);
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
      const fromDb = await originalLoadCatalogTypes();
      if (Array.isArray(fromDb) && fromDb.length) return sortByTypeNoAsc(fromDb);
      const derived = buildCatalogFromProcessRows(processRows);
      if (derived.length) return sortByTypeNoAsc(derived);
      return sortByTypeNoAsc(fromDb || []);
    };
    window.__gpCatalogBridgeInstalled = true;
    return true;
  }

  function boot() {
    ensureToolbar();
    initGpKartinaUi();
  }

  /* —— GP kartiņa: virsraksts, joma §2, atbildīgās struktūrvienības §3 —— */

  function gp$(id) {
    return document.getElementById(id);
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function splitResponsibleParts(v) {
    return String(v || "")
      .split(/[,;\n]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function rowsFromUnitDepartmentFields() {
    const units = splitResponsibleParts(gp$("cUnit") && gp$("cUnit").value);
    const depts = splitResponsibleParts(gp$("cDepartment") && gp$("cDepartment").value);
    const n = Math.max(units.length, depts.length, 1);
    const rows = [];
    for (let i = 0; i < n; i++) {
      rows.push({ unit: units[i] || "", department: depts[i] || "" });
    }
    return rows;
  }

  function syncResponsibleHiddenFields(rows) {
    const unitEl = gp$("cUnit");
    const deptEl = gp$("cDepartment");
    const list = Array.isArray(rows) ? rows : [];
    if (unitEl) {
      unitEl.value = list
        .map((r) => String(r.unit || "").trim())
        .filter(Boolean)
        .join(", ");
    }
    if (deptEl) {
      deptEl.value = list
        .map((r) => String(r.department || "").trim())
        .filter(Boolean)
        .join(", ");
    }
  }

  function catalogFormEditable() {
    const typeEl = gp$("cType");
    if (!typeEl) return true;
    if (typeEl.disabled) return false;
    if (typeof window.canEditGp === "function") return window.canEditGp();
    if (typeof window.canEdit === "function") return window.canEdit();
    return true;
  }

  function renderGpResponsibleRows() {
    const root = gp$("cGpResponsibleRoot");
    if (!root) return;
    const editable = catalogFormEditable();
    const rows = rowsFromUnitDepartmentFields();

    let html = `<div class="gp-resp-head"><span>Pārvalde</span><span>Daļa / amats</span><span></span></div>`;
    rows.forEach((row, idx) => {
      html += `<div class="gp-resp-row" data-idx="${idx}">
        <input type="text" class="gp-resp-unit" value="${escHtml(row.unit)}" placeholder="Pārvalde" ${editable ? "" : "disabled"} />
        <input type="text" class="gp-resp-dept" value="${escHtml(row.department)}" placeholder="Daļa / amats" ${editable ? "" : "disabled"} />
        <button type="button" class="secondary gp-resp-del" title="Noņemt rindu" ${editable ? "" : "disabled"}>✕</button>
      </div>`;
    });
    html += `<button type="button" class="secondary gp-resp-add" style="margin-top:8px" ${editable ? "" : "disabled"}>+ Pievienot pārvaldi / amatu</button>`;
    root.innerHTML = html;

    root.querySelectorAll(".gp-resp-unit, .gp-resp-dept").forEach((inp) => {
      inp.addEventListener("input", () => {
        syncResponsibleHiddenFields(collectResponsibleRowsFromDom(root));
      });
    });
    root.querySelectorAll(".gp-resp-del").forEach((btn) => {
      btn.onclick = () => {
        const rowEl = btn.closest(".gp-resp-row");
        if (!rowEl || !rowEl.parentNode) return;
        const left = root.querySelectorAll(".gp-resp-row");
        if (left.length <= 1) {
          rowEl.querySelector(".gp-resp-unit").value = "";
          rowEl.querySelector(".gp-resp-dept").value = "";
        } else {
          rowEl.remove();
        }
        syncResponsibleHiddenFields(collectResponsibleRowsFromDom(root));
      };
    });
    const addBtn = root.querySelector(".gp-resp-add");
    if (addBtn) {
      addBtn.onclick = () => {
        const current = collectResponsibleRowsFromDom(root);
        current.push({ unit: "", department: "" });
        syncResponsibleHiddenFields(current);
        renderGpResponsibleRows();
        const inputs = root.querySelectorAll(".gp-resp-unit");
        const last = inputs[inputs.length - 1];
        if (last) last.focus();
      };
    }
  }

  function collectResponsibleRowsFromDom(root) {
    const out = [];
    (root || gp$("cGpResponsibleRoot"))
      ?.querySelectorAll(".gp-resp-row")
      .forEach((row) => {
        out.push({
          unit: String(row.querySelector(".gp-resp-unit")?.value || "").trim(),
          department: String(row.querySelector(".gp-resp-dept")?.value || "").trim(),
        });
      });
    return out.length ? out : [{ unit: "", department: "" }];
  }

  let gpTitleUpdateLock = false;

  function updateCatalogEditorTitle() {
    const title = gp$("catalogEditorTitle");
    const gpName = String(gp$("cType")?.value || "").trim();
    if (!title) return;
    gpTitleUpdateLock = true;
    try {
      if (gpName) {
        title.innerHTML =
          `Galaprodukta kartiņa — <span style="color:#1d4ed8;font-weight:700">${escHtml(gpName)}</span>`;
      } else {
        title.textContent = "Galaprodukta kartiņa (jauns)";
      }
    } finally {
      gpTitleUpdateLock = false;
    }
  }

  function ensureGpKartinaStyles() {
    if (document.getElementById("gp-kartina-ui-styles")) return;
    const s = document.createElement("style");
    s.id = "gp-kartina-ui-styles";
    s.textContent = `
      #cGpResponsibleRoot .gp-resp-head,
      #cGpResponsibleRoot .gp-resp-row {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 8px;
        align-items: center;
        margin-bottom: 6px;
      }
      #cGpResponsibleRoot .gp-resp-head {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      #cGpResponsibleRoot .gp-resp-head span:last-child { width: 36px; }
      #cGpResponsibleRoot .gp-resp-del { min-width: 36px; padding: 6px 8px; }
      #cGpResponsibleRoot input[disabled] { background: #f1f5f9; }
      #catalogEditorForm .gp-pamat-one-row {
        display: grid;
        grid-template-columns: minmax(108px, 132px) minmax(160px, 2fr) minmax(160px, 1.4fr);
        gap: 12px;
        align-items: end;
        overflow-x: auto;
      }
      #catalogEditorForm .gp-pamat-one-row .form-group {
        margin: 0;
        min-width: 0;
      }
      #catalogEditorForm .gp-pamat-one-row label {
        display: block;
        min-height: 2.45em;
        margin: 0 0 3px;
        line-height: 1.25;
        font-size: 12px;
        font-weight: 600;
        text-transform: none;
        letter-spacing: 0.03em;
        color: #334155;
      }
      #catalogEditorForm .gp-pamat-one-row .gp-pamat-control {
        width: 100%;
        box-sizing: border-box;
        min-height: 32px;
        padding: 6px 8px;
        line-height: 1.35;
        font-size: 13px;
        font-family: inherit;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
      }
      #catalogEditorForm .gp-pamat-one-row #cTypeNo.gp-pamat-control {
        min-height: 32px;
      }
      #catalogEditorForm #cType.gp-type-multiline {
        min-height: 32px;
        max-height: 12em;
        resize: vertical;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-y: hidden;
      }
      #catalogEditorForm .gp-pamat-one-row select#cDarbibasJoma.gp-pamat-control {
        min-height: 32px;
      }
    `;
    document.head.appendChild(s);
  }

  function fitGpNameTextareaHeight(ta) {
    if (!ta || ta.tagName !== "TEXTAREA") return;
    ta.style.height = "32px";
    const next = Math.min(Math.max(32, ta.scrollHeight + 2), 320);
    ta.style.height = next + "px";
  }

  function markGpPamatControls() {
    const typeNo = gp$("cTypeNo");
    const type = gp$("cType");
    const joma = gp$("cDarbibasJoma");
    if (typeNo) typeNo.classList.add("gp-pamat-control");
    if (type) type.classList.add("gp-pamat-control");
    if (joma) joma.classList.add("gp-pamat-control");
  }

  function ensureGpNameMultilineField() {
    let el = gp$("cType");
    if (!el) return null;
    if (el.tagName !== "TEXTAREA") {
      const ta = document.createElement("textarea");
      ta.id = el.id;
      ta.className = (el.className || "") + " gp-type-multiline gp-pamat-control";
      ta.value = el.value;
      if (el.placeholder) ta.placeholder = el.placeholder;
      ta.rows = 1;
      ta.disabled = !!el.disabled;
      el.parentNode.replaceChild(ta, el);
      el = ta;
    } else {
      el.classList.add("gp-type-multiline", "gp-pamat-control");
    }
    if (!el.dataset.gpTitleSync) {
      el.dataset.gpTitleSync = "1";
      el.addEventListener("input", () => {
        updateCatalogEditorTitle();
        fitGpNameTextareaHeight(el);
      });
      el.addEventListener("change", updateCatalogEditorTitle);
    }
    fitGpNameTextareaHeight(el);
    return el;
  }

  function layoutGpPamatOneRow(sec2) {
    if (!sec2) return;
    const jomaEl = gp$("cDarbibasJoma");
    const jomaGroup = jomaEl ? jomaEl.closest(".form-group") : null;
    if (jomaGroup && !sec2.contains(jomaGroup)) {
      const jomaLabel = jomaGroup.querySelector("label");
      if (jomaLabel) jomaLabel.textContent = "Galaprodukta joma";
    }
    if (jomaGroup) jomaGroup.classList.add("form-group--gp-joma");

    const typeNoGroup = gp$("cTypeNo") ? gp$("cTypeNo").closest(".form-group") : null;
    const typeGroup = gp$("cType") ? gp$("cType").closest(".form-group") : null;
    if (typeGroup) typeGroup.classList.add("form-group--gp-name");

    let row = sec2.querySelector(".gp-pamat-one-row");
    if (!row) {
      row = document.createElement("div");
      row.className = "form-row gp-pamat-one-row";
      sec2.appendChild(row);
    }
    sec2.querySelectorAll(":scope > .form-row").forEach((r) => {
      if (r === row) return;
      r.querySelectorAll(".form-group").forEach((g) => row.appendChild(g));
      r.remove();
    });
    [typeNoGroup, typeGroup, jomaGroup].filter(Boolean).forEach((g) => {
      if (g.parentNode !== row) row.appendChild(g);
    });
  }

  function ensureGpKartinaStructureOnce() {
    if (window.__gpKartinaStructureDone) return;
    const form = gp$("catalogEditorForm");
    if (!form) return;
    const sections = form.querySelectorAll(":scope > .editor-section");
    if (sections.length < 3) return;

    const sec3 = gp$("cGpResponsibleSection") || sections[2];
    const sec3Title = sec3.querySelector(".editor-section-title");
    if (sec3Title) {
      sec3Title.textContent =
        "3. Struktūrvienība/ amats, kas atbild par galaprodukta radīšanu";
    }
    sec3.querySelectorAll(":scope > .form-row").forEach((r) => r.remove());

    const unitEl = gp$("cUnit");
    const deptEl = gp$("cDepartment");
    if (unitEl) unitEl.type = "hidden";
    if (deptEl) deptEl.type = "hidden";

    let root = gp$("cGpResponsibleRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "cGpResponsibleRoot";
      sec3.appendChild(root);
    }

    ensureGpNameMultilineField();
    window.__gpKartinaStructureDone = true;
  }

  function refreshGpKartinaUi() {
    const form = gp$("catalogEditorForm");
    if (!form) return;
    const sections = form.querySelectorAll(":scope > .editor-section");
    if (sections.length < 2) return;
    ensureGpKartinaStructureOnce();
    const pamatSec =
      gp$("cGpPamatSection") ||
      (sections[0] && sections[0].querySelector(".gp-pamat-one-row") ? sections[0] : null) ||
      sections[0];
    layoutGpPamatOneRow(pamatSec);
    markGpPamatControls();
    ensureGpNameMultilineField();
    fitGpNameTextareaHeight(gp$("cType"));
    patchCatalogEditorTitleFromLegacy();
    updateCatalogEditorTitle();
    renderGpResponsibleRows();
  }

  function patchCatalogEditorTitleFromLegacy() {
    if (gpTitleUpdateLock) return;
    const title = gp$("catalogEditorTitle");
    if (!title) return;
    const raw = title.textContent || "";
    if (/Galaprodukta kartiņa —/.test(raw)) return;
    if (/rediģēt/i.test(raw)) {
      updateCatalogEditorTitle();
    }
  }

  function wireGpKartinaFormHooks() {
    const form = gp$("catalogEditorForm");
    if (!form || form.dataset.gpKartinaHooks) return;
    form.dataset.gpKartinaHooks = "1";
    form.addEventListener(
      "submit",
      () => {
        const root = gp$("cGpResponsibleRoot");
        if (root) syncResponsibleHiddenFields(collectResponsibleRowsFromDom(root));
      },
      true
    );
  }

  function observeGpCatalogEditorCard() {
    const card = gp$("catalogEditorCard");
    if (!card || card.dataset.gpKartinaObs) return;
    card.dataset.gpKartinaObs = "1";
    let refreshTimer = null;
    const scheduleRefresh = () => {
      if (card.classList.contains("hidden")) return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        refreshGpKartinaUi();
      }, 0);
    };
    let wasHidden = card.classList.contains("hidden");
    const obs = new MutationObserver(() => {
      const hidden = card.classList.contains("hidden");
      if (wasHidden && !hidden) scheduleRefresh();
      wasHidden = hidden;
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function wireGpNameTitleSync() {
    const typeEl = gp$("cType");
    if (!typeEl || typeEl.dataset.gpTitleSync) return;
    typeEl.dataset.gpTitleSync = "1";
    typeEl.addEventListener("input", updateCatalogEditorTitle);
    typeEl.addEventListener("change", updateCatalogEditorTitle);
  }

  window.updateGpCatalogEditorTitle = updateCatalogEditorTitle;
  window.refreshGpKartinaUi = refreshGpKartinaUi;

  function initGpKartinaUi() {
    ensureGpKartinaStyles();
    ensureGpKartinaStructureOnce();
    wireGpKartinaFormHooks();
    observeGpCatalogEditorCard();
    wireGpNameTitleSync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

