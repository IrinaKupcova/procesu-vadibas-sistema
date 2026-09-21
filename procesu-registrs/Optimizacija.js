/**
 * Optimizācija — pasākumu saraksts, CRUD, aktuālie / neaktuālie (pabeigtie).
 */
(function () {
  "use strict";

  const CARD_ID = "optimizacijaCard";
  const LIST_ID = "optimizacijaListRoot";
  const STATUS_ID = "optimizacijaStatus";
  const MODAL_ID = "optimizacijaEditorModal";
  const FORM_ID = "optimizacijaEditorForm";
  const FORM_VERSION = "3";
  const ATBILDIGIE_ROOT_ID = "optFormAtbildigieRoot";

  const STATUS = {
    nav_uzsakts: { label: "Nav uzsākts", cls: "opt-st-not-started" },
    izpilde: { label: "Izpildē", cls: "opt-st-in-progress" },
    pabeigts: { label: "Pabeigts", cls: "opt-st-done" },
  };

  let dbRows = [];
  let dbWarning = "";
  let expandedKey = null;
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
    return rs && rs.value === "admin_edit";
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
    if (k === "izpilde" || k.includes("izpild") || k.includes("procesa")) return "izpilde";
    return "nav_uzsakts";
  }

  function statusMeta(raw) {
    const key = normStatus(raw);
    return STATUS[key] || STATUS.nav_uzsakts;
  }

  function isInactive(raw) {
    return normStatus(raw) === "pabeigts";
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

  function normalizePasakums(raw, parent, index) {
    const p = raw && typeof raw === "object" ? raw : {};
    const id = pick(p, ["id", "pasakumaId", "pasakuma_id"]) || `${parent.id || "x"}_${index}`;
    return {
      id,
      nosaukums: pick(p, ["nosaukums", "name", "title", "pasakumaNosaukums"]),
      uzsaksanasDatums: pick(p, ["uzsaksanasDatums", "uzsaksanas_datums", "startDate", "datums"]),
      planotaisIzpildesDatums: pick(p, [
        "planotaisIzpildesDatums",
        "planotais_izpildes_datums",
        "plannedDate",
        "planDatums",
      ]),
      izpildesDatums: pick(p, ["izpildesDatums", "izpildes_datums", "completedDate", "endDate"]),
      statuss: pick(p, ["statuss", "status", "Statuss"]) || "nav_uzsakts",
      atbildigie: normalizeAtbildigieFromRaw(p),
      pieteiktsRz: pick(p, ["pieteiktsRz", "pieteikts_rz", "pietiekosaRz", "pietiekotaRz", "pietiekota_rz", "rz", "RZ"]),
      apraksts: pick(p, ["apraksts", "Apraksts", "description"]),
      izpildesGaita: pick(p, ["izpildesGaita", "izpildes_gaita", "gaita"]),
      createdAt: pick(p, ["createdAt", "created_at"]) || parent.updatedAt || "",
      procNo: parent.procNo,
      process: parent.process,
      gpNo: parent.gpNo,
      gpName: parent.gpName,
      parentId: parent.id,
    };
  }

  function pasakumsToRaw(p) {
    const status = normStatus(p.statuss);
    let izpildesDatums = p.izpildesDatums || "";
    if (status === "pabeigts" && !izpildesDatums) {
      izpildesDatums = new Date().toISOString().slice(0, 10);
    }
    const atbildigie = (Array.isArray(p.atbildigie) ? p.atbildigie : [])
      .map((a) => ({
        parvalde: String(a.parvalde || "").trim() || null,
        dala: String(a.dala || "").trim() || null,
        vardsUzvards: String(a.vardsUzvards || "").trim() || null,
      }))
      .filter((a) => a.parvalde || a.dala || a.vardsUzvards);
    return {
      id: p.id,
      nosaukums: p.nosaukums,
      uzsaksanasDatums: p.uzsaksanasDatums || null,
      planotaisIzpildesDatums: p.planotaisIzpildesDatums || null,
      izpildesDatums: izpildesDatums || null,
      statuss: status,
      atbildigie,
      pieteiktsRz: String(p.pieteiktsRz || "").trim() || null,
      apraksts: String(p.apraksts || "").trim() || null,
      izpildesGaita: String(p.izpildesGaita || "").trim() || null,
      createdAt: p.createdAt || new Date().toISOString(),
    };
  }

  function listDate(p) {
    return p.uzsaksanasDatums || p.planotaisIzpildesDatums || p.createdAt || "";
  }

  function sortDateMs(p) {
    return (
      parseDateMs(p.uzsaksanasDatums) ||
      parseDateMs(p.planotaisIzpildesDatums) ||
      parseDateMs(p.createdAt)
    );
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
    if (procNo && process) return `${procNo} — ${process}`;
    return procNo || process || "—";
  }

  function gpLabel(gpNo, gpName) {
    if (gpNo && gpName) return `${gpNo} — ${gpName}`;
    return gpName || gpNo || "—";
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

  function formatMultilineHtml(text) {
    const t = String(text || "").trim();
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
        font-size:15px; font-weight:700; color:#1e293b; margin:0 0 8px;
        padding-bottom:6px; border-bottom:2px solid #cbd5e1;
      }
      .opt-section-hdr.inactive { color:#64748b; border-bottom-color:#e2e8f0; }
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
    let btn = $("optimizacijaCreateBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.id = "optimizacijaCreateBtn";
      btn.className = "secondary";
      btn.textContent = "Izveidot jaunu optimizācijas pasākumu";
      right.appendChild(btn);
    }
    btn.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      openForm(null);
    };
    const editable = canEdit();
    btn.disabled = !editable;
    btn.classList.remove("hidden");
    btn.title = editable ? "" : "Pieejams tikai lomai «administrators (labot)»";
  }

  function renderAtbildigieRow(a, idx, showRemove) {
    return `
      <div class="opt-atb-row" data-atb-idx="${idx}">
        <input type="text" class="opt-atb-parvalde" placeholder="Pārvalde" value="${esc(a.parvalde || "")}" />
        <input type="text" class="opt-atb-dala" placeholder="Daļa" value="${esc(a.dala || "")}" />
        <input type="text" class="opt-atb-name" placeholder="Vārds, uzvārds" value="${esc(a.vardsUzvards || "")}" />
        <button type="button" class="secondary opt-atb-rm" title="Noņemt"${showRemove ? "" : ' style="visibility:hidden"'}>×</button>
      </div>
    `;
  }

  function populateAtbildigieForm(list) {
    const root = $(ATBILDIGIE_ROOT_ID);
    if (!root) return;
    const items = Array.isArray(list) && list.length ? list : [defaultAtbildigais()];
    root.innerHTML = items
      .map((a, idx) => renderAtbildigieRow(a, idx, items.length > 1))
      .join("");
    wireAtbildigieRows(root);
  }

  function wireAtbildigieRows(root) {
    root.querySelectorAll(".opt-atb-rm").forEach((btn) => {
      btn.onclick = () => {
        const rows = root.querySelectorAll(".opt-atb-row");
        if (rows.length <= 1) return;
        btn.closest(".opt-atb-row")?.remove();
        root.querySelectorAll(".opt-atb-row").forEach((row, idx) => {
          row.setAttribute("data-atb-idx", String(idx));
          const rm = row.querySelector(".opt-atb-rm");
          if (rm) rm.style.visibility = root.querySelectorAll(".opt-atb-row").length > 1 ? "visible" : "hidden";
        });
      };
    });
  }

  function addAtbildigaisRow() {
    const root = $(ATBILDIGIE_ROOT_ID);
    if (!root) return;
    const current = collectAtbildigieFromForm();
    current.push(defaultAtbildigais());
    populateAtbildigieForm(current);
  }

  function collectAtbildigieFromForm() {
    const root = $(ATBILDIGIE_ROOT_ID);
    if (!root) return [defaultAtbildigais()];
    const out = [];
    root.querySelectorAll(".opt-atb-row").forEach((row) => {
      out.push({
        parvalde: (row.querySelector(".opt-atb-parvalde")?.value || "").trim(),
        dala: (row.querySelector(".opt-atb-dala")?.value || "").trim(),
        vardsUzvards: (row.querySelector(".opt-atb-name")?.value || "").trim(),
      });
    });
    return out.length ? out : [defaultAtbildigais()];
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
              <label for="optFormProc">Process *</label>
              <select id="optFormProc" required></select>
            </div>
            <div class="opt-form-span2">
              <label for="optFormGp">Galaprodukts (GP) *</label>
              <select id="optFormGp" required></select>
            </div>
            <div class="opt-form-span2">
              <label for="optFormNosaukums">Pasākuma nosaukums *</label>
              <input id="optFormNosaukums" type="text" required />
            </div>
            <div>
              <label for="optFormUzsak">Pasākuma uzsākšanas datums</label>
              <input id="optFormUzsak" type="date" />
            </div>
            <div>
              <label for="optFormPlans">Plānotais izpildes datums</label>
              <input id="optFormPlans" type="date" />
            </div>
            <div>
              <label for="optFormIzpilde">Izpildes datums</label>
              <input id="optFormIzpilde" type="date" />
            </div>
            <div>
              <label for="optFormStatuss">Statuss *</label>
              <select id="optFormStatuss" required>
                <option value="nav_uzsakts">Nav uzsākts</option>
                <option value="izpilde">Izpildē</option>
                <option value="pabeigts">Pabeigts</option>
              </select>
            </div>
            <div class="opt-form-section">Atbildīgie</div>
            <div class="opt-form-span2">
              <div id="${ATBILDIGIE_ROOT_ID}" class="opt-atb-list"></div>
              <button type="button" class="secondary" id="optFormAddAtbildigais">+ Pievienot atbildīgo</button>
            </div>
            <div class="opt-form-section">Pieteikts RZ</div>
            <div class="opt-form-span2">
              <textarea id="optFormRz" rows="4" placeholder="Informācija par pieteikto RZ" aria-label="Pieteikts RZ"></textarea>
            </div>
            <div class="opt-form-section">Apraksts</div>
            <div class="opt-form-span2">
              <textarea id="optFormApraksts" rows="5" placeholder="Detalizēts pasākuma apraksts" aria-label="Apraksts"></textarea>
            </div>
            <div class="opt-form-section">Izpildes gaita</div>
            <div class="opt-form-span2">
              <textarea id="optFormGaita" rows="5" placeholder="Pašreizējais statuss, soļi, piezīmes par izpildi" aria-label="Izpildes gaita"></textarea>
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
    $("optFormStatuss").onchange = () => {
      const st = normStatus($("optFormStatuss").value);
      if (st === "pabeigts" && !$("optFormIzpilde").value) {
        $("optFormIzpilde").value = new Date().toISOString().slice(0, 10);
      }
    };
    $("optFormAddAtbildigais").onclick = () => addAtbildigaisRow();
    populateAtbildigieForm([defaultAtbildigais()]);
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
      alert("Labošana pieejama tikai administratoram (labot). Iestatījumos izvēlieties lomu «administrators (labot)».");
      return;
    }
    try {
      ensureEditorModal();
      const modal = $(MODAL_ID);
      if (!modal) {
        statusMsg("Neizdevās atvērt formu (modālais logs nav pieejams).", "error");
        return;
      }
      editingMeasure = measure ? { ...measure } : null;
      $("optimizacijaEditorTitle").textContent = measure
        ? "Labot optimizācijas pasākumu"
        : "Jauns optimizācijas pasākums";
      populateProcSelect(measure ? measure.procNo : "");
      const procVal = measure ? `${measure.procNo}|||${measure.process}` : "";
      if ($("optFormProc")) $("optFormProc").value = procVal;
      populateGpSelect(procVal, measure ? measure.gpNo : "", measure ? measure.gpName : "");
      if (measure && $("optFormGp")) {
        $("optFormGp").value = `${measure.gpNo}|||${measure.gpName}`;
      }
      if ($("optFormNosaukums")) $("optFormNosaukums").value = measure ? measure.nosaukums : "";
      if ($("optFormUzsak")) $("optFormUzsak").value = measure ? toInputDate(measure.uzsaksanasDatums) : "";
      if ($("optFormPlans")) $("optFormPlans").value = measure ? toInputDate(measure.planotaisIzpildesDatums) : "";
      if ($("optFormIzpilde")) $("optFormIzpilde").value = measure ? toInputDate(measure.izpildesDatums) : "";
      if ($("optFormStatuss")) $("optFormStatuss").value = measure ? normStatus(measure.statuss) : "nav_uzsakts";
      populateAtbildigieForm(measure ? measure.atbildigie : [defaultAtbildigais()]);
      if ($("optFormRz")) $("optFormRz").value = measure ? measure.pieteiktsRz : "";
      if ($("optFormApraksts")) $("optFormApraksts").value = measure ? measure.apraksts : "";
      if ($("optFormGaita")) $("optFormGaita").value = measure ? measure.izpildesGaita : "";
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

    const measure = {
      id: editingMeasure ? editingMeasure.id : newPasakumsId(),
      nosaukums,
      uzsaksanasDatums: elVal("optFormUzsak"),
      planotaisIzpildesDatums: elVal("optFormPlans"),
      izpildesDatums: elVal("optFormIzpilde"),
      statuss: elVal("optFormStatuss"),
      atbildigie: collectAtbildigieFromForm(),
      pieteiktsRz: elVal("optFormRz"),
      apraksts: elVal("optFormApraksts"),
      izpildesGaita: elVal("optFormGaita"),
      createdAt: editingMeasure ? editingMeasure.createdAt : new Date().toISOString(),
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
      expandedKey = `${findParentByProcGp(procNo, process, gpNo, gpName)?.id || "new"}:${measure.id}`;
      await render();
    } catch (e) {
      const msg = (window.DB && window.DB.mapDbError && window.DB.mapDbError(e)) || String(e.message || e);
      statusMsg("Neizdevās saglabāt: " + msg, "error");
    }
  }

  async function deleteMeasure(measure) {
    if (!canEdit()) return;
    if (!confirm(`Dzēst optimizācijas pasākumu «${measure.nosaukums || "—"}»?`)) return;
    const parent = findParentById(measure.parentId);
    if (!parent) {
      statusMsg("Ieraksts nav atrasts.", "error");
      return;
    }
    try {
      await removePasakumsFromParent(parent, measure.id);
      if (expandedKey === measureKey(measure)) expandedKey = null;
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

  function renderAtbildigieDetail(list) {
    const items = (list || []).filter((a) => a.parvalde || a.dala || a.vardsUzvards);
    if (!items.length) return '<span class="val muted">—</span>';
    return items.map((a) => `<div class="opt-atb-line">${esc(atbildigaisLine(a))}</div>`).join("");
  }

  function renderDetailCard(p) {
    const st = statusMeta(p.statuss);
    return `
      <div class="opt-detail-card">
        <div class="opt-detail-grid">
          <div class="opt-detail-field">
            <label>Pasākuma uzsākšanas datums</label>
            <div class="val">${esc(formatDate(p.uzsaksanasDatums))}</div>
          </div>
          <div class="opt-detail-field">
            <label>Plānotais izpildes datums</label>
            <div class="val">${esc(formatDate(p.planotaisIzpildesDatums))}</div>
          </div>
          <div class="opt-detail-field">
            <label>Izpildes datums</label>
            <div class="val">${esc(formatDate(p.izpildesDatums))}</div>
          </div>
          <div class="opt-detail-field">
            <label>Statuss</label>
            <div class="val"><span class="opt-status-pill ${st.cls}">${esc(st.label)}</span></div>
          </div>
          <div class="opt-detail-field" style="grid-column:1/-1">
            <label>Atbildīgie (pārvalde, daļa · vārds, uzvārds)</label>
            <div class="val">${renderAtbildigieDetail(p.atbildigie)}</div>
          </div>
          <div class="opt-detail-field" style="grid-column:1/-1">
            <label>Pieteikts RZ</label>
            ${formatMultilineHtml(p.pieteiktsRz)}
          </div>
          <div class="opt-detail-field" style="grid-column:1/-1">
            <label>Apraksts</label>
            ${formatMultilineHtml(p.apraksts)}
          </div>
          <div class="opt-detail-field" style="grid-column:1/-1">
            <label>Izpildes gaita</label>
            ${formatMultilineHtml(p.izpildesGaita)}
          </div>
        </div>
      </div>
    `;
  }

  function renderMeasureRow(p, showActions) {
    const key = measureKey(p);
    const open = expandedKey === key;
    const st = statusMeta(p.statuss);
    const title = p.nosaukums || "—";
    const actions = showActions
      ? `<div class="opt-actions">
          <button type="button" class="secondary opt-edit-btn" data-opt-key="${esc(key)}">Labot</button>
          <button type="button" class="secondary opt-del-btn" data-opt-key="${esc(key)}">Dzēst</button>
        </div>`
      : "";
    const colSpan = showActions ? 6 : 5;
    return `
      <tr class="opt-measure-row${open ? " open" : ""}" data-opt-key="${esc(key)}">
        <td class="opt-date">${esc(formatDate(listDate(p)))}</td>
        <td class="opt-title">${esc(title)}</td>
        <td class="opt-meta">${esc(processLabel(p.procNo, p.process))}</td>
        <td class="opt-meta">${esc(gpLabel(p.gpNo, p.gpName))}</td>
        <td><span class="opt-status-pill ${st.cls}">${esc(st.label)}</span></td>
        ${showActions ? `<td>${actions}</td>` : ""}
      </tr>
      ${open ? `<tr class="opt-detail-row"><td colspan="${colSpan}">${renderDetailCard(p)}</td></tr>` : ""}
    `;
  }

  function renderGroupedList(groups, inactive, showActions) {
    if (!groups.length) {
      return `<div class="opt-empty-list">${inactive ? "Nav neaktuālu (pabeigtu) pasākumu." : "Nav aktuālu optimizācijas pasākumu."}</div>`;
    }
    const blockCls = inactive ? " opt-proc-group inactive-block" : " opt-proc-group";
    return groups
      .map(
        (proc) => `
      <div class="${blockCls.trim()}">
        <div class="opt-proc-hdr">${esc(processLabel(proc.procNo, proc.process))}</div>
        ${proc.gps
          .map(
            (gp) => `
          <div class="opt-gp-block">
            <div class="opt-gp-hdr">${esc(gpLabel(gp.gpNo, gp.gpName))}</div>
            <table class="opt-measure-table">
              <thead>
                <tr>
                  <th>Datums</th>
                  <th>Pasākuma nosaukums</th>
                  <th>Process</th>
                  <th>GP</th>
                  <th>Statuss</th>
                  ${showActions ? "<th>Darbības</th>" : ""}
                </tr>
              </thead>
              <tbody>
                ${gp.items.map((p) => renderMeasureRow(p, showActions)).join("")}
              </tbody>
            </table>
          </div>
        `
          )
          .join("")}
      </div>
    `
      )
      .join("");
  }

  function findMeasureByKey(key) {
    const all = flattenPasakumi(dbRows);
    return all.find((m) => measureKey(m) === key) || null;
  }

  function paintList(root) {
    const showActions = canEdit();
    let html = "";
    html += `<h4 class="opt-section-hdr">Aktuālie optimizācijas pasākumi</h4>`;
    html += renderGroupedList(cachedActiveGroups, false, showActions);
    html += `<h4 class="opt-section-hdr inactive">Neaktuālie optimizācijas pasākumi</h4>`;
    html += `<p class="hint" style="margin:0 0 8px;font-size:12px">Šeit tiek rādīti pasākumi ar statusu «Pabeigts».</p>`;
    html += renderGroupedList(cachedInactiveGroups, true, showActions);
    root.innerHTML = html;
    wireRows(root);
  }

  function wireRows(root) {
    root.querySelectorAll(".opt-measure-row").forEach((row) => {
      row.onclick = (ev) => {
        if (ev.target.closest(".opt-actions")) return;
        const key = row.getAttribute("data-opt-key") || "";
        expandedKey = expandedKey === key ? null : key;
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

  async function render() {
    const card = $(CARD_ID);
    if (!card || card.classList.contains("hidden") || card.classList.contains("nav-page-hidden")) return;

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
      status.className = "hint";
      status.textContent = `Aktuālie: ${cachedActiveCount} · Neaktuālie (pabeigtie): ${cachedInactiveCount}. Secība: jaunākie vispirms; sadalījums pēc procesa un GP.`;
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
    openForm,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
