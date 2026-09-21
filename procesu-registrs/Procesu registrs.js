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
    const byName = new Map();
    (rawList || []).forEach((r) => {
      const joma = String((r && r.darbibasJoma) || "").trim();
      const productsField = (r && r.products) != null ? r.products : "";
      const tokens = splitProductValues(productsField).map(sanitizeGpName).filter(Boolean);
      const typeNos = gpTypeNosFromRaw(r);
      const procNo = String((r && r.processNo) || "").trim();
      tokens.forEach((name, idx) => {
        const key = normTextKey(name);
        if (!key) return;
        const typeNo = String(typeNos[idx] || "").trim();
        if (!byName.has(key)) {
          byName.set(key, {
            name,
            typeNosSet: new Set(),
            jomaSet: new Set(),
            procNo,
          });
        }
        const item = byName.get(key);
        if (typeNo) item.typeNosSet.add(typeNo);
        if (joma) item.jomaSet.add(joma);
        if (!item.procNo && procNo) item.procNo = procNo;
      });
    });
    return Array.from(byName.values()).map((it) => ({
      name: it.name,
      typeNosText: Array.from(it.typeNosSet).join(", "),
      jomaText: Array.from(it.jomaSet).join(", "),
      executorText: "",
      procNo: String(it.procNo || "").trim(),
    }));
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

  const KARTINA_CSS_ID = "prKartinaExtraCss";
  let optDbCache = null;
  let optDbLoading = null;

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normStatusKey(raw) {
    if (window.Optimizacija && typeof window.Optimizacija.normStatus === "function") {
      return window.Optimizacija.normStatus(raw);
    }
    const k = normTextKey(raw).replace(/[\s-]+/g, "_");
    if (k.includes("pabeig")) return "pabeigts";
    if (k.includes("izpild")) return "izpilde";
    return "nav_uzsakts";
  }

  function statusLabel(key) {
    if (key === "pabeigts") return "Pabeigts";
    if (key === "izpilde") return "Izpildē";
    return "Nav uzsākts";
  }

  function statusClass(key) {
    if (key === "pabeigts") return "pr-k-st-done";
    if (key === "izpilde") return "pr-k-st-progress";
    return "pr-k-st-new";
  }

  function formatListDate(v) {
    if (!v) return "—";
    const t = Date.parse(String(v));
    if (Number.isNaN(t)) return String(v);
    try {
      return new Date(t).toLocaleDateString("lv-LV");
    } catch (_) {
      return String(v);
    }
  }

  function elTrim(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function ensureKartinaStyles() {
    if ($(KARTINA_CSS_ID)) return;
    const s = document.createElement("style");
    s.id = KARTINA_CSS_ID;
    s.textContent = `
      .pr-k-opt-list { margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:8px; }
      .pr-k-opt-item {
        border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; background:#f8fafc;
        display:flex; flex-wrap:wrap; gap:8px; align-items:center;
      }
      .pr-k-opt-item .pr-k-date { font-size:12px; font-weight:700; color:#475569; white-space:nowrap; }
      .pr-k-opt-item .pr-k-title { font-weight:600; color:#0f172a; flex:1 1 160px; }
      .pr-k-opt-item .pr-k-gp { font-size:12px; color:#64748b; }
      .pr-k-opt-pill {
        font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; white-space:nowrap;
      }
      .pr-k-st-new { background:#e2e8f0; color:#475569; }
      .pr-k-st-progress { background:#fef3c7; color:#b45309; }
      .pr-k-st-done { background:#dcfce7; color:#15803d; }
      .pr-k-opt-sub { font-size:12px; font-weight:700; color:#334155; margin:12px 0 6px; }
      .pr-k-opt-sub.inactive { color:#64748b; }
      .pr-k-empty { font-size:13px; color:#64748b; font-style:italic; margin:4px 0; }
      .pr-k-metrics-box {
        border:1px dashed #cbd5e1; border-radius:8px; padding:12px; background:#f8fafc; font-size:13px;
      }
      .pr-k-metrics-box label { display:block; font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px; text-transform:uppercase; }
      .pr-k-pre { white-space:pre-wrap; word-break:break-word; color:#0f172a; margin:0; }
      .pr-k-opt-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
    `;
    document.head.appendChild(s);
  }

  function injectKartinaSection(formId, prefix, titleOpt, titleMer) {
    const form = $(formId);
    if (!form) return;
    const actions = form.querySelector(".editor-actions");
    if (!actions) return;

    if (!$(prefix + "OptEditorWrap")) {
      const optSec = document.createElement("div");
      optSec.className = "editor-section";
      optSec.id = prefix + "OptEditorWrap";
      optSec.innerHTML = `
        <h3 class="editor-section-title">${titleOpt}</h3>
        <div id="${prefix}OptPasakumiRoot"></div>
        <div class="pr-k-opt-actions">
          <button type="button" class="secondary" id="${prefix}OptAddBtn">+ Jauns optimizācijas pasākums</button>
          <button type="button" class="secondary" id="${prefix}OptNavBtn">Atvērt optimizācijas sadaļu</button>
        </div>
      `;
      form.insertBefore(optSec, actions);
    }

    if (!$(prefix + "MerijumiEditorWrap")) {
      const merSec = document.createElement("div");
      merSec.className = "editor-section";
      merSec.id = prefix + "MerijumiEditorWrap";
      merSec.innerHTML = `
        <h3 class="editor-section-title">${titleMer}</h3>
        <div id="${prefix}MerijumiRoot" class="pr-k-metrics-box"></div>
      `;
      form.insertBefore(merSec, actions);
    }
  }

  function ensureKartinaSections() {
    ensureKartinaStyles();
    injectKartinaSection("editorForm", "e", "Optimizācija", "Mērījumi / procesu rādītāji");
    injectKartinaSection("catalogEditorForm", "c", "Optimizācija", "Mērījumi / procesu rādītāji");
    wireKartinaButtonsOnce();
  }

  async function loadOptimizacijaRows() {
    if (optDbCache) return optDbCache;
    if (optDbLoading) return optDbLoading;
    if (!window.DB || typeof window.DB.loadOptimizacija !== "function") return [];
    optDbLoading = window.DB.loadOptimizacija()
      .then((rows) => {
        optDbCache = Array.isArray(rows) ? rows : [];
        optDbLoading = null;
        return optDbCache;
      })
      .catch(() => {
        optDbCache = [];
        optDbLoading = null;
        return [];
      });
    return optDbLoading;
  }

  function flattenMeasures(dbRows) {
    if (window.Optimizacija && typeof window.Optimizacija.flattenPasakumi === "function") {
      return window.Optimizacija.flattenPasakumi(dbRows);
    }
    const out = [];
    (dbRows || []).forEach((parent) => {
      const pasakumi = Array.isArray(parent.pasakumi) ? parent.pasakumi : [];
      pasakumi.forEach((p, index) => {
        out.push(
          Object.assign({}, p, {
            procNo: parent.procNo,
            process: parent.process,
            gpNo: parent.gpNo,
            gpName: parent.gpName,
            parentId: parent.id,
            id: p.id || `${parent.id || "x"}_${index}`,
          })
        );
      });
    });
    return out;
  }

  function matchesProcessMeasure(m, procNo, process) {
    if (procNo && normTextKey(m.procNo) === normTextKey(procNo)) return true;
    if (process && normTextKey(m.process) === normTextKey(process)) return true;
    return false;
  }

  function matchesGpMeasure(m, procNo, process, gpNo, gpName) {
    if (!matchesProcessMeasure(m, procNo, process)) return false;
    if (gpName && normTextKey(m.gpName) === normTextKey(gpName)) return true;
    if (gpNo && normTextKey(m.gpNo) === normTextKey(gpNo)) return true;
    return false;
  }

  function sortMeasures(list) {
    return (list || []).slice().sort((a, b) => {
      const da =
        Date.parse(String(a.uzsaksanasDatums || a.planotaisIzpildesDatums || a.createdAt || "")) || 0;
      const db =
        Date.parse(String(b.uzsaksanasDatums || b.planotaisIzpildesDatums || b.createdAt || "")) || 0;
      return db - da;
    });
  }

  function renderMeasureItem(m, showGp) {
    const st = normStatusKey(m.statuss);
    const date = formatListDate(m.uzsaksanasDatums || m.planotaisIzpildesDatums || m.createdAt);
    const gpPart = showGp
      ? `<span class="pr-k-gp">${escHtml(m.gpNo ? m.gpNo + " — " : "")}${escHtml(m.gpName || "—")}</span>`
      : "";
    const editBtn =
      typeof window.canEdit === "function" && window.canEdit()
        ? `<button type="button" class="secondary pr-k-opt-edit" data-parent="${escHtml(m.parentId)}" data-mid="${escHtml(m.id)}">Labot</button>`
        : `<button type="button" class="secondary pr-k-opt-view" data-parent="${escHtml(m.parentId)}" data-mid="${escHtml(m.id)}">Skatīt</button>`;
    return `<li class="pr-k-opt-item">
      <span class="pr-k-date">${escHtml(date)}</span>
      <span class="pr-k-title">${escHtml(m.nosaukums || "—")}</span>
      ${gpPart}
      <span class="pr-k-opt-pill ${statusClass(st)}">${escHtml(statusLabel(st))}</span>
      ${editBtn}
    </li>`;
  }

  function renderOptListHtml(measures, showGp) {
    const active = sortMeasures(measures.filter((m) => normStatusKey(m.statuss) !== "pabeigts"));
    const inactive = sortMeasures(measures.filter((m) => normStatusKey(m.statuss) === "pabeigts"));
    let html = `<div class="pr-k-opt-sub">Aktuālie optimizācijas pasākumi</div>`;
    if (!active.length) {
      html += `<p class="pr-k-empty">Nav aktuālu pasākumu šim ${showGp ? "galaproduktam" : "procesam"}.</p>`;
    } else {
      html += `<ul class="pr-k-opt-list">${active.map((m) => renderMeasureItem(m, showGp)).join("")}</ul>`;
    }
    html += `<div class="pr-k-opt-sub inactive">Neaktuālie optimizācijas pasākumi (pabeigti)</div>`;
    if (!inactive.length) {
      html += `<p class="pr-k-empty">Nav pabeigtu pasākumu.</p>`;
    } else {
      html += `<ul class="pr-k-opt-list">${inactive.map((m) => renderMeasureItem(m, showGp)).join("")}</ul>`;
    }
    return html;
  }

  function findMeasureByIds(dbRows, parentId, measureId) {
    const flat = flattenMeasures(dbRows);
    return flat.find((m) => String(m.parentId) === String(parentId) && String(m.id) === String(measureId)) || null;
  }

  function wireOptListButtons(root, dbRows) {
    if (!root) return;
    root.querySelectorAll(".pr-k-opt-edit, .pr-k-opt-view").forEach((btn) => {
      btn.onclick = () => {
        const m = findMeasureByIds(dbRows, btn.getAttribute("data-parent"), btn.getAttribute("data-mid"));
        if (m && window.Optimizacija && typeof window.Optimizacija.openForm === "function") {
          window.Optimizacija.openForm(m);
        }
      };
    });
  }

  function renderProcessMetrics() {
    const root = $("eMerijumiRoot");
    if (!root) return;
    const other = elTrim("eOther");
    const legacyOpt = elTrim("eOpt");
    const parts = [];
    if (legacyOpt) {
      parts.push(`<div><label>Optimizācija (reģistra lauks)</label><p class="pr-k-pre">${escHtml(legacyOpt)}</p></div>`);
    }
    parts.push(`<div><label>Citi procesu rādītāji</label><p class="pr-k-pre">${escHtml(other || "—")}</p></div>`);
    parts.push(`<p class="hint" style="margin:8px 0 0">Paplašināta mērījumu un rādītāju ievade tiks attīstīta šajā blokā.</p>`);
    root.innerHTML = parts.join("");
  }

  function renderGpMetrics() {
    const root = $("cMerijumiRoot");
    if (!root) return;
    root.innerHTML = `
      <p class="pr-k-pre">Galaprodukta mērījumi un rādītāji tiks attēloti šeit (saistībā ar procesu un GP).</p>
      <p class="hint" style="margin:8px 0 0">Pagaidām skatiet procesa kartiņas sadaļu «Mērījumi / procesu rādītāji» un navigāciju «Mērījumi/ procesu rādītāji».</p>
    `;
  }

  async function refreshProcessKartinaBlocks() {
    ensureKartinaSections();
    const root = $("eOptPasakumiRoot");
    const card = $("editorCard");
    if (!root || !card || card.classList.contains("hidden")) return;

    const procNo = elTrim("eProcNo");
    const process = elTrim("eProcess");
    if (!procNo && !process) {
      root.innerHTML = `<p class="pr-k-empty">Norādiet procesa Nr. vai nosaukumu, lai rādītu optimizācijas pasākumus.</p>`;
      renderProcessMetrics();
      return;
    }

    root.innerHTML = `<p class="hint">Ielādē optimizācijas pasākumus…</p>`;
    const dbRows = await loadOptimizacijaRows();
    const measures = flattenMeasures(dbRows).filter((m) => matchesProcessMeasure(m, procNo, process));
    root.innerHTML = renderOptListHtml(measures, true);
    wireOptListButtons(root, dbRows);
    renderProcessMetrics();
  }

  async function refreshGpKartinaBlocks() {
    ensureKartinaSections();
    const root = $("cOptPasakumiRoot");
    const card = $("catalogEditorCard");
    if (!root || !card || card.classList.contains("hidden")) return;

    const procNo = elTrim("cProcNo");
    const process = elTrim("cProcess");
    const gpNo = elTrim("cTypeNo");
    const gpName = elTrim("cType");

    if (!gpName && !gpNo) {
      root.innerHTML = `<p class="pr-k-empty">Norādiet galaprodukta nosaukumu vai Nr., lai rādītu optimizācijas pasākumus.</p>`;
      renderGpMetrics();
      return;
    }

    root.innerHTML = `<p class="hint">Ielādē optimizācijas pasākumus…</p>`;
    const dbRows = await loadOptimizacijaRows();
    const measures = flattenMeasures(dbRows).filter((m) => matchesGpMeasure(m, procNo, process, gpNo, gpName));
    root.innerHTML = renderOptListHtml(measures, false);
    wireOptListButtons(root, dbRows);
    renderGpMetrics();
  }

  function openOptimizacijaNav() {
    const btn = document.querySelector(".side-nav-jump[data-scroll-target='optimizacijaCard']");
    if (btn) btn.click();
    else if (window.Optimizacija && typeof window.Optimizacija.render === "function") {
      window.Optimizacija.render();
    }
  }

  function openNewOptFromProcess() {
    const procNo = elTrim("eProcNo");
    const process = elTrim("eProcess");
    if (!procNo && !process) {
      alert("Norādiet procesa Nr. vai nosaukumu.");
      return;
    }
    if (window.Optimizacija && typeof window.Optimizacija.openForm === "function") {
      window.Optimizacija.openForm({ procNo, process, gpNo: "", gpName: "" });
    } else {
      openOptimizacijaNav();
    }
  }

  function openNewOptFromGp() {
    const procNo = elTrim("cProcNo");
    const process = elTrim("cProcess");
    const gpNo = elTrim("cTypeNo");
    const gpName = elTrim("cType");
    if (!gpName && !gpNo) {
      alert("Norādiet galaprodukta nosaukumu vai Nr.");
      return;
    }
    if (window.Optimizacija && typeof window.Optimizacija.openForm === "function") {
      window.Optimizacija.openForm({ procNo, process, gpNo, gpName });
    } else {
      openOptimizacijaNav();
    }
  }

  function wireKartinaButtonsOnce() {
    const pairs = [
      ["eOptAddBtn", openNewOptFromProcess],
      ["eOptNavBtn", openOptimizacijaNav],
      ["cOptAddBtn", openNewOptFromGp],
      ["cOptNavBtn", openOptimizacijaNav],
    ];
    pairs.forEach(([id, fn]) => {
      const btn = $(id);
      if (btn && !btn.dataset.prKartinaBound) {
        btn.dataset.prKartinaBound = "1";
        btn.addEventListener("click", fn);
      }
    });
  }

  function observeKartinaCard(cardId, refreshFn) {
    const card = $(cardId);
    if (!card || card.dataset.prKartinaObs) return;
    card.dataset.prKartinaObs = "1";
    const obs = new MutationObserver(() => {
      if (!card.classList.contains("hidden")) refreshFn();
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function invalidateOptCache() {
    optDbCache = null;
    optDbLoading = null;
  }

  function setupKartinaExtras() {
    ensureKartinaSections();
    observeKartinaCard("editorCard", refreshProcessKartinaBlocks);
    observeKartinaCard("catalogEditorCard", refreshGpKartinaBlocks);

    ["eProcNo", "eProcess", "eOther", "eOpt"].forEach((id) => {
      const el = $(id);
      if (el && !el.dataset.prKartinaInput) {
        el.dataset.prKartinaInput = "1";
        el.addEventListener("input", () => {
          if ($("editorCard") && !$("editorCard").classList.contains("hidden")) {
            refreshProcessKartinaBlocks();
          }
        });
      }
    });
    ["cProcNo", "cProcess", "cTypeNo", "cType", "cProcessPick"].forEach((id) => {
      const el = $(id);
      if (el && !el.dataset.prKartinaInput) {
        el.dataset.prKartinaInput = "1";
        const refreshGp = () => {
          if ($("catalogEditorCard") && !$("catalogEditorCard").classList.contains("hidden")) {
            refreshGpKartinaBlocks();
          }
        };
        el.addEventListener("input", refreshGp);
        el.addEventListener("change", refreshGp);
      }
    });

    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      if (kind === "all" || kind === "optimizacija" || kind === "process" || kind === "catalog") {
        invalidateOptCache();
        if ($("editorCard") && !$("editorCard").classList.contains("hidden")) refreshProcessKartinaBlocks();
        if ($("catalogEditorCard") && !$("catalogEditorCard").classList.contains("hidden")) {
          refreshGpKartinaBlocks();
        }
      }
    });
  }

  window.refreshProcessKartinaBlocks = refreshProcessKartinaBlocks;
  window.refreshGpKartinaBlocks = refreshGpKartinaBlocks;

  /** false = Pamatskats, true = Pilnais skats (ar GP kolonnām). */
  let procRegFullView = false;
  const __prAccordionExpandedKeys = new Set();
  let __prAccordionDelegationBound = false;

  function hideLegacyViewControls() {
    const lvl = $("processLevelWrap");
    if (lvl) {
      lvl.classList.add("hidden");
      lvl.style.display = "none";
    }
    const acc = $("accordionToggleAllBtn");
    if (acc) {
      acc.classList.add("hidden");
      acc.style.display = "none";
    }
  }

  function refreshProcRegViewToggleLabel() {
    const btn = $("toggleProcessDetailBtn");
    if (btn) btn.textContent = procRegFullView ? "Atvērt pamatskatu" : "Atvērt pilno skatu";
    const card = $("processListCard");
    if (card) card.classList.toggle("process-detail-open", !!procRegFullView);
  }

  function patchProcRegViewToggleButton() {
    const btn = $("toggleProcessDetailBtn");
    if (!btn || btn.dataset.prViewPatched) return;
    btn.dataset.prViewPatched = "1";
    btn.onclick = () => {
      procRegFullView = !procRegFullView;
      refreshProcRegViewToggleLabel();
      if (typeof window.renderTable === "function") window.renderTable();
    };
    refreshProcRegViewToggleLabel();
  }

  function getFilteredProcessRows() {
    const q = ($("searchInput") && $("searchInput").value.trim().toLowerCase()) || "";
    const gf = $("groupFilter") ? $("groupFilter").value : "";
    let mergedRows =
      typeof window.getMergedProcessRegisterRows === "function"
        ? window.getMergedProcessRegisterRows() || []
        : [];
    return mergedRows
      .filter((r) => {
        return (
          (!gf || r.group === gf) &&
          (!q ||
            [
              r.group,
              r.processNo,
              r.process,
              r.darbibasJoma,
              r.jomaSearchText,
              r.input,
              r.executorPatstaviga,
              r.executorDala,
              r.productsText,
              r.productTypes,
              r.typeNos,
              r.relatedProcesses,
              r.services,
              r.flowcharts,
              r.itResources,
              r.optimization,
              r.otherMetrics,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q))
        );
      })
      .sort((a, b) =>
        String(a && a.process || "").localeCompare(String(b && b.process || ""), "lv", {
          sensitivity: "base",
        })
      );
  }

  function readProcessPaginationFromUi() {
    const info = ($("processPageInfo") && $("processPageInfo").textContent) || "";
    const pm = /Lapa\s+(\d+)\s*\/\s*(\d+)/.exec(info);
    const page = pm ? Math.max(1, parseInt(pm[1], 10)) : 1;
    const pageSize = Number(($("processPageSize") && $("processPageSize").value) || 100);
    return { page, pageSize };
  }

  function makeProcessAccordionBlockId(r) {
    const no = String((r && r.processNo) || "").trim();
    const name = String((r && r.process) || "").trim();
    const raw = no + "\u0001" + name;
    try {
      return (
        "pvacc-" +
        btoa(unescape(encodeURIComponent(raw || "\u0001")))
          .replace(/=+$/, "")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
      );
    } catch (_e) {
      return "pvacc-" + String(raw || "x").replace(/[^\w.-]+/g, "_").slice(0, 120);
    }
  }

  function applyProcessAccordionBlockState(table, blockId, open) {
    if (!table || blockId == null || blockId === "") return;
    const hdr = table.querySelector(`tr.process-accordion-hdr[data-accordion-block="${blockId}"]`);
    if (!hdr) return;
    hdr.setAttribute("aria-expanded", open ? "true" : "false");
    table
      .querySelectorAll(`tr.process-accordion-part[data-accordion-block="${blockId}"]`)
      .forEach((tr) => {
        tr.classList.toggle("is-visible", !!open);
      });
  }

  function ensureProcessAccordionWired() {
    const table = $("processTable");
    if (!table || __prAccordionDelegationBound) return;
    __prAccordionDelegationBound = true;
    table.addEventListener("click", (e) => {
      const hdr = e.target.closest("tr.process-accordion-hdr");
      if (!hdr || !table.contains(hdr)) return;
      if (e.target.closest("button")) return;
      if (e.target.closest("a")) return;
      const id = hdr.getAttribute("data-accordion-block");
      if (id == null || id === "") return;
      const open = hdr.getAttribute("aria-expanded") !== "true";
      applyProcessAccordionBlockState(table, id, open);
      if (open) __prAccordionExpandedKeys.add(id);
      else __prAccordionExpandedKeys.delete(id);
    });
  }

  function createProcessCardButton(r) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = "Atvērt kartiņu";
    b.onclick = () => {
      if (typeof window.openProcessEditorByProcNoOrName === "function") {
        window.openProcessEditorByProcNoOrName(r.processNo, r.process);
      }
    };
    return b;
  }

  function renderProcRegTableHead() {
    const table = $("processTable");
    if (!table) return;
    const thead = table.querySelector("thead");
    if (!thead) return;
    if (!procRegFullView) {
      thead.innerHTML = `<tr>
        <th class="col-gray" data-filter-label="Procesa grupa">Procesa grupa</th>
        <th class="col-gray" data-filter-label="Procesa Nr.">Procesa Nr.</th>
        <th class="col-gray" data-filter-label="Process">Process</th>
        <th class="col-gray" data-filter-label="Procesa izpildītājs (pārvalde)">Procesa izpildītājs (pārvalde)</th>
        <th data-filter-label="Procesa kartiņa">Procesa kartiņa</th>
      </tr>`;
    } else {
      thead.innerHTML = `<tr>
        <th class="col-gray" data-filter-label="Procesa grupa">Procesa grupa</th>
        <th class="col-gray" data-filter-label="Procesa Nr.">Procesa Nr.</th>
        <th class="col-gray" data-filter-label="Process">Process</th>
        <th class="col-gray" data-filter-label="Procesa izpildītājs (pārvalde)">Procesa izpildītājs (pārvalde)</th>
        <th class="col-gray" data-filter-label="Galaprodukta Nr.">Galaprodukta Nr.</th>
        <th class="col-gray" data-filter-label="Galaprodukts">Galaprodukts</th>
        <th class="col-gray" data-filter-label="Galaprodukta joma">Galaprodukta joma</th>
        <th data-filter-label="Procesa kartiņa">Procesa kartiņa</th>
      </tr>`;
    }
    const hr = thead.querySelector("tr");
    if (hr) hr.dataset.filtersReady = "";
  }

  function appendProcRegBasicRow(tbody, r, q) {
    const tr = document.createElement("tr");
    const c0 = document.createElement("td");
    c0.className = "col-gray";
    c0.textContent = String(r.group || "");
    tr.appendChild(c0);
    const c1 = document.createElement("td");
    c1.className = "col-gray";
    c1.textContent = String(r.processNo || "");
    tr.appendChild(c1);
    const c2 = document.createElement("td");
    c2.className = "col-gray";
    c2.textContent = String(r.process || "");
    tr.appendChild(c2);
    const c3 = document.createElement("td");
    c3.className = "col-gray";
    c3.textContent = String(r.executorPatstaviga || "");
    tr.appendChild(c3);
    const c4 = document.createElement("td");
    c4.appendChild(createProcessCardButton(r));
    tr.appendChild(c4);
    if (q) tr.classList.add("search-hit");
    tbody.appendChild(tr);
  }

  function appendProcRegFullProcessRows(tbody, r, processIdx, q) {
    const accordionBlockId = makeProcessAccordionBlockId(r);
    const gpItems = Array.isArray(r.gpItems) ? r.gpItems : [];
    const lines = gpItems.length
      ? gpItems
      : [
          {
            name: "",
            typeNosText: String(r.typeNos || ""),
            jomaText: String(r.darbibasJoma || ""),
            executorText: String(r.executorPatstaviga || ""),
            procNo: String(r.processNo || "").trim(),
          },
        ];
    const multiGp = lines.length > 1;

    lines.forEach((gpItem, idx) => {
      const tr = document.createElement("tr");
      tr.classList.add(processIdx % 2 === 0 ? "process-block-even" : "process-block-odd");
      if (idx === 0) tr.classList.add("process-block-start");
      if (idx === lines.length - 1) tr.classList.add("process-block-end");
      if (multiGp) {
        if (idx === 0) {
          tr.classList.add("process-accordion-hdr");
          tr.setAttribute("aria-expanded", "false");
          tr.setAttribute("data-accordion-block", accordionBlockId);
        } else {
          tr.classList.add("process-accordion-part");
          tr.setAttribute("data-accordion-block", accordionBlockId);
        }
      }

      const makeTd = (val, cls) => {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        td.textContent = val || "";
        tr.appendChild(td);
        return td;
      };

      makeTd(idx === 0 ? r.group : "", "col-gray");
      makeTd(idx === 0 ? r.processNo : "", "col-gray");
      makeTd(idx === 0 ? r.process : "", "col-gray");
      makeTd(String(gpItem.executorText || r.executorPatstaviga || ""), "col-gray");
      makeTd(String(gpItem.typeNosText || ""), "col-gray");
      makeTd(String(gpItem.name || ""), "col-gray");
      makeTd(String(gpItem.jomaText || ""), "col-gray");

      const tdCard = document.createElement("td");
      if (idx === 0) tdCard.appendChild(createProcessCardButton(r));
      tr.appendChild(tdCard);

      if (q) tr.classList.add("search-hit");
      tbody.appendChild(tr);
    });
  }

  function renderProcRegProcessTableOverride() {
    const table = $("processTable");
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    renderProcRegTableHead();
    tbody.innerHTML = "";

    const q = ($("searchInput") && $("searchInput").value.trim().toLowerCase()) || "";
    const matchedRows = getFilteredProcessRows();
    const { page, pageSize } = readProcessPaginationFromUi();
    const start = (page - 1) * pageSize;
    const pagedRows = matchedRows.slice(start, start + pageSize);

    if (!procRegFullView) {
      pagedRows.forEach((r) => appendProcRegBasicRow(tbody, r, q));
    } else {
      pagedRows.forEach((r, processIdx) =>
        appendProcRegFullProcessRows(tbody, r, processIdx, q)
      );
    }

    ensureProcessAccordionWired();
    __prAccordionExpandedKeys.forEach((id) => {
      applyProcessAccordionBlockState(table, id, true);
    });

    if (q) {
      if (table.classList.contains("table-body-hidden")) {
        table.classList.remove("table-body-hidden");
        if ($("toggleProcessBtn")) $("toggleProcessBtn").textContent = "Aizvērt procesu reģistru";
      }
      const firstHit = tbody.querySelector("tr.search-hit");
      if (firstHit) firstHit.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    if (typeof window.__afterTableRenderFilters === "function") {
      window.__afterTableRenderFilters();
    }
    if (typeof window.refreshHelpIcons === "function") window.refreshHelpIcons();
    if (typeof window.refreshClearFilterButtonActive === "function") {
      window.refreshClearFilterButtonActive();
    }
  }

  function moveControlsToRegistry() {
    const processRight = $("processListCard") ? $("processListCard").querySelector(".toolbar .right") : null;
    if (!processRight) return;

    const newBtn = $("newBtn");
    if (newBtn && !processRight.contains(newBtn)) processRight.appendChild(newBtn);
  }

  function getFieldText(tr, mode) {
    const tds = Array.from(tr.children);
    if (mode === "task") return `${tds[1]?.textContent || ""} ${tds[2]?.textContent || ""}`;
    if (mode === "owner") {
      return `${tds[3]?.textContent || ""}`;
    }
    if (mode === "output") {
      return procRegFullView
        ? `${tds[5]?.textContent || ""} ${tds[6]?.textContent || ""}`
        : `${tds[2]?.textContent || ""}`;
    }
    return `${tds[1]?.textContent || ""} ${tds[2]?.textContent || ""} ${tds[3]?.textContent || ""}`;
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
    hideLegacyViewControls();
    moveControlsToRegistry();
    setupKartinaExtras();
    patchProcRegViewToggleButton();

    const searchInput = $("searchInput");
    const viewSelect = $("viewFilterSelect");
    if (searchInput) searchInput.addEventListener("input", applyMainSearchByView);
    if (viewSelect) viewSelect.addEventListener("change", applyMainSearchByView);

    const originalRender = window.renderTable;
    if (typeof originalRender === "function" && !window.__procRegHooked) {
      window.renderTable = function () {
        originalRender();
        renderProcRegProcessTableOverride();
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
