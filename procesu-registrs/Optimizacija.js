/**
 * Optimizācija — pasākumu saraksts, CRUD, aktuālie / neaktuālie (pabeigtie, atceltie).
 */
(function () {
  "use strict";

  const CARD_ID = "optimizacijaCard";
  const LIST_ID = "optimizacijaListRoot";
  const STATUS_ID = "optimizacijaStatus";
  const MODAL_ID = "optimizacijaEditorModal";
  const FORM_ID = "optimizacijaEditorForm";
  const FORM_VERSION = "5";
  const BULK_BTN_ID = "optimizacijaBulkCardsBtn";

  const STATUS = {
    nav_uzsakts: { label: "Nav uzsākts", cls: "opt-st-not-started" },
    izpilde: { label: "Izpildē", cls: "opt-st-in-progress" },
    pabeigts: { label: "Pabeigts", cls: "opt-st-done" },
    atcelts: { label: "Atcelts", cls: "opt-st-cancelled" },
  };

  let dbRows = [];
  let dbWarning = "";
  const procCardOpen = new Set();
  const measureCardOpen = new Set();
  let cachedActiveGroups = [];
  let cachedInactiveGroups = [];
  let cachedActiveCount = 0;
  let cachedInactiveCount = 0;
  let editingMeasure = null;

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normKey(v) {
    return String(v || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function canEdit() {
    if (typeof window.canEdit === "function") return window.canEdit();
    const rs = $("roleSelect");
    if (window.PVRoles) return window.PVRoles.canEditFromSelectValue(rs && rs.value);
    return !!(rs && rs.value === "admin");
  }

  function statusMsg(text, kind) {
    if (typeof window.status === "function") window.status(text, kind || "info");
  }

  function parseDateMs(v) {
    if (!v) return 0;
    const t = Date.parse(String(v));
    return Number.isNaN(t) ? 0 : t;
  }

  function formatDate(v) {
    const ms = parseDateMs(v);
    if (!ms) return "—";
    try {
      return new Date(ms).toLocaleDateString("lv-LV");
    } catch (_) {
      return String(v);
    }
  }

  function toInputDate(v) {
    const ms = parseDateMs(v);
    if (!ms) return "";
    try {
      return new Date(ms).toISOString().slice(0, 10);
    } catch (_) {
      return "";
    }
  }

  function normStatus(raw) {
    const k = normKey(raw).replace(/[\s-]+/g, "_");
    if (!k || k === "nav_uzsakts" || k.includes("nav_uz") || k.includes("neuzsak")) return "nav_uzsakts";
    if (k === "pabeigts" || k.includes("pabeig")) return "pabeigts";
    if (k === "atcelts" || k.includes("atcel")) return "atcelts";
    if (k === "izpilde" || k.includes("izpild") || k.includes("procesa")) return "izpilde";
    return "nav_uzsakts";
  }

  function statusMeta(raw) {
    const key = normStatus(raw);
    return STATUS[key] || STATUS.nav_uzsakts;
  }

  function isInactive(raw) {
    const s = normStatus(raw);
    return s === "pabeigts" || s === "atcelts";
  }

  function pick(obj, keys) {
    for (let i = 0; i < keys.length; i++) {
      const v = obj[keys[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  }

  function elVal(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function newPasakumsId() {
    return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function defaultAtbildigais() {
    return { parvalde: "", dala: "", vardsUzvards: "" };
  }

  function normalizeAtbildigieFromRaw(p) {
    const raw = p && typeof p === "object" ? p : {};
    if (Array.isArray(raw.atbildigie) && raw.atbildigie.length) {
      return raw.atbildigie.map((a) => ({
        parvalde: pick(a, ["parvalde", "pārvalde"]),
        dala: pick(a, ["dala", "daļa"]),
        vardsUzvards: pick(a, ["vardsUzvards", "vards_uzvards", "name", "atbildigais"]),
      }));
    }
    const parvalde = pick(raw, ["parvalde", "pārvalde", "izpilditajaParvalde"]);
    const dala = pick(raw, ["dala", "daļa", "strukturvieniba"]);
    const combined = pick(raw, ["vardsUzvards", "atbildigais"]);
    const vards = pick(raw, ["atbildigaisVards", "atbildigais_vards", "vards"]);
    const uzvards = pick(raw, ["atbildigaisUzvards", "atbildigais_uzvards", "uzvards"]);
    const vardsUzvards = combined || [vards, uzvards].filter(Boolean).join(" ");
    if (parvalde || dala || vardsUzvards) {
      return [{ parvalde, dala, vardsUzvards }];
    }
    return [defaultAtbildigais()];
  }

  function atbildigaisKontaktsFromRaw(p) {
    const direct = pick(p, ["atbildigaisKontakts", "atbildigais_kontakts", "kontaktpersona", "atbildigais"]);
    if (direct) return direct;
    return formatAtbildigieText(normalizeAtbildigieFromRaw(p));
  }

  function normalizePasakums(raw, parent, index) {
    const p = raw && typeof raw === "object" ? raw : {};
    const id = pick(p, ["id", "pasakumaId", "pasakuma_id"]) || `${parent.id || "x"}_${index}`;
    const planLegacy = pick(p, [
      "planotaisIeviesanasTermins",
      "planotais_ieviesanas_termins",
      "planotaisIzpildesDatums",
      "planotais_izpildes_datums",
      "plannedDate",
      "planDatums",
    ]);
    const ievLegacy = pick(p, [
      "ieviesanasTermins",
      "ieviesanas_termins",
      "izpildesDatums",
      "izpildes_datums",
      "completedDate",
      "endDate",
    ]);
    const ieraksta = pick(p, ["ierakstaDatums", "ieraksta_datums", "createdAt", "created_at"]) || parent.updatedAt || "";
    return {
      id,
      nosaukums: pick(p, ["nosaukums", "name", "title", "pasakumaNosaukums"]),
      merkis: pick(p, ["merkis", "Mērķis", "merkisText", "target"]),
      ierakstaDatums: ieraksta,
      apraksts: pick(p, ["apraksts", "Apraksts", "description"]),
      kpi: pick(p, ["kpi", "KPI"]),
      ieguvums: pick(p, ["ieguvums", "optimizacijasIeguvums", "optimizācijas_ieguve"]),
      atbildigaisKontakts: atbildigaisKontaktsFromRaw(p),
      izpildesGaita: pick(p, ["izpildesGaita", "izpildes_gaita", "gaita", "informacijaParIzpildi"]),
      pieteiktsRz: pick(p, ["pieteiktsRz", "pieteikts_rz", "pieteiktieRz", "pietiekosaRz", "rz", "RZ"]),
      saistitasIs: pick(p, ["saistitasIs", "saistitas_is", "saistitāsIS", "relatedIs"]),
      planotaisIeviesanasTermins: planLegacy,
      ieviesanasTermins: ievLegacy,
      uzsaksanasDatums: pick(p, ["uzsaksanasDatums", "uzsaksanas_datums", "startDate", "datums"]),
      statuss: normStatus(pick(p, ["statuss", "status", "Statuss"]) || "nav_uzsakts"),
      atcelsanasIemesls: pick(p, [
        "atcelsanasIemesls",
        "atcelsanas_iemesls",
        "atcelšanasIemesls",
        "cancelReason",
      ]),
      atbildigie: normalizeAtbildigieFromRaw(p),
      createdAt: ieraksta,
      procNo: parent.procNo,
      process: parent.process,
      gpNo: parent.gpNo,
      gpName: parent.gpName,
      parentId: parent.id,
    };
  }

  function pasakumsToRaw(p) {
    const status = normStatus(p.statuss);
    let ievTerm = p.ieviesanasTermins || p.izpildesDatums || "";
    if (status === "pabeigts" && !ievTerm) {
      ievTerm = new Date().toISOString().slice(0, 10);
    }
    const atbildigie = (Array.isArray(p.atbildigie) ? p.atbildigie : [])
      .map((a) => ({
        parvalde: String(a.parvalde || "").trim() || null,
        dala: String(a.dala || "").trim() || null,
        vardsUzvards: String(a.vardsUzvards || "").trim() || null,
      }))
      .filter((a) => a.parvalde || a.dala || a.vardsUzvards);
    const ieraksta = p.ierakstaDatums || p.createdAt || new Date().toISOString();
    return {
      id: p.id,
      nosaukums: p.nosaukums,
      merkis: String(p.merkis || "").trim() || null,
      ierakstaDatums: ieraksta,
      apraksts: String(p.apraksts || "").trim() || null,
      kpi: String(p.kpi || "").trim() || null,
      ieguvums: String(p.ieguvums || "").trim() || null,
      atbildigaisKontakts: String(p.atbildigaisKontakts || "").trim() || null,
      izpildesGaita: String(p.izpildesGaita || "").trim() || null,
      pieteiktsRz: String(p.pieteiktsRz || "").trim() || null,
      saistitasIs: String(p.saistitasIs || "").trim() || null,
      planotaisIeviesanasTermins: p.planotaisIeviesanasTermins || null,
      ieviesanasTermins: ievTerm || null,
      uzsaksanasDatums: p.uzsaksanasDatums || null,
      planotaisIzpildesDatums: p.planotaisIeviesanasTermins || null,
      izpildesDatums: ievTerm || null,
      statuss: status,
      atcelsanasIemesls:
        status === "atcelts" ? String(p.atcelsanasIemesls || "").trim() || null : null,
      atbildigie,
      createdAt: ieraksta,
    };
  }

  function listDate(p) {
    return p.ierakstaDatums || p.planotaisIeviesanasTermins || p.createdAt || "";
  }

  function sortDateMs(p) {
    return (
      parseDateMs(p.ierakstaDatums) ||
      parseDateMs(p.planotaisIeviesanasTermins) ||
      parseDateMs(p.ieviesanasTermins) ||
      parseDateMs(p.createdAt)
    );
  }

  function procKeyFromParts(procNo, process) {
    return `${normKey(procNo)}|${normKey(process)}`;
  }

  function gpKeyFromParts(procNo, process, gpNo, gpName) {
    return `${procKeyFromParts(procNo, process)}|${normKey(gpNo)}|${normKey(gpName)}`;
  }

  function pairKeyFromParts(procNo, process, gpNo, gpName) {
    return gpKeyFromParts(procNo, process, gpNo, gpName);
  }

  function flattenProcGpPairs(groups) {
    const pairs = [];
    (groups || []).forEach((proc) => {
      (proc.gps || []).forEach((gp) => {
        const items = gp.items || [];
        let latestMs = 0;
        items.forEach((m) => {
          latestMs = Math.max(latestMs, sortDateMs(m));
        });
        pairs.push({
          procNo: proc.procNo,
          process: proc.process,
          gpNo: gp.gpNo,
          gpName: gp.gpName,
          items,
          latestMs,
        });
      });
    });
    return pairs.sort((a, b) => b.latestMs - a.latestMs);
  }

  function measureKey(p) {
    return `${p.parentId || "p"}:${p.id}`;
  }

  function buildCatalogRows() {
    if (typeof window.getCatalogRows === "function") {
      const cat = window.getCatalogRows() || [];
      if (cat.length) {
        return cat
          .map((r) => ({
            procNo: String(r.procNo || r.processNo || "").trim(),
            process: String(r.process || "").trim(),
            gpNo: String(r.typeNo || r.gpNo || r.productNumber || "").trim(),
            gpName: String(r.type || r.gpName || r.productName || "").trim(),
          }))
          .filter((r) => r.gpName || r.gpNo);
      }
    }
    const out = [];
    if (typeof window.getMergedProcessRegisterRows === "function") {
      (window.getMergedProcessRegisterRows() || []).forEach((p) => {
        const procNo = String(p.processNo || "").trim();
        const process = String(p.process || "").trim();
        const products = Array.isArray(p.products) ? p.products : [];
        if (products.length) {
          products.forEach((gp) => {
            out.push({
              procNo,
              process,
              gpNo: String((gp && gp.typeNo) || "").trim(),
              gpName: String((gp && gp.type) || gp || "").trim(),
            });
          });
        }
      });
    }
    return out.filter((r) => r.procNo || r.process);
  }

  function flattenPasakumi(rows) {
    const out = [];
    (rows || []).forEach((parent) => {
      const pasakumi = Array.isArray(parent.pasakumi) ? parent.pasakumi : [];
      pasakumi.forEach((raw, index) => {
        out.push(normalizePasakums(raw, parent, index));
      });
    });
    return out.sort((a, b) => sortDateMs(b) - sortDateMs(a));
  }

  function groupMeasures(items) {
    const procMap = new Map();
    items.forEach((m) => {
      const pk = normKey(m.procNo) || normKey(m.process) || "_";
      if (!procMap.has(pk)) {
        procMap.set(pk, { procNo: m.procNo, process: m.process, gpMap: new Map(), latestMs: 0 });
      }
      const proc = procMap.get(pk);
      proc.latestMs = Math.max(proc.latestMs, sortDateMs(m));
      const gk = [normKey(m.gpNo), normKey(m.gpName)].join("|");
      if (!proc.gpMap.has(gk)) {
        proc.gpMap.set(gk, { gpNo: m.gpNo, gpName: m.gpName, items: [], latestMs: 0 });
      }
      const gp = proc.gpMap.get(gk);
      gp.items.push(m);
      gp.latestMs = Math.max(gp.latestMs, sortDateMs(m));
    });

    return Array.from(procMap.values())
      .sort((a, b) => b.latestMs - a.latestMs)
      .map((proc) => ({
        procNo: proc.procNo,
        process: proc.process,
        gps: Array.from(proc.gpMap.values())
          .sort((a, b) => b.latestMs - a.latestMs)
          .map((gp) => ({
            gpNo: gp.gpNo,
            gpName: gp.gpName,
            items: gp.items.sort((a, b) => sortDateMs(b) - sortDateMs(a)),
          })),
      }));
  }

  function splitMeasures(measures) {
    const active = measures.filter((m) => !isInactive(m.statuss));
    const inactive = measures.filter((m) => isInactive(m.statuss));
    return { active, inactive };
  }

  function processLabel(procNo, process) {
    if (typeof window.pvPairLabel === "function") {
      const lbl = window.pvPairLabel(procNo, process);
      if (lbl) return lbl;
    }
    return procNo || process || (window.pvEmptyMark || "–");
  }

  function gpLabel(gpNo, gpName) {
    if (typeof window.pvPairLabel === "function") {
      const lbl = window.pvPairLabel(gpNo, gpName);
      if (lbl) return lbl;
    }
    return gpName || gpNo || (window.pvEmptyMark || "–");
  }

  function atbildigaisLine(a) {
    const org = [a.parvalde, a.dala].filter(Boolean).join(", ");
    const name = a.vardsUzvards || "";
    if (org && name) return `${org} · ${name}`;
    return org || name || "—";
  }

  function formatAtbildigieText(list) {
    const items = (list || []).filter((a) => a.parvalde || a.dala || a.vardsUzvards);
    if (!items.length) return "—";
    return items.map((a) => atbildigaisLine(a)).join("; ");
  }

  function displayText(v) {
    if (v === null || v === undefined) return "";
    const t = String(v).trim();
    if (!t || t === "undefined" || t === "null") return "";
    return t;
  }

  function formatMultilineHtml(text) {
    const t = displayText(text);
    if (!t) return '<span class="val muted">—</span>';
    return `<div class="val opt-pre">${esc(t)}</div>`;
  }

  function findParentById(id) {
    return (dbRows || []).find((r) => String(r.id) === String(id)) || null;
  }

  function findParentByProcGp(procNo, process, gpNo, gpName) {
    return (
      (dbRows || []).find(
        (r) =>
          normKey(r.procNo) === normKey(procNo) &&
          normKey(r.gpNo) === normKey(gpNo) &&
          normKey(r.gpName) === normKey(gpName)
      ) || null
    );
  }

  function ensureStyles() {
    if (document.getElementById("optimizacijaCss")) return;
    const s = document.createElement("style");
    s.id = "optimizacijaCss";
    s.textContent = `
      #${LIST_ID} { margin-top:12px; display:flex; flex-direction:column; gap:20px; }
      .opt-section-hdr {
        font-size:17px; font-weight:700; color:#1e293b; margin:0 0 10px;
        padding-bottom:6px; border-bottom:2px solid #cbd5e1;
      }
      .opt-proc-group { border:1px solid #cbd5e1; border-radius:10px; overflow:hidden; background:#fff; margin-bottom:12px; }
      .opt-proc-hdr {
        padding:10px 14px; background:#eef2ff; font-weight:700; color:#1e3a8a; font-size:14px;
        border-bottom:1px solid #c7d2fe;
      }
      .opt-proc-group.inactive-block .opt-proc-hdr { background:#f1f5f9; color:#475569; }
      .opt-gp-block { border-top:1px solid #e2e8f0; }
      .opt-gp-hdr {
        padding:8px 14px; background:#f8fafc; font-weight:600; color:#334155; font-size:13px;
        border-bottom:1px dashed #cbd5e1;
      }
      .opt-measure-table { width:100%; border-collapse:collapse; font-size:13px; }
      .opt-measure-table th {
        text-align:left; padding:8px 12px; background:#f1f5f9; color:#475569;
        font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em;
      }
      .opt-measure-table td { padding:10px 12px; border-top:1px solid #e2e8f0; vertical-align:middle; }
      .opt-measure-row { cursor:pointer; transition:background .12s; }
      .opt-measure-row:hover { background:#f8fafc; }
      .opt-measure-row.open { background:#eff6ff; }
      .opt-measure-row .opt-date { white-space:nowrap; color:#334155; font-weight:600; }
      .opt-measure-row .opt-title { color:#0f172a; font-weight:600; }
      .opt-measure-row .opt-meta { color:#64748b; font-size:12px; }
      .opt-actions { white-space:nowrap; display:flex; gap:6px; justify-content:flex-end; }
      .opt-actions button { font-size:11px; padding:4px 8px; }
      .opt-status-pill {
        display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700;
        white-space:nowrap;
      }
      .opt-st-not-started { background:#e2e8f0; color:#475569; }
      .opt-st-in-progress { background:#fef3c7; color:#b45309; }
      .opt-st-done { background:#dcfce7; color:#15803d; }
      .opt-st-cancelled { background:#fee2e2; color:#b91c1c; }
      #optimizacijaCard .opt-atcel-row.hidden { display:none; }
      .opt-detail-row td { padding:0; border-top:none; background:#f8fafc; }
      .opt-detail-card {
        margin:0 12px 12px; padding:14px; border:1px solid #cbd5e1; border-radius:8px; background:#fff;
      }
      .opt-detail-grid {
        display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px;
      }
      .opt-detail-field label {
        display:block; font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px;
        text-transform:uppercase; letter-spacing:.02em;
      }
      .opt-detail-field .val { font-size:13px; color:#0f172a; }
      .opt-empty-list {
        padding:20px; text-align:center; color:#64748b; border:1px dashed #cbd5e1; border-radius:10px;
        background:#f8fafc; font-size:13px;
      }
      #${MODAL_ID} {
        position:fixed; inset:0; z-index:10045; background:rgba(15,23,42,.45);
        display:flex; align-items:flex-start; justify-content:center; padding:24px 12px; overflow:auto;
      }
      #${MODAL_ID}.hidden { display:none !important; }
      #${MODAL_ID} .opt-modal-inner {
        width:100%; max-width:760px; background:#fff; border-radius:12px; padding:18px 20px;
        box-shadow:0 20px 50px rgba(0,0,0,.25); margin-top:20px;
      }
      #${MODAL_ID} h3 { margin:0 0 14px; color:#0f172a; }
      #${FORM_ID} .opt-form-grid {
        display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:10px;
      }
      #${FORM_ID} label { display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px; }
      #${FORM_ID} input, #${FORM_ID} select, #${FORM_ID} textarea {
        width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px;
        font-size:13px;
      }
      #${FORM_ID} .opt-form-span2 { grid-column:1/-1; }
      #${FORM_ID} .opt-form-section {
        grid-column:1/-1; margin:8px 0 4px; padding-top:10px; border-top:1px solid #e2e8f0;
        font-size:13px; font-weight:700; color:#1e3a8a;
      }
      #${FORM_ID} textarea {
        min-height:88px; resize:vertical; font-family:inherit; line-height:1.45;
      }
      .opt-atb-list { display:flex; flex-direction:column; gap:8px; margin-bottom:8px; }
      .opt-atb-row {
        display:grid; grid-template-columns:1fr 1fr 1.2fr auto; gap:8px; align-items:center;
      }
      .opt-atb-row input { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px; }
      .opt-atb-rm { min-width:34px; padding:6px 8px; line-height:1; }
      #optFormAddAtbildigais { margin-top:4px; }
      .opt-atb-line { padding:4px 0; border-bottom:1px dashed #e2e8f0; }
      .opt-atb-line:last-child { border-bottom:none; }
      .opt-pre { white-space:pre-wrap; word-break:break-word; }
      .opt-detail-field .val.muted { color:#94a3b8; }
      #${MODAL_ID} .opt-modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:14px; }
      @media (max-width:640px) {
        .opt-atb-row { grid-template-columns:1fr; }
      }
      #${STATUS_ID}.warn { color:#b45309; }
      #${STATUS_ID}.err { color:#b91c1c; }
      #optimizacijaCard .toolbar .right {
        display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px;
      }
      #optimizacijaCard .ex-view-controls { margin:8px 0 12px; display:flex; flex-wrap:wrap; gap:8px; }
      #optimizacijaCard .ex-parvalde-list-heading { margin:0 0 10px; font-size:14px; font-weight:700; color:#334155; }
      #optimizacijaCard .ex-parvalde-list { display:flex; flex-direction:column; gap:12px; width:100%; }
      #optimizacijaCard .opt-proc-block { display:flex; flex-direction:column; width:100%; }
      #optimizacijaCard .opt-proc-picker {
        display:flex; align-items:center; flex-wrap:wrap; gap:8px 12px; width:100%; text-align:left;
        padding:14px 16px; border:2px solid #cbd5e1; border-radius:14px; background:#fff;
        cursor:pointer; font:inherit; color:#475569; box-shadow:0 2px 6px rgba(15,23,42,.06);
      }
      #optimizacijaCard .opt-proc-picker:hover { border-color:#93c5fd; background:#f8fafc; }
      #optimizacijaCard .opt-proc-picker.opt-proc-picker--open {
        border-radius:14px 14px 0 0; border-color:#2563eb;
        background:linear-gradient(180deg,#eff6ff 0%,#fff 100%);
      }
      #optimizacijaCard .opt-proc-title { flex:1 1 200px; font-weight:700; font-size:14px; color:#1e3a8a; }
      #optimizacijaCard .opt-proc-meta { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
      #optimizacijaCard .ex-unit-chip {
        display:inline-flex; padding:2px 10px; border-radius:999px; background:#64748b; color:#fff;
        font-size:12px; font-weight:600;
      }
      #optimizacijaCard .opt-card-hint { font-size:11px; color:#64748b; }
      #optimizacijaCard .opt-proc-body {
        border:2px solid #2563eb; border-top:0; border-radius:0 0 14px 14px; padding:14px 16px 16px;
        background:#fff; margin:0 0 8px; box-shadow:0 4px 12px rgba(37,99,235,.1);
        display:flex; flex-direction:column; gap:12px;
      }
      #optimizacijaCard .opt-gp-row {
        padding:12px 14px; border:1px solid #e2e8f0; border-radius:12px; background:#f8fafc;
        display:flex; flex-direction:column; gap:10px; margin-left:4px;
      }
      #optimizacijaCard .opt-gp-title { font-weight:600; font-size:13px; color:#334155; line-height:1.4; }
      #optimizacijaCard .opt-gp-measure-list { display:flex; flex-direction:column; gap:8px; width:100%; }
      #optimizacijaCard .opt-measure-open-btn {
        display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%;
        font-size:12px; font-weight:600; text-align:left; line-height:1.35; padding:10px 14px;
        background:#1e3a8a; color:#fff; border:1px solid #1e40af; border-radius:10px;
      }
      #optimizacijaCard .opt-measure-open-btn:hover {
        background:#1d4ed8; border-color:#2563eb; color:#fff;
      }
      #optimizacijaCard .opt-measure-open-main { flex:1 1 auto; min-width:0; color:#fff; }
      #optimizacijaCard .opt-measure-open-meta {
        display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:6px; flex-shrink:0;
      }
      #optimizacijaCard .opt-measure-open-btn .opt-measure-open-date {
        font-weight:500; color:rgba(255,255,255,.88); font-size:11px; white-space:nowrap;
      }
      #optimizacijaCard .opt-measure-open-btn .opt-status-pill { font-size:10px; padding:2px 8px; }
      #optimizacijaCard .inactive-block .opt-measure-open-btn {
        background:#334155; border-color:#475569;
      }
      #optimizacijaCard .inactive-block .opt-measure-open-btn:hover {
        background:#475569; border-color:#64748b;
      }
      #optimizacijaCard .opt-create-primary {
        background:#2563eb; color:#fff; border:1px solid #1d4ed8; font-weight:700;
      }
      #optimizacijaCard .opt-create-primary:hover:not(:disabled) { background:#1d4ed8; }
      #optimizacijaCard .opt-create-primary:disabled { opacity:.55; cursor:not-allowed; }
      #optimizacijaCard .opt-measure-open-btn--active {
        background:#2563eb; border-color:#93c5fd; color:#fff;
        box-shadow:0 0 0 2px rgba(147,197,253,.65);
      }
      #optimizacijaCard .inactive-block .opt-measure-open-btn--active {
        background:#475569; border-color:#94a3b8;
        box-shadow:0 0 0 2px rgba(148,163,184,.5);
      }
      #optimizacijaCard .opt-measure-expanded {
        border:2px solid #6366f1; border-radius:12px; padding:14px; background:#fff;
      }
      #optimizacijaCard .opt-add-measure-btn { font-size:12px; }
      #optimizacijaCard .opt-section-hdr { margin-top:4px; }
    `;
    document.head.appendChild(s);
  }

  function ensureToolbar(card) {
    const toolbar = card.querySelector(".toolbar");
    if (!toolbar) return;
    let right = toolbar.querySelector(".right");
    if (!right) {
      right = document.createElement("div");
      right.className = "right editor-actions";
      toolbar.appendChild(right);
    }
    let controls = card.querySelector(".ex-view-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "ex-view-controls";
      const statusEl = $(STATUS_ID);
      if (statusEl) statusEl.insertAdjacentElement("afterend", controls);
      else toolbar.insertAdjacentElement("afterend", controls);
    }
    let btn = $("optimizacijaCreateBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "optimizacijaCreateBtn";
      right.appendChild(btn);
    } else if (btn.parentElement !== right) {
      right.appendChild(btn);
    }
    btn.className = "opt-create-primary";
    btn.textContent = "+ Jauns optimizācijas pasākums";
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openForm(null);
    };
    const editable = canEdit();
    btn.disabled = !editable;
    btn.classList.remove("hidden");
    btn.title = editable ? "" : "Pieejams tikai lomai «Administrators»";

    if (!document.getElementById(BULK_BTN_ID)) {
      const bulk = document.createElement("button");
      bulk.type = "button";
      bulk.id = BULK_BTN_ID;
      bulk.className = "secondary";
      bulk.textContent = "Atvērt visas kartiņas";
      controls.appendChild(bulk);
    }
    const bulkBtn = $(BULK_BTN_ID);
    if (bulkBtn && !bulkBtn.dataset.bound) {
      bulkBtn.dataset.bound = "1";
      bulkBtn.addEventListener("click", () => {
        const procs = (cachedActiveGroups || []).concat(cachedInactiveGroups || []);
        const openAll = procCardOpen.size < procs.length;
        procCardOpen.clear();
        measureCardOpen.clear();
        if (openAll) {
          procs.forEach((p) => procCardOpen.add(procKeyFromParts(p.procNo, p.process)));
        }
        paintList($(LIST_ID));
      });
    }
    if (bulkBtn) {
      bulkBtn.textContent = procCardOpen.size > 0 ? "Aizvērt visas kartiņas" : "Atvērt visas kartiņas";
    }
  }

  function ensureEditorModal() {
    const existing = $(MODAL_ID);
    if (existing && existing.getAttribute("data-form-ver") === FORM_VERSION) return;
    if (existing) existing.remove();
    const wrap = document.createElement("div");
    wrap.id = MODAL_ID;
    wrap.className = "hidden";
    wrap.setAttribute("data-form-ver", FORM_VERSION);
    wrap.innerHTML = `
      <div class="opt-modal-inner">
        <h3 id="optimizacijaEditorTitle">Jauns optimizācijas pasākums</h3>
        <form id="${FORM_ID}">
          <div class="opt-form-grid">
            <div class="opt-form-span2">
              <label for="optFormProc">Procesa Nr. un process *</label>
              <select id="optFormProc" required></select>
            </div>
            <div class="opt-form-span2">
              <label for="optFormGp">GP numurs un galaprodukts *</label>
              <select id="optFormGp" required></select>
            </div>
            <div class="opt-form-span2">
              <label for="optFormNosaukums">Optimizācijas pasākuma nosaukums *</label>
              <textarea id="optFormNosaukums" rows="2" required></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormMerits">Mērķis</label>
              <textarea id="optFormMerits" rows="3"></textarea>
            </div>
            <div>
              <label for="optFormIeraksta">Ieraksta datums</label>
              <input id="optFormIeraksta" type="date" readonly tabindex="-1" style="background:#f8fafc" />
            </div>
            <div>
              <label for="optFormStatuss">Statuss</label>
              <select id="optFormStatuss">
                <option value="nav_uzsakts">Nav uzsākts</option>
                <option value="izpilde">Izpildē</option>
                <option value="pabeigts">Pabeigts</option>
                <option value="atcelts">Atcelts</option>
              </select>
            </div>
            <div class="opt-form-span2 opt-atcel-row hidden" id="optFormAtcelRow">
              <label for="optFormAtcelsIemesls">Atcelšanas iemesls *</label>
              <textarea id="optFormAtcelsIemesls" rows="3" placeholder="Obligāti, ja statuss ir «Atcelts»"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormApraksts">Apraksts</label>
              <textarea id="optFormApraksts" rows="4"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormKpi">KPI</label>
              <textarea id="optFormKpi" rows="3"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormIeguvums">Optimizācijas ieguvums</label>
              <textarea id="optFormIeguvums" rows="3"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormAtbildigais">Atbildīgais / kontaktpersona</label>
              <textarea id="optFormAtbildigais" rows="2"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormGaita">Informācija par izpildi</label>
              <textarea id="optFormGaita" rows="4"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormRz">Pieteiktie RZ</label>
              <textarea id="optFormRz" rows="3" placeholder="Ja ir pieteikti RZ"></textarea>
            </div>
            <div class="opt-form-span2">
              <label for="optFormIs">Saistītās IS</label>
              <textarea id="optFormIs" rows="2"></textarea>
            </div>
            <div>
              <label for="optFormPlanTerm">Plānotais ieviešanas termiņš</label>
              <input id="optFormPlanTerm" type="date" />
            </div>
            <div>
              <label for="optFormIevTerm">Ieviešanas termiņš</label>
              <input id="optFormIevTerm" type="date" />
            </div>
          </div>
          <div class="opt-modal-actions">
            <button type="button" class="secondary" id="optimizacijaEditorCancel">Atcelt</button>
            <button type="submit" id="optimizacijaEditorSave">Saglabāt</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(wrap);
    wrap.addEventListener("click", (ev) => {
      if (ev.target === wrap) closeForm();
    });
    $("optimizacijaEditorCancel").onclick = closeForm;
    $(FORM_ID).onsubmit = (ev) => {
      ev.preventDefault();
      saveForm();
    };
    $("optFormProc").onchange = () => populateGpSelect($("optFormProc").value);
    $("optFormStatuss").onchange = () => syncOptFormStatusFields();
  }

  function syncOptFormStatusFields() {
    const st = normStatus($("optFormStatuss") ? $("optFormStatuss").value : "");
    if (st === "pabeigts" && $("optFormIevTerm") && !$("optFormIevTerm").value) {
      $("optFormIevTerm").value = new Date().toISOString().slice(0, 10);
    }
    const row = $("optFormAtcelRow");
    const ta = $("optFormAtcelsIemesls");
    if (row) row.classList.toggle("hidden", st !== "atcelts");
    if (ta) ta.required = st === "atcelts";
  }

  function populateProcSelect(selectedProcNo) {
    const sel = $("optFormProc");
    if (!sel) return;
    const rows = buildCatalogRows();
    const procMap = new Map();
    rows.forEach((r) => {
      const k = normKey(r.procNo) || normKey(r.process);
      if (!procMap.has(k)) procMap.set(k, r);
    });
    const procs = Array.from(procMap.values()).sort((a, b) =>
      String(a.procNo || a.process).localeCompare(String(b.procNo || b.process), "lv", { sensitivity: "base" })
    );
    sel.innerHTML =
      '<option value="">— Izvēlieties procesu —</option>' +
      procs
        .map((p) => {
          const val = `${p.procNo}|||${p.process}`;
          const label = processLabel(p.procNo, p.process);
          const selected = normKey(p.procNo) === normKey(selectedProcNo) ? " selected" : "";
          return `<option value="${esc(val)}"${selected}>${esc(label)}</option>`;
        })
        .join("");
  }

  function populateGpSelect(procValue, selectedGpNo, selectedGpName) {
    const sel = $("optFormGp");
    if (!sel) return;
    if (!procValue) {
      sel.innerHTML = '<option value="">— Vispirms izvēlieties procesu —</option>';
      return;
    }
    const parts = procValue.split("|||");
    const procNo = parts[0] || "";
    const process = parts[1] || "";
    const gps = buildCatalogRows()
      .filter(
        (r) =>
          normKey(r.procNo) === normKey(procNo) ||
          (!r.procNo && normKey(r.process) === normKey(process))
      )
      .sort((a, b) => String(a.gpName || a.gpNo).localeCompare(String(b.gpName || b.gpNo), "lv", { sensitivity: "base" }));
    sel.innerHTML =
      '<option value="">— Izvēlieties GP —</option>' +
      gps
        .map((g) => {
          const val = `${g.gpNo}|||${g.gpName}`;
          const label = gpLabel(g.gpNo, g.gpName);
          const selected =
            normKey(g.gpNo) === normKey(selectedGpNo) && normKey(g.gpName) === normKey(selectedGpName)
              ? " selected"
              : "";
          return `<option value="${esc(val)}"${selected}>${esc(label)}</option>`;
        })
        .join("");
  }

  function openForm(measure) {
    if (!canEdit()) {
      alert("Labošana pieejama tikai lomai «Administrators». Iestatījumos izvēlieties šo lomu.");
      return;
    }
    try {
      ensureEditorModal();
      const modal = $(MODAL_ID);
      if (!modal) {
        statusMsg("Neizdevās atvērt formu (modālais logs nav pieejams).", "error");
        return;
      }
      const isEdit = !!(measure && measure.id);
      editingMeasure = isEdit ? { ...measure } : null;
      $("optimizacijaEditorTitle").textContent = isEdit
        ? "Labot optimizācijas pasākumu"
        : "Jauns optimizācijas pasākums";
      populateProcSelect(measure ? measure.procNo : "");
      const procVal = measure ? `${measure.procNo || ""}|||${measure.process || ""}` : "";
      if ($("optFormProc")) $("optFormProc").value = procVal;
      populateGpSelect(procVal, measure ? measure.gpNo : "", measure ? measure.gpName : "");
      if (measure && $("optFormGp")) {
        $("optFormGp").value = `${measure.gpNo}|||${measure.gpName}`;
      }
      const today = new Date().toISOString().slice(0, 10);
      if ($("optFormNosaukums")) $("optFormNosaukums").value = measure ? measure.nosaukums : "";
      if ($("optFormMerits")) $("optFormMerits").value = measure ? measure.merkis : "";
      if ($("optFormIeraksta")) {
        $("optFormIeraksta").value = measure ? toInputDate(measure.ierakstaDatums || measure.createdAt) : today;
      }
      if ($("optFormStatuss")) $("optFormStatuss").value = measure ? normStatus(measure.statuss) : "nav_uzsakts";
      if ($("optFormAtcelsIemesls")) {
        $("optFormAtcelsIemesls").value = measure ? measure.atcelsanasIemesls || "" : "";
      }
      syncOptFormStatusFields();
      if ($("optFormApraksts")) $("optFormApraksts").value = measure ? measure.apraksts : "";
      if ($("optFormKpi")) $("optFormKpi").value = measure ? measure.kpi : "";
      if ($("optFormIeguvums")) $("optFormIeguvums").value = measure ? measure.ieguvums : "";
      if ($("optFormAtbildigais")) $("optFormAtbildigais").value = measure ? measure.atbildigaisKontakts : "";
      if ($("optFormGaita")) $("optFormGaita").value = measure ? measure.izpildesGaita : "";
      if ($("optFormRz")) $("optFormRz").value = measure ? measure.pieteiktsRz : "";
      if ($("optFormIs")) $("optFormIs").value = measure ? measure.saistitasIs : "";
      if ($("optFormPlanTerm")) {
        $("optFormPlanTerm").value = measure ? toInputDate(measure.planotaisIeviesanasTermins) : "";
      }
      if ($("optFormIevTerm")) {
        $("optFormIevTerm").value = measure ? toInputDate(measure.ieviesanasTermins) : "";
      }
      modal.classList.remove("hidden");
    } catch (e) {
      console.error("Optimizacija openForm:", e);
      statusMsg("Neizdevās atvērt formu: " + String(e.message || e), "error");
    }
  }

  function closeForm() {
    editingMeasure = null;
    const modal = $(MODAL_ID);
    if (modal) modal.classList.add("hidden");
  }

  async function persistParentPasakumi(parent, pasakumi) {
    const payload = {
      procNo: parent.procNo,
      process: parent.process,
      gpNo: parent.gpNo,
      gpName: parent.gpName,
      pasakumi,
    };
    if (parent.id != null) {
      return window.DB.updateOptimizacija(parent.id, payload);
    }
    return window.DB.insertOptimizacija(payload);
  }

  async function removePasakumsFromParent(parent, pasakumsId) {
    const pasakumi = (Array.isArray(parent.pasakumi) ? parent.pasakumi : []).filter(
      (raw) => pick(raw, ["id", "pasakumaId", "pasakuma_id"]) !== pasakumsId
    );
    if (!pasakumi.length && parent.id != null && window.DB.deleteOptimizacija) {
      await window.DB.deleteOptimizacija(parent.id);
      return;
    }
    await persistParentPasakumi(parent, pasakumi);
  }

  async function saveForm() {
    if (!canEdit()) return;
    const procParts = elVal("optFormProc").split("|||");
    const gpParts = elVal("optFormGp").split("|||");
    const procNo = procParts[0] || "";
    const process = procParts[1] || "";
    const gpNo = gpParts[0] || "";
    const gpName = gpParts[1] || "";
    const nosaukums = elVal("optFormNosaukums");

    if (!procNo && !process) {
      alert("Izvēlieties procesu.");
      return;
    }
    if (!gpName && !gpNo) {
      alert("Izvēlieties galaproduktu (GP).");
      return;
    }
    if (!nosaukums) {
      alert("Ievadiet pasākuma nosaukumu.");
      return;
    }
    const statusRaw = elVal("optFormStatuss");
    const atcelIem = elVal("optFormAtcelsIemesls");
    if (normStatus(statusRaw) === "atcelts" && !atcelIem) {
      alert("Statusam «Atcelts» obligāti jānorāda atcelšanas iemesls.");
      return;
    }

    const saveLabel = editingMeasure
      ? `optimizācijas pasākumu «${nosaukums}»`
      : `jauno optimizācijas pasākumu «${nosaukums}»`;
    if (window.PVConfirm) {
      if (!window.PVConfirm.confirmSave(saveLabel)) return;
    } else if (!confirm(`Vai tiešām gribat labot vai saglabāt — ${saveLabel}?`)) {
      return;
    }

    const ierakstaRaw = elVal("optFormIeraksta") || new Date().toISOString().slice(0, 10);
    const measure = {
      id: editingMeasure ? editingMeasure.id : newPasakumsId(),
      nosaukums,
      merkis: elVal("optFormMerits"),
      ierakstaDatums: ierakstaRaw,
      apraksts: elVal("optFormApraksts"),
      kpi: elVal("optFormKpi"),
      ieguvums: elVal("optFormIeguvums"),
      atbildigaisKontakts: elVal("optFormAtbildigais"),
      izpildesGaita: elVal("optFormGaita"),
      pieteiktsRz: elVal("optFormRz"),
      saistitasIs: elVal("optFormIs"),
      planotaisIeviesanasTermins: elVal("optFormPlanTerm"),
      ieviesanasTermins: elVal("optFormIevTerm"),
      statuss: statusRaw,
      atcelsanasIemesls: atcelIem,
      atbildigie: [],
      createdAt: editingMeasure ? editingMeasure.createdAt || ierakstaRaw : new Date().toISOString(),
    };
    const raw = pasakumsToRaw(measure);

    try {
      if (editingMeasure && editingMeasure.parentId != null) {
        const oldParent = findParentById(editingMeasure.parentId);
        if (!oldParent) throw new Error("Sākotnējais ieraksts nav atrasts.");
        const sameParent =
          normKey(oldParent.procNo) === normKey(procNo) &&
          normKey(oldParent.gpNo) === normKey(gpNo) &&
          normKey(oldParent.gpName) === normKey(gpName);

        if (sameParent) {
          const pasakumi = (Array.isArray(oldParent.pasakumi) ? oldParent.pasakumi : []).map((p) =>
            pick(p, ["id", "pasakumaId", "pasakuma_id"]) === measure.id ? raw : p
          );
          await persistParentPasakumi(oldParent, pasakumi);
        } else {
          await removePasakumsFromParent(oldParent, measure.id);
          let newParent = findParentByProcGp(procNo, process, gpNo, gpName);
          if (!newParent) {
            newParent = { procNo, process, gpNo, gpName, pasakumi: [] };
          }
          const pasakumi = Array.isArray(newParent.pasakumi) ? [...newParent.pasakumi] : [];
          pasakumi.push(raw);
          await persistParentPasakumi(newParent, pasakumi);
        }
      } else {
        let parent = findParentByProcGp(procNo, process, gpNo, gpName);
        if (!parent) {
          parent = { procNo, process, gpNo, gpName, pasakumi: [] };
        }
        const pasakumi = Array.isArray(parent.pasakumi) ? [...parent.pasakumi] : [];
        pasakumi.push(raw);
        await persistParentPasakumi(parent, pasakumi);
      }
      closeForm();
      statusMsg("Optimizācijas pasākums saglabāts.", "success");
      procCardOpen.add(procKeyFromParts(procNo, process));
      measureCardOpen.add(`${findParentByProcGp(procNo, process, gpNo, gpName)?.id || "new"}:${measure.id}`);
      await render();
    } catch (e) {
      const msg = (window.DB && window.DB.mapDbError && window.DB.mapDbError(e)) || String(e.message || e);
      statusMsg("Neizdevās saglabāt: " + msg, "error");
    }
  }

  async function deleteMeasure(measure) {
    if (!canEdit()) return;
    const delLabel = `optimizācijas pasākumu «${measure.nosaukums || "—"}»`;
    if (window.PVConfirm) {
      if (!window.PVConfirm.confirmDelete(delLabel)) return;
    } else if (!confirm(`Vai tiešām gribat dzēst — ${delLabel}?`)) {
      return;
    }
    const parent = findParentById(measure.parentId);
    if (!parent) {
      statusMsg("Ieraksts nav atrasts.", "error");
      return;
    }
    try {
      await removePasakumsFromParent(parent, measure.id);
      measureCardOpen.delete(measureKey(measure));
      statusMsg("Pasākums dzēsts.", "success");
      await render();
    } catch (e) {
      const msg = (window.DB && window.DB.mapDbError && window.DB.mapDbError(e)) || String(e.message || e);
      statusMsg("Neizdevās dzēst: " + msg, "error");
    }
  }

  function ensureShell(card) {
    ensureStyles();
    ensureToolbar(card);
    let status = $(STATUS_ID);
    if (!status) {
      status = document.createElement("p");
      status.id = STATUS_ID;
      status.className = "hint";
      card.appendChild(status);
    }
    let root = $(LIST_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = LIST_ID;
      card.appendChild(root);
    }
    return { status, root };
  }

  function renderDetailField(label, contentHtml, fullWidth) {
    const span = fullWidth ? ' style="grid-column:1/-1"' : "";
    return `<div class="opt-detail-field"${span}><label>${esc(label)}</label>${contentHtml}</div>`;
  }

  function renderStatusPillHtml(p) {
    const meta = statusMeta(p.statuss);
    return `<span class="opt-status-pill ${meta.cls}">${esc(meta.label)}</span>`;
  }

  function renderDetailCard(p) {
    const st = normStatus(p.statuss);
    const atcelField =
      st === "atcelts"
        ? renderDetailField("Atcelšanas iemesls", formatMultilineHtml(p.atcelsanasIemesls), true)
        : "";
    return `
      <div class="opt-detail-card">
        <div class="opt-detail-grid">
          ${renderDetailField("Optimizācijas pasākuma nosaukums", formatMultilineHtml(p.nosaukums), true)}
          ${renderDetailField("Statuss", `<div class="val">${renderStatusPillHtml(p)}</div>`)}
          ${renderDetailField("Mērķis", formatMultilineHtml(p.merkis), true)}
          ${renderDetailField("Ieraksta datums", `<div class="val">${esc(formatDate(p.ierakstaDatums || p.createdAt))}</div>`)}
          ${atcelField}
          ${renderDetailField("Apraksts", formatMultilineHtml(p.apraksts), true)}
          ${renderDetailField("KPI", formatMultilineHtml(p.kpi), true)}
          ${renderDetailField("Optimizācijas ieguvums", formatMultilineHtml(p.ieguvums), true)}
          ${renderDetailField("Atbildīgais / kontaktpersona", formatMultilineHtml(p.atbildigaisKontakts), true)}
          ${renderDetailField("Informācija par izpildi", formatMultilineHtml(p.izpildesGaita), true)}
          ${renderDetailField("Pieteiktie RZ", formatMultilineHtml(p.pieteiktsRz), true)}
          ${renderDetailField("Saistītās IS", formatMultilineHtml(p.saistitasIs), true)}
          ${renderDetailField("Plānotais ieviešanas termiņš", `<div class="val">${esc(formatDate(p.planotaisIeviesanasTermins))}</div>`)}
          ${renderDetailField("Ieviešanas termiņš", `<div class="val">${esc(formatDate(p.ieviesanasTermins))}</div>`)}
        </div>
      </div>
    `;
  }

  function measureButtonLabel(p) {
    const title = String(p.nosaukums || "").trim() || "—";
    return `Optimizācijas pasākums «${title}»`;
  }

  function sortMeasuresByIeraksts(items) {
    return (items || []).slice().sort((a, b) => {
      const da = parseDateMs(a.ierakstaDatums || a.createdAt);
      const db = parseDateMs(b.ierakstaDatums || b.createdAt);
      if (db !== da) return db - da;
      return sortDateMs(b) - sortDateMs(a);
    });
  }

  function renderMeasureOpenButton(p) {
    const key = measureKey(p);
    const open = measureCardOpen.has(key);
    const dateLbl = formatDate(p.ierakstaDatums || p.createdAt);
    const meta = statusMeta(p.statuss);
    return `<button type="button" class="secondary opt-measure-open-btn${open ? " opt-measure-open-btn--active" : ""}" data-opt-key="${esc(key)}">
      <span class="opt-measure-open-main">${esc(measureButtonLabel(p))}</span>
      <span class="opt-measure-open-meta">
        <span class="opt-status-pill ${meta.cls}">${esc(meta.label)}</span>
        <span class="opt-measure-open-date">${esc(dateLbl)}</span>
      </span>
    </button>`;
  }

  function renderMeasureExpanded(p, showActions) {
    const key = measureKey(p);
    const actions = showActions
      ? `<div class="opt-actions" style="margin-top:12px">
          <button type="button" class="secondary opt-edit-btn" data-opt-key="${esc(key)}">Labot</button>
          <button type="button" class="secondary opt-del-btn" data-opt-key="${esc(key)}">Dzēst</button>
          <button type="button" class="secondary opt-measure-close-btn" data-opt-key="${esc(key)}">Aizvērt kartiņu</button>
        </div>`
      : `<div class="opt-actions" style="margin-top:12px">
          <button type="button" class="secondary opt-measure-close-btn" data-opt-key="${esc(key)}">Aizvērt kartiņu</button>
        </div>`;
    return `<div class="opt-measure-expanded" data-opt-measure-key="${esc(key)}">${renderDetailCard(p)}${actions}</div>`;
  }

  function renderGpBlock(gp, procGroup, inactive, showActions) {
    const gk = gpKeyFromParts(procGroup.procNo, procGroup.process, gp.gpNo, gp.gpName);
    const items = sortMeasuresByIeraksts(gp.items);
    const listHtml = items.length
      ? items.map((m) => renderMeasureOpenButton(m)).join("")
      : `<span class="hint" style="font-size:12px">Nav pasākumu.</span>`;
    const openItem = items.find((m) => measureCardOpen.has(measureKey(m)));
    const expanded = openItem ? renderMeasureExpanded(openItem, showActions) : "";
    return `
      <div class="opt-gp-row${inactive ? " inactive-block" : ""}" data-opt-gp="${esc(gk)}">
        <div class="opt-gp-title">Galaprodukts ${esc(gpLabel(gp.gpNo, gp.gpName))}</div>
        <div class="opt-gp-measure-list">${listHtml}</div>
        ${expanded}
      </div>
    `;
  }

  function renderProcessBlock(procGroup, inactive, showActions) {
    const pk = procKeyFromParts(procGroup.procNo, procGroup.process);
    const procOpen = procCardOpen.has(pk);
    const gps = procGroup.gps || [];
    const measureCount = gps.reduce((n, g) => n + (g.items || []).length, 0);
    const gpCount = gps.length;
    const body = gps.length
      ? gps.map((g) => renderGpBlock(g, procGroup, inactive, showActions)).join("")
      : `<p class="hint" style="margin:0">Nav optimizācijas pasākumu šim procesam.</p>`;
    return `
      <div class="opt-proc-block${inactive ? " inactive-block" : ""}" data-opt-proc="${esc(pk)}">
        <button type="button" class="opt-proc-picker${procOpen ? " opt-proc-picker--open" : ""}" data-opt-proc="${esc(pk)}">
          <span class="opt-proc-title">Process ${esc(processLabel(procGroup.procNo, procGroup.process))}</span>
          <span class="opt-proc-meta">
            <span class="ex-unit-chip">${gpCount} GP</span>
            <span class="ex-unit-chip">${measureCount} pasākumi</span>
          </span>
          <span class="opt-card-hint">${procOpen ? "Aizvērt kartiņu" : "Atvērt kartiņu"}</span>
        </button>
        ${procOpen ? `<div class="opt-proc-body">${body}</div>` : ""}
      </div>
    `;
  }

  function renderProcessList(groups, inactive, showActions) {
    const list = groups || [];
    if (!list.length) {
      return `<div class="opt-empty-list">${inactive ? "Nav neaktuālu (pabeigtu vai atceltu) pasākumu." : "Nav aktuālu optimizācijas pasākumu. Augšā izmantojiet «+ Jauns optimizācijas pasākums»."}</div>`;
    }
    return list.map((p) => renderProcessBlock(p, inactive, showActions)).join("");
  }

  function findMeasureByKey(key) {
    const all = flattenPasakumi(dbRows);
    return all.find((m) => measureKey(m) === key) || null;
  }

  function paintList(root) {
    if (!root) return;
    const showActions = canEdit();
    let html = "";
    html += `<h4 class="opt-section-hdr">Aktuālie optimizācijas pasākumi</h4>`;
    html += `<div class="ex-parvalde-list">${renderProcessList(cachedActiveGroups, false, showActions)}</div>`;
    html += `<h4 class="opt-section-hdr">Neaktuālie optimizācijas pasākumi</h4>`;
    html += `<p class="hint" style="margin:0 0 8px;font-size:12px">Pasākumi ar statusu «Pabeigts» vai «Atcelts».</p>`;
    html += `<div class="ex-parvalde-list">${renderProcessList(cachedInactiveGroups, true, showActions)}</div>`;
    root.innerHTML = html;
    wireCardList(root);
    const bulkBtn = $(BULK_BTN_ID);
    if (bulkBtn) {
      bulkBtn.textContent = procCardOpen.size > 0 ? "Aizvērt visas kartiņas" : "Atvērt visas kartiņas";
    }
  }

  function findGpContextByKey(gk) {
    const allGroups = (cachedActiveGroups || []).concat(cachedInactiveGroups || []);
    for (let i = 0; i < allGroups.length; i++) {
      const proc = allGroups[i];
      for (let j = 0; j < (proc.gps || []).length; j++) {
        const gp = proc.gps[j];
        if (gpKeyFromParts(proc.procNo, proc.process, gp.gpNo, gp.gpName) === gk) {
          return { procNo: proc.procNo, process: proc.process, gpNo: gp.gpNo, gpName: gp.gpName };
        }
      }
    }
    return null;
  }

  function wireCardList(root) {
    root.querySelectorAll(".opt-proc-picker").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        const pk = btn.getAttribute("data-opt-proc") || "";
        if (procCardOpen.has(pk)) procCardOpen.delete(pk);
        else procCardOpen.add(pk);
        paintList(root);
      };
    });
    root.querySelectorAll(".opt-measure-open-btn").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const key = btn.getAttribute("data-opt-key") || "";
        if (measureCardOpen.has(key)) measureCardOpen.delete(key);
        else {
          measureCardOpen.clear();
          measureCardOpen.add(key);
        }
        paintList(root);
      };
    });
    root.querySelectorAll(".opt-measure-close-btn").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        measureCardOpen.delete(btn.getAttribute("data-opt-key") || "");
        paintList(root);
      };
    });
    root.querySelectorAll(".opt-edit-btn").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const m = findMeasureByKey(btn.getAttribute("data-opt-key") || "");
        if (m) openForm(m);
      };
    });
    root.querySelectorAll(".opt-del-btn").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.stopPropagation();
        const m = findMeasureByKey(btn.getAttribute("data-opt-key") || "");
        if (m) deleteMeasure(m);
      };
    });
  }

  async function loadFromDb() {
    dbWarning = "";
    if (!window.DB || typeof window.DB.loadOptimizacija !== "function") {
      dbRows = [];
      dbWarning = "DB API nav pieejams.";
      return;
    }
    try {
      dbRows = await window.DB.loadOptimizacija();
    } catch (e) {
      dbRows = [];
      dbWarning = (window.DB.mapDbError && window.DB.mapDbError(e)) || String(e.message || e);
    }
  }

  function optimizacijaCardVisible(card) {
    if (!card || card.classList.contains("hidden")) return false;
    if (card.classList.contains("kartina-inline-panel")) return true;
    if (card.classList.contains("nav-page-hidden")) return false;
    return true;
  }

  async function render() {
    const card = $(CARD_ID);
    if (!optimizacijaCardVisible(card)) return;

    ensureEditorModal();
    const { status, root } = ensureShell(card);
    await loadFromDb();

    const measures = flattenPasakumi(dbRows);
    const { active, inactive } = splitMeasures(measures);
    cachedActiveGroups = groupMeasures(active);
    cachedInactiveGroups = groupMeasures(inactive);
    cachedActiveCount = active.length;
    cachedInactiveCount = inactive.length;

    if (dbWarning) {
      status.className = "hint warn";
      status.textContent =
        dbWarning + " Palaidiet migrāciju migrations/2026-09-21_procesu_optimizacija.sql";
    } else {
      status.className = "hint hidden";
      status.textContent = "";
    }

    paintList(root);
  }

  function boot() {
    ensureEditorModal();
    const rs = $("roleSelect");
    if (rs) rs.addEventListener("change", () => {
      const card = $(CARD_ID);
      if (card && !card.classList.contains("hidden")) render();
    });
    const us = $("userSelect");
    if (us) us.addEventListener("change", () => {
      const card = $(CARD_ID);
      if (card && !card.classList.contains("hidden")) render();
    });

    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      const source = ev && ev.detail ? ev.detail.source : "";
      if (source === "html") return;
      if (kind === "all" || kind === "optimizacija" || kind === "process" || kind === "catalog") {
        render();
      }
    });
  }

  window.Optimizacija = {
    render,
    reloadFromDb: loadFromDb,
    flattenPasakumi,
    normStatus,
    isInactive,
    openForm,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
