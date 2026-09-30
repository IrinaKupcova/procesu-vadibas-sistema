/**
 * Joma — GP kartiņā jomas izvēle no pilna jomu saraksta.
 * Pārveido #cDarbibasJoma par <select> ar visām zināmām jomām.
 */
(function () {
  "use strict";

  const FIELD_IDS = ["cDarbibasJoma"];
  const EMPTY_LABEL = "";
  const ADD_NEW_VALUE = "__joma_add_new__";
  const ADD_NEW_LABEL = "➕ Pievienot jaunu jomu…";
  const CUSTOM_JOMA_STORAGE = "pv_custom_jomas_v1";
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

  function loadCustomJomas() {
    try {
      const raw = JSON.parse(localStorage.getItem(CUSTOM_JOMA_STORAGE) || "[]");
      return Array.isArray(raw) ? raw.map((x) => String(x || "").trim()).filter(Boolean) : [];
    } catch (_) {
      return [];
    }
  }

  function saveCustomJoma(label) {
    const val = String(label || "").trim();
    if (!val) return false;
    const key = normKey(val);
    const list = loadCustomJomas();
    if (!list.some((j) => normKey(j) === key)) {
      list.push(val);
      list.sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));
      try {
        localStorage.setItem(CUSTOM_JOMA_STORAGE, JSON.stringify(list));
      } catch (_) {}
    }
    return true;
  }

  function removeCustomJoma(label) {
    const key = normKey(label);
    if (!key) return false;
    const list = loadCustomJomas().filter((j) => normKey(j) !== key);
    try {
      localStorage.setItem(CUSTOM_JOMA_STORAGE, JSON.stringify(list));
    } catch (_) {}
    return true;
  }

  function promptNewJomaName() {
    const name = window.prompt("Ievadiet jaunas jomas nosaukumu:");
    return String(name || "").trim();
  }

  function normKey(v) {
    return String(v || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*[,;.\-–—]+\s*$/g, "")
      .trim()
      .toLowerCase();
  }

  function splitJomaValues(raw) {
    return String(raw || "")
      .split(/[,;\n]+/)
      .map((s) => String(s || "").trim())
      .filter(Boolean);
  }

  function pickSingleJoma(raw) {
    const parts = splitJomaValues(raw);
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    const scored = parts.slice().sort((a, b) => {
      const wa = String(a).split(/\s+/).filter(Boolean).length;
      const wb = String(b).split(/\s+/).filter(Boolean).length;
      return wb * 1000 + String(b).length - (wa * 1000 + String(a).length);
    });
    return scored[0] || parts[0];
  }

  function collectAllJomas() {
    const seen = new Map();

    function addWhole(label) {
      const display = String(label || "").trim();
      const key = normKey(display);
      if (!key) return;
      if (!seen.has(key) || String(display).length > String(seen.get(key)).length) {
        seen.set(key, display);
      }
    }

    // Tikai oficiālais jomu reģistrs + lietotāja pievienotās (localStorage).
    // Vispār nesadalām pa komatiem — citādi "Normatīvais regulējums, metodika…"
    // kļūst par atsevišķu "metodika un analitika" rindu.
    loadCustomJomas().forEach(addWhole);

    if (window.JomaKartina && typeof window.JomaKartina.listJomaLabels === "function") {
      window.JomaKartina.listJomaLabels().forEach(addWhole);
    }

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));
  }

  function resolveCanonicalJomaLabel(raw) {
    const picked = pickSingleJoma(raw);
    if (!picked) return "";
    const key = normKey(picked);
    const jomas = collectAllJomas();
    const hit = jomas.find((j) => normKey(j) === key);
    return hit || picked;
  }

  function ensureOption(select, label) {
    const val = String(label || "").trim();
    if (!val) return;
    const exists = Array.from(select.options).some((o) => o.value === val);
    if (exists) return;
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  }

  function rebuildOptions(select, currentValue) {
    if (!select || select.tagName !== "SELECT") return;
    const cur = resolveCanonicalJomaLabel(currentValue != null ? currentValue : select.value);
    const jomas = collectAllJomas();
    if (cur && !jomas.some((j) => normKey(j) === normKey(cur))) jomas.unshift(cur);
    jomas.sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));

    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = EMPTY_LABEL;
    select.appendChild(empty);
    jomas.forEach((j) => {
      const opt = document.createElement("option");
      opt.value = j;
      opt.textContent = j;
      select.appendChild(opt);
    });
    const addOpt = document.createElement("option");
    addOpt.value = ADD_NEW_VALUE;
    addOpt.textContent = ADD_NEW_LABEL;
    select.appendChild(addOpt);
    valueDesc.set.call(select, cur);
  }

  function wireAddNewHandler(select) {
    if (!select || select.__jomaAddWired) return;
    select.__jomaAddWired = true;
    select.addEventListener("change", function () {
      if (this.value !== ADD_NEW_VALUE) {
        if (this.value && this.value !== ADD_NEW_VALUE) this.dataset.jomaPrevValue = this.value;
        return;
      }
      if (this.disabled) {
        valueDesc.set.call(this, this.dataset.jomaPrevValue || "");
        return;
      }
      const prev = this.dataset.jomaPrevValue || "";
      const label = promptNewJomaName();
      if (!label) {
        valueDesc.set.call(this, prev);
        return;
      }
      if (!saveCustomJoma(label)) {
        valueDesc.set.call(this, prev);
        return;
      }
      rebuildOptions(this, label);
      this.dataset.jomaPrevValue = label;
      this.dispatchEvent(new Event("input", { bubbles: true }));
      this.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function wrapSelectValue(select) {
    if (!select || select.__jomaValueWrapped) return;
    select.__jomaValueWrapped = true;
    Object.defineProperty(select, "value", {
      configurable: true,
      enumerable: true,
      get() {
        return valueDesc.get.call(this);
      },
      set(v) {
        const picked = pickSingleJoma(v);
        if (picked) ensureOption(this, picked);
        valueDesc.set.call(this, picked);
      },
    });
  }

  function upgradeInputToSelect(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return null;
    if (el.tagName === "SELECT") {
      wrapSelectValue(el);
      wireAddNewHandler(el);
      return el;
    }
    const sel = document.createElement("select");
    sel.id = el.id;
    if (el.className) sel.className = el.className;
    if (el.name) sel.name = el.name;
    const ac = el.getAttribute("autocomplete");
    if (ac != null) sel.setAttribute("autocomplete", ac);
    sel.style.cssText = el.style.cssText;
    el.parentNode.replaceChild(sel, el);
    wrapSelectValue(sel);
    wireAddNewHandler(sel);
    return sel;
  }

  function syncCatalogSelectDisabled() {
    const sel = document.getElementById("cDarbibasJoma");
    const ref = document.getElementById("cType");
    if (sel && sel.tagName === "SELECT" && ref) sel.disabled = !!ref.disabled;
  }

  function refreshAll(currentValues) {
    const vals = currentValues || {};
    FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName !== "SELECT") upgradeInputToSelect(id);
      const node = document.getElementById(id);
      if (!node || node.tagName !== "SELECT") return;
      const cur = vals[id] != null ? vals[id] : node.value;
      rebuildOptions(node, cur);
      wireAddNewHandler(node);
    });
    syncCatalogSelectDisabled();
    try { updateGpCountTiles(); } catch (_) {}
  }

  function observeCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card || card.__jomaObserved) return;
    card.__jomaObserved = true;
    let wasHidden = card.classList.contains("hidden");
    let refreshTimer = null;
    const obs = new MutationObserver(() => {
      const hidden = card.classList.contains("hidden");
      if (wasHidden && !hidden) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          refreshAll();
        }, 50);
      }
      wasHidden = hidden;
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function hookRenderTable() {
    if (typeof window.renderTable !== "function" || window.renderTable.__jomaHooked) return;
    const orig = window.renderTable;
    const wrapped = function () {
      const out = orig.apply(this, arguments);
      refreshAll();
      return out;
    };
    wrapped.__jomaHooked = true;
    window.renderTable = wrapped;
  }

  function hookLoadCatalog() {
    if (typeof window.loadCatalog !== "function" || window.loadCatalog.__jomaHooked) return;
    const orig = window.loadCatalog;
    const wrapped = async function () {
      const out = await orig.apply(this, arguments);
      refreshAll();
      return out;
    };
    wrapped.__jomaHooked = true;
    window.loadCatalog = wrapped;
  }

  function observeCatalogFormDisable() {
    const form = document.getElementById("catalogEditorForm");
    if (!form || form.__jomaDisableObserved) return;
    form.__jomaDisableObserved = true;
    const obs = new MutationObserver(syncCatalogSelectDisabled);
    form.querySelectorAll("input,select,textarea,button").forEach((el) => {
      obs.observe(el, { attributes: true, attributeFilter: ["disabled"] });
    });
  }

  // ---------------------------------------------------------------------------
  // Jomu skats: katrai jomai primāri pielasa GALAPRODUKTUS (nevis procesus),
  // akordeona veidā — joma → atverams GP saraksts.
  // Statistiku/pīrāgu atstājam oriģinālo (izsaucam sākotnējo renderi), un pēc tam
  // pārbūvējam tikai tabulas <tbody> ar GP saturu.
  // ---------------------------------------------------------------------------
  const JOMA_TABLE_ID = "processJomasTable";
  const JOMA_CARD_ID = "processJomasCard";
  const JOMA_BULK_BTN_ID = "jomasBulkAccordionToggleBtn";
  const JOMA_COL_DEFS = [
    { label: "Galaprodukta joma", filter: "Galaprodukta joma" },
    { label: "Process", filter: "Process" },
    { label: "Galaprodukts", filter: "Galaprodukts" },
  ];
  const gpExpanded = new Set();
  let jomaGpBusy = false;
  let originalJomasRender = null;

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getCatalogRowsSafe() {
    try {
      if (typeof window.getCatalogRows === "function") return window.getCatalogRows() || [];
    } catch (_) {}
    return [];
  }

  function collectExtraJomaLabels() {
    const out = [];
    try {
      if (window.Joma && typeof window.Joma.getCustomJomas === "function") {
        out.push.apply(out, window.Joma.getCustomJomas() || []);
      }
    } catch (_) {}
    try {
      if (window.JomaKartina && typeof window.JomaKartina.listJomaLabels === "function") {
        out.push.apply(out, window.JomaKartina.listJomaLabels() || []);
      }
    } catch (_) {}
    return out;
  }

  function getMergedRowsSafe() {
    try {
      if (typeof window.getMergedProcessRegisterRows === "function") {
        return window.getMergedProcessRegisterRows() || [];
      }
    } catch (_) {}
    return [];
  }

  function buildCatalogLookup() {
    const map = new Map(); // normKey(GP nosaukums) -> kataloga rinda (kartiņas atvēršanai)
    getCatalogRowsSafe().forEach((c) => {
      if (!c || typeof c !== "object") return;
      const k = normKey(String(c.type || ""));
      if (k && !map.has(k)) map.set(k, c);
    });
    return map;
  }

  // Būvējam jomu → GP piesaisti no tā paša avota, ko lieto oriģinālais skats (gpItems),
  // jo kataloga darbibasJoma vairumā gadījumu nesakrīt ar jomu nosaukumiem.
  function buildJomaGpData() {
    const byJoma = new Map(); // jomaKey -> { display, gps: Map(gpKey -> { name, row }), procs: Set }
    const allGp = new Set();
    const allProc = new Set();
    const catLookup = buildCatalogLookup();

    function ensureBucket(display) {
      const disp = String(display || "").trim() || "—";
      const key = normKey(disp) || "—";
      if (!byJoma.has(key)) byJoma.set(key, { display: disp, gps: new Map(), procs: new Set() });
      const b = byJoma.get(key);
      if (String(disp).length > String(b.display).length) b.display = disp;
      return b;
    }

    function addGp(jomaLabels, gpName, row, procNo, procName) {
      const name = String(gpName || "").trim();
      if (!name) return;
      const gpKey = normKey(name);
      allGp.add(gpKey);
      const procNoS = String(procNo || "").trim();
      const procNameS = String(procName || "").trim();
      const procKey = normKey(procNoS || procNameS);
      if (procKey) allProc.add(procKey);
      const list = jomaLabels && jomaLabels.length ? jomaLabels : ["—"];
      list.forEach((jl) => {
        const bucket = ensureBucket(jl);
        if (!bucket.gps.has(gpKey)) {
          bucket.gps.set(gpKey, {
            name,
            row: row || { type: name, procNo: procNoS },
            typeNo: String((row && row.typeNo) || "").trim(),
            processMap: new Map(),
          });
        }
        const gpEntry = bucket.gps.get(gpKey);
        if (procKey) {
          if (!gpEntry.processMap.has(procKey)) {
            gpEntry.processMap.set(procKey, { procNo: procNoS, proc: procNameS, procKey });
          }
          bucket.procs.add(procKey);
        }
      });
    }

    const merged = getMergedRowsSafe();
    let usedMerged = false;
    merged.forEach((r) => {
      const procNo = String((r && r.processNo) || "").trim();
      const procName = String((r && r.process) || "").trim();
      const gpItems = Array.isArray(r && r.gpItems) ? r.gpItems : [];
      gpItems.forEach((gp) => {
        const gpName = String((gp && gp.name) || "").trim();
        if (!gpName) return;
        usedMerged = true;
        const catRow = catLookup.get(normKey(gpName)) || {
          type: gpName,
          typeNo: String((gp && gp.typeNo) || ""),
          procNo: String((gp && gp.procNo) || procNo || ""),
          process: procName,
        };
        let jomas = splitJomaValues(gp && gp.jomaText);
        if (!jomas.length) jomas = splitJomaValues(catRow && catRow.darbibasJoma);
        if (!jomas.length) jomas = splitJomaValues(r && r.darbibasJoma);
        addGp(jomas, gpName, catRow, procNo, procName);
      });
    });

    // Rezerves variants — ja apvienotās rindas nedeva GP, grupējam kataloga rindas pēc darbibasJoma.
    if (!usedMerged) {
      getCatalogRowsSafe().forEach((r) => {
        const gpName = String((r && r.type) || "").trim();
        if (!gpName) return;
        const procNo = String((r && r.procNo) || "").trim();
        const procName = String((r && r.process) || "").trim();
        addGp(splitJomaValues(r && r.darbibasJoma), gpName, r, procNo, procName);
      });
    }

    // Papildu jomas (pievienotās/kartiņu) rādām arī tad, ja tām vēl nav GP.
    collectExtraJomaLabels().forEach((label) => {
      const disp = String(label || "").trim();
      if (disp) ensureBucket(disp);
    });

    let jomaCount = 0;
    byJoma.forEach((b) => {
      if (String(b.display || "") !== "—") jomaCount += 1;
    });

    return { byJoma, gpTotal: allGp.size, procTotal: allProc.size, jomaCount };
  }

  // Visi stats bloki ar diagrammu, kur jārāda "Galaproduktu skaits" flīze.
  const GP_TILE_TARGETS = [{ card: "processGroupsCard", id: "pgStatProcessGpCount" }];

  function computeGpTotal() {
    const set = new Set();
    let used = false;
    getMergedRowsSafe().forEach((r) => {
      (Array.isArray(r && r.gpItems) ? r.gpItems : []).forEach((gp) => {
        const n = normKey(String((gp && gp.name) || ""));
        if (n) {
          set.add(n);
          used = true;
        }
      });
    });
    if (!used) {
      getCatalogRowsSafe().forEach((r) => {
        const n = normKey(String((r && r.type) || ""));
        if (n) set.add(n);
      });
    }
    return set.size;
  }

  function injectGpCountTiles() {
    GP_TILE_TARGETS.forEach((t) => {
      const right = document.querySelector("#" + t.card + " .process-stats-right");
      if (!right || document.getElementById(t.id)) return;
      const box = document.createElement("div");
      box.className = "stat-box";
      box.innerHTML =
        '<div class="stat-k">Galaproduktu skaits</div><div class="stat-v" id="' + t.id + '">0</div>';
      right.appendChild(box);
    });
  }

  function updateGpCountTiles() {
    injectGpCountTiles();
    const total = computeGpTotal();
    GP_TILE_TARGETS.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) el.textContent = String(total);
    });
  }

  // Visu diagrammu virsraksts vienāds (pīrāgs rāda procesu grupu sadalījumu) — arī jomu skatā.
  function normalizeDiagramTitles() {
    document.querySelectorAll(".process-pie-wrap > .stat-k").forEach((el) => {
      if (el.textContent !== "Procesu grupas (skaits un īpatsvars)") {
        el.textContent = "Procesu grupas (skaits un īpatsvars)";
      }
    });
  }

  // GP-orientēta jomu statistika (izmanto Statistika sadaļa): joma → GP skaits, GP nosaukumi, procesu skaits.
  function getJomaStats() {
    const d = buildJomaGpData();
    const jomas = Array.from(d.byJoma.values())
      .filter((b) => String(b.display || "") !== "—")
      .map((b) => ({
        name: b.display,
        gpCount: b.gps.size,
        gpNames: Array.from(b.gps.values())
          .map((g) => g.name)
          .sort((a, b2) => String(a).localeCompare(String(b2), "lv", { sensitivity: "base" })),
        procCount: b.procs.size,
      }))
      .sort((a, b) => b.gpCount - a.gpCount || String(a.name).localeCompare(String(b.name), "lv", { sensitivity: "base" }));
    return { jomas, jomaCount: d.jomaCount, gpTotal: d.gpTotal, procTotal: d.procTotal };
  }

  // Katram procesam — kā tā galaprodukti procentuāli sadalās pa jomām (un kādas jomas).
  function getProcessJomaBreakdown() {
    const merged = getMergedRowsSafe();
    const catLookup = buildCatalogLookup();
    const out = [];
    merged.forEach((r) => {
      const procName = String((r && r.process) || "").trim();
      const procNo = String((r && r.processNo) || "").trim();
      if (!procName && !procNo) return;
      const gpItems = Array.isArray(r && r.gpItems) ? r.gpItems : [];
      const jomaCounts = new Map(); // key -> { name, count }
      let total = 0;
      gpItems.forEach((gp) => {
        const gpName = String((gp && gp.name) || "").trim();
        if (!gpName) return;
        const catRow = catLookup.get(normKey(gpName));
        let jomas = splitJomaValues(gp && gp.jomaText);
        if (!jomas.length) jomas = splitJomaValues(catRow && catRow.darbibasJoma);
        if (!jomas.length) jomas = splitJomaValues(r && r.darbibasJoma);
        if (!jomas.length) jomas = ["(nav norādīta joma)"];
        jomas.forEach((jl) => {
          const disp = String(jl || "").trim() || "(nav norādīta joma)";
          const key = normKey(disp) || "—";
          if (!jomaCounts.has(key)) jomaCounts.set(key, { name: disp, count: 0 });
          jomaCounts.get(key).count += 1;
          total += 1;
        });
      });
      if (total === 0) return;
      const jomas = Array.from(jomaCounts.values())
        .map((x) => ({ name: x.name, count: x.count, pct: Math.round((x.count / total) * 100) }))
        .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name), "lv", { sensitivity: "base" }));
      out.push({ process: procName || procNo, processNo: procNo, gpTotal: total, jomas });
    });
    out.sort((a, b) => String(a.process).localeCompare(String(b.process), "lv", { sensitivity: "base" }));
    return out;
  }

  // Pogas uz attiecīgo statistiku katrā sadaļā.
  const STATS_BTN_TARGETS = [
    { card: "processListCard", section: "process", label: "Procesu statistika", id: "btnGotoStatsProcess" },
    { card: "catalogListCard", section: "process", label: "Galaproduktu statistika", id: "btnGotoStatsGp" },
    { card: "processJomasCard", section: "joma", label: "Jomu statistika", id: "btnGotoStatsJoma" },
    { card: "executorsCard", section: "org", label: "Izpildītāju statistika", id: "btnGotoStatsOrg" },
  ];

  function gotoStats(sectionId) {
    const navBtn = document.querySelector('.side-nav-jump[data-scroll-target="reportsCard"]');
    if (navBtn) navBtn.click();
    const open = () => {
      if (typeof window.openStatsSection === "function") window.openStatsSection(sectionId);
    };
    setTimeout(open, 80);
    setTimeout(open, 300);
    setTimeout(open, 700);
  }

  function injectStatsButtons() {
    STATS_BTN_TARGETS.forEach((t) => {
      const card = document.getElementById(t.card);
      if (!card || document.getElementById(t.id)) return;
      const host = card.querySelector(".toolbar .right") || card.querySelector(".toolbar");
      if (!host) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = t.id;
      btn.className = "secondary";
      btn.textContent = t.label;
      btn.title = "Atvērt: " + t.label;
      btn.addEventListener("click", () => gotoStats(t.section));
      host.appendChild(btn);
    });
  }

  // Katrā sadaļā ar diagrammu ievietojam saraksta nosaukumu zem diagrammas (tieši virs saraksta).
  function injectListTitlesUnderDiagram() {
    document.querySelectorAll(".process-pie-wrap").forEach((wrap) => {
      if (wrap.__listTitleInjected) return;
      const next = wrap.nextElementSibling;
      if (next && next.classList && next.classList.contains("list-title-under-diagram")) {
        wrap.__listTitleInjected = true;
        return;
      }
      const card = wrap.closest(".card");
      const titleEl = card && card.querySelector(".toolbar .section-title");
      const text = titleEl ? String(titleEl.textContent || "").trim() : "";
      if (!text) return;
      const h = document.createElement("div");
      h.className = "section-title list-title-under-diagram";
      h.textContent = text;
      wrap.parentNode.insertBefore(h, wrap.nextSibling);
      // Nedublējam — paslēpjam augšējo (rīkjoslas) virsrakstu, atstājot tikai to zem diagrammas.
      titleEl.style.display = "none";
      wrap.__listTitleInjected = true;
    });
  }

  function syncJomaTableColumns(table) {
    if (!table) return;
    let tr = table.querySelector("thead tr");
    if (!tr) {
      const thead = document.createElement("thead");
      tr = document.createElement("tr");
      thead.appendChild(tr);
      const tb = table.querySelector("tbody");
      if (tb) table.insertBefore(thead, tb);
      else table.appendChild(thead);
    }
    const colOrderKey = "joma-proc-gp-v2";
    const thHtml = JOMA_COL_DEFS.map(
      (c) => `<th data-filter-label="${escHtml(c.filter)}">${escHtml(c.label)}</th>`
    ).join("");
    if (tr.children.length !== JOMA_COL_DEFS.length || tr.dataset.colOrder !== colOrderKey) {
      tr.innerHTML = thHtml;
      tr.dataset.colOrder = colOrderKey;
      tr.dataset.filtersReady = "";
      if (table.dataset) table.dataset.jomaFiltersInit = "";
    } else {
      JOMA_COL_DEFS.forEach((c, i) => {
        if (!tr.children[i]) return;
        tr.children[i].setAttribute("data-filter-label", c.filter);
        if (!tr.children[i].querySelector(".th-filter-wrap")) tr.children[i].textContent = c.label;
      });
    }
    table.classList.add("ex-table", "joma-ex-table", "ex-table-fixed");
    let cg = table.querySelector("colgroup.joma-ex-cols");
    if (!cg) {
      cg = document.createElement("colgroup");
      cg.className = "joma-ex-cols";
      cg.innerHTML = "<col><col><col>";
      table.insertBefore(cg, table.firstChild);
    }
  }

  function ensureJomaViewControls(card) {
    if (!card) return;
    const legacySummary = document.getElementById("jomasViewSummary");
    if (legacySummary) legacySummary.remove();
    if (!document.getElementById(JOMA_BULK_BTN_ID)) {
      const controls = document.createElement("div");
      controls.className = "ex-view-controls";
      const bulk = document.createElement("button");
      bulk.type = "button";
      bulk.id = JOMA_BULK_BTN_ID;
      bulk.className = "secondary";
      bulk.textContent = "Atvērt visus akordeonus";
      controls.appendChild(bulk);
      const toolbar = card.querySelector(".toolbar");
      if (toolbar) toolbar.insertAdjacentElement("afterend", controls);
    }
    const table = document.getElementById(JOMA_TABLE_ID);
    if (table && !table.closest(".ex-table-scroll")) {
      const wrap = document.createElement("div");
      wrap.className = "ex-table-scroll";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    }
  }

  function bindJomaToggle(el, fn) {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  }

  function openJomaProcessCard(processRows, procNo, procName) {
    if (typeof window.openProcessEditorByProcNoOrName === "function") {
      window.openProcessEditorByProcNoOrName(procNo, procName);
      return;
    }
    if (typeof window.openProcessEditorByTaskProcNos === "function") {
      window.openProcessEditorByTaskProcNos(procName, procNo);
    }
  }

  function processDisplayLabel(pr) {
    return (
      (typeof window.pvPairLabel === "function"
        ? window.pvPairLabel(pr.procNo, pr.proc)
        : [pr.procNo, pr.proc].filter(Boolean).join(" ")) ||
      (window.pvEmptyMark || "–")
    );
  }

  function fillJomaSingleProcessCell(td, pr, processRows) {
    td.className = "ex-proc-cell";
    td.textContent = "";
    if (!pr || (!pr.procNo && !pr.proc)) {
      td.textContent = "—";
      td.style.color = "#94a3b8";
      return;
    }
    const main = document.createElement("div");
    main.className = "ex-proc-item";
    const procLabel = processDisplayLabel(pr);
    const link = document.createElement("span");
    link.className = "ex-link";
    link.textContent = procLabel;
    link.title = "Atvērt procesa kartiņu";
    link.addEventListener("click", () => openJomaProcessCard(processRows, pr.procNo, pr.proc));
    main.appendChild(link);
    const pBtn = document.createElement("button");
    pBtn.type = "button";
    pBtn.className = "secondary";
    pBtn.style.fontSize = "12px";
    pBtn.textContent = "Procesa kartiņa";
    pBtn.addEventListener("click", () => openJomaProcessCard(processRows, pr.procNo, pr.proc));
    main.appendChild(pBtn);
    td.appendChild(main);
  }

  /** Grupē GP pēc procesa (vienam procesam — vairāki GP, process kolonnā ar rowspan). */
  function groupGpsByProcess(gps) {
    const byProc = new Map();
    gps.forEach((gp) => {
      const procs = gp.processMap ? Array.from(gp.processMap.values()) : [];
      if (!procs.length) {
        const key = "__empty__";
        if (!byProc.has(key)) {
          byProc.set(key, { procKey: key, procNo: "", proc: "", gps: [] });
        }
        byProc.get(key).gps.push(gp);
        return;
      }
      procs.forEach((pr) => {
        const key = pr.procKey || normKey(`${pr.procNo}\u0001${pr.proc}`);
        if (!byProc.has(key)) {
          byProc.set(key, { procKey: key, procNo: pr.procNo, proc: pr.proc, gps: [] });
        }
        const bucket = byProc.get(key);
        const gpKey = normKey(gp.name);
        if (!bucket.gps.some((g) => normKey(g.name) === gpKey)) bucket.gps.push(gp);
      });
    });
    return Array.from(byProc.values()).sort((a, b) =>
      processDisplayLabel(a).localeCompare(processDisplayLabel(b), "lv", { sensitivity: "base" })
    );
  }

  function hasAnyJomaAccordionOpen() {
    return gpExpanded.size > 0;
  }

  function setAllJomaAccordionsOpen(byJoma, open) {
    gpExpanded.clear();
    if (!open) return;
    byJoma.forEach((b) => {
      const name = String(b.display || "—");
      gpExpanded.add(name);
    });
  }

  function tbodyIsMine(tbody) {
    return !!(tbody && tbody.querySelector("tr.ex-dept-hdr"));
  }

  function afterJomasTableRender(table) {
    if (!table || table.dataset.jomaFiltersInit === "1") {
      if (typeof window.applyJomasFilters === "function") {
        try {
          window.applyJomasFilters();
        } catch (_) {}
      }
      return;
    }
    table.dataset.jomaFiltersInit = "1";
    if (typeof window.refreshExtraTableFilters === "function") {
      try {
        window.refreshExtraTableFilters();
      } catch (_) {}
    } else if (typeof window.applyJomasFilters === "function") {
      try {
        window.applyJomasFilters();
      } catch (_) {}
    }
  }

  function rebuildJomaGpBody() {
    const card = document.getElementById(JOMA_CARD_ID);
    const table = document.getElementById(JOMA_TABLE_ID);
    if (!card || !table) return;
    if (card.classList.contains("hidden")) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    ensureJomaViewControls(card);
    injectJomaGpStyle();
    syncJomaTableColumns(table);
    updateGpCountTiles();

    const processRows =
      typeof window.getProcessRows === "function" ? window.getProcessRows() || [] : [];
    const data = buildJomaGpData();
    const byJoma = data.byJoma;
    const sorted = Array.from(byJoma.values()).sort((a, b) =>
      String(a.display || "").localeCompare(String(b.display || ""), "lv", { sensitivity: "base" })
    );

    const elJoma = document.getElementById("statJomasCount");
    const elGp = document.getElementById("statJomasGpCount");
    const elProc = document.getElementById("statJomasProcLinks");
    if (elJoma) elJoma.textContent = String(data.jomaCount);
    if (elGp) elGp.textContent = String(data.gpTotal);
    if (elProc) elProc.textContent = String(data.procTotal);

    const bulkBtn = document.getElementById(JOMA_BULK_BTN_ID);
    if (bulkBtn && !bulkBtn.dataset.bound) {
      bulkBtn.addEventListener("click", () => {
        const wantOpen = !hasAnyJomaAccordionOpen();
        setAllJomaAccordionsOpen(byJoma, wantOpen);
        rebuildJomaGpBody();
      });
      bulkBtn.dataset.bound = "1";
    }
    if (bulkBtn) {
      bulkBtn.textContent = hasAnyJomaAccordionOpen()
        ? "Aizvērt visus akordeonus"
        : "Atvērt visus akordeonus";
    }

    tbody.innerHTML = "";
    if (!sorted.length) {
      const empty = document.createElement("tr");
      empty.innerHTML = `<td colspan="3" style="padding:16px;color:#64748b">Nav datu par jomām un galaproduktiem.</td>`;
      tbody.appendChild(empty);
      afterJomasTableRender(table);
      return;
    }

    sorted.forEach((bucket) => {
      const jomaName = String(bucket.display || "—");
      const gps = Array.from(bucket.gps.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "lv", { sensitivity: "base" })
      );
      const procKeys = new Set();
      gps.forEach((g) => {
        if (!g.processMap || !g.processMap.size) procKeys.add("__empty__");
        else g.processMap.forEach((_, k) => procKeys.add(k));
      });
      const procCount = procKeys.size;
      const jomaOpen = gpExpanded.has(jomaName);

      const hdr = document.createElement("tr");
      hdr.className = "ex-dept-hdr";
      const toggleJoma = () => {
        if (gpExpanded.has(jomaName)) gpExpanded.delete(jomaName);
        else gpExpanded.add(jomaName);
        rebuildJomaGpBody();
      };

      const cJoma = document.createElement("td");
      const titleWrap = document.createElement("div");
      titleWrap.className = "ex-dept-title";
      const toggle = document.createElement("span");
      toggle.className = "ex-toggle ex-dept-toggle";
      toggle.title = "Atvērt/aizvērt";
      toggle.textContent = jomaOpen ? "▾" : "▸";
      bindJomaToggle(toggle, toggleJoma);
      titleWrap.appendChild(toggle);
      if (jomaName !== "—") {
        const jomaTitle = document.createElement("span");
        jomaTitle.className = "ex-joma-name";
        jomaTitle.textContent = jomaName;
        jomaTitle.title = "Atvērt jomas kartiņu";
        jomaTitle.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (typeof window.openJomaEditor === "function") window.openJomaEditor(jomaName);
        });
        titleWrap.appendChild(jomaTitle);
      } else {
        const plain = document.createElement("span");
        plain.textContent = jomaName;
        titleWrap.appendChild(plain);
      }
      cJoma.appendChild(titleWrap);

      const cProc = document.createElement("td");
      cProc.innerHTML = `<span class="ex-chip ex-chip-muted">${procCount} procesi</span>`;

      const cGp = document.createElement("td");
      cGp.innerHTML = `<span class="ex-chip ex-chip-muted">${gps.length} GP</span>`;

      hdr.appendChild(cJoma);
      hdr.appendChild(cProc);
      hdr.appendChild(cGp);
      tbody.appendChild(hdr);

      if (!jomaOpen) return;

      const procGroups = groupGpsByProcess(gps);
      procGroups.forEach((pg) => {
        const gpList = pg.gps.slice().sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""), "lv", { sensitivity: "base" })
        );
        const procLabel = processDisplayLabel(pg);
        const span = gpList.length;

        gpList.forEach((gp, idx) => {
          const gtr = document.createElement("tr");
          gtr.className = "ex-gp-hdr";
          gtr.setAttribute("data-joma-proc", procLabel);
          const gpLabel =
            typeof window.pvPairLabel === "function"
              ? window.pvPairLabel(gp.typeNo, gp.name) || gp.name
              : gp.typeNo
                ? `${gp.typeNo} ${gp.name}`
                : gp.name;
          gtr.setAttribute("data-joma-gp", gpLabel);

          const tJoma = document.createElement("td");
          tJoma.textContent = "";

          if (idx === 0) {
            const tProc = document.createElement("td");
            tProc.className = "ex-proc-merged";
            if (span > 1) tProc.rowSpan = span;
            fillJomaSingleProcessCell(
              tProc,
              { procNo: pg.procNo, proc: pg.proc },
              processRows
            );
            gtr.appendChild(tJoma);
            gtr.appendChild(tProc);
          } else {
            gtr.appendChild(tJoma);
          }

          const tGp = document.createElement("td");
          tGp.innerHTML = `<div class="ex-gp-cell"><span class="ex-gp-label">${escHtml(gpLabel)}</span></div>`;
          const gpBtn = document.createElement("button");
          gpBtn.type = "button";
          gpBtn.className = "secondary";
          gpBtn.style.fontSize = "12px";
          gpBtn.textContent = "GP kartiņa";
          gpBtn.addEventListener("click", () => {
            if (typeof window.openCatalogEditor === "function") window.openCatalogEditor(gp.row);
          });
          tGp.querySelector(".ex-gp-cell").appendChild(gpBtn);
          gtr.appendChild(tGp);
          tbody.appendChild(gtr);
        });
      });
    });

    if (typeof window.applyTableColumnSizing === "function") {
      try {
        window.applyTableColumnSizing(JOMA_TABLE_ID);
      } catch (_) {}
    }
    afterJomasTableRender(table);
  }

  function wrapJomasRender() {
    const current = window.renderProcessJomasView;
    if (typeof current !== "function" || current.__jomaGpWrapped) return;
    originalJomasRender = current;
    const wrapped = function () {
      jomaGpBusy = true;
      let out;
      try {
        out = originalJomasRender.apply(this, arguments);
      } catch (e) {
        console.warn("renderProcessJomasView (oriģinālais) kļūda:", e);
      }
      try {
        rebuildJomaGpBody();
      } finally {
        jomaGpBusy = false;
      }
      return out;
    };
    wrapped.__jomaGpWrapped = true;
    window.renderProcessJomasView = wrapped;
  }

  // --- Procesu grupas: bulta galvenē (akordeons ciet pēc noklusējuma; sakļaušana caur CSS) ---
  let originalGroupsRender = null;

  function addGroupCarets() {
    const table = document.getElementById("processGroupsTable");
    if (!table) return;
    table.querySelectorAll("tr.process-accordion-hdr[data-process-group]").forEach((hdr) => {
      if (hdr.querySelector(".joma-gp-caret")) return;
      const open = hdr.getAttribute("aria-expanded") === "true";
      const cell = hdr.children[1] || hdr.children[0];
      if (!cell) return;
      const caret = document.createElement("span");
      caret.className = "joma-gp-caret" + (open ? " open" : "");
      caret.textContent = open ? "▾" : "▸";
      caret.title = open ? "Aizvērt procesu sarakstu" : "Atvērt procesu sarakstu";
      cell.insertBefore(caret, cell.firstChild);
    });
  }

  function wrapGroupsRender() {
    const current = window.renderProcessGroupsView;
    if (typeof current !== "function" || current.__jomaGpGroupsWrapped) return;
    originalGroupsRender = current;
    const wrapped = function () {
      let out;
      try {
        out = originalGroupsRender.apply(this, arguments);
      } catch (e) {
        console.warn("renderProcessGroupsView (oriģinālais) kļūda:", e);
      }
      try {
        addGroupCarets();
      } catch (_) {}
      return out;
    };
    wrapped.__jomaGpGroupsWrapped = true;
    window.renderProcessGroupsView = wrapped;
  }

  function observeJomaTableBody() {
    const table = document.getElementById(JOMA_TABLE_ID);
    const tbody = table && table.querySelector("tbody");
    if (!tbody || tbody.__jomaGpObserved) return;
    tbody.__jomaGpObserved = true;
    const obs = new MutationObserver(() => {
      if (jomaGpBusy) return;
      const card = document.getElementById(JOMA_CARD_ID);
      if (!card || card.classList.contains("hidden")) return;
      if (tbodyIsMine(tbody)) return;
      jomaGpBusy = true;
      try {
        rebuildJomaGpBody();
      } finally {
        jomaGpBusy = false;
      }
    });
    obs.observe(tbody, { childList: true });
  }

  function observeJomaCardVisible() {
    const card = document.getElementById(JOMA_CARD_ID);
    if (!card || card.__jomaGpCardObserved) return;
    card.__jomaGpCardObserved = true;
    const obs = new MutationObserver(() => {
      if (card.classList.contains("hidden")) return;
      setTimeout(() => {
        if (jomaGpBusy) return;
        const table = document.getElementById(JOMA_TABLE_ID);
        const tbody = table && table.querySelector("tbody");
        if (tbody && tbodyIsMine(tbody)) return;
        jomaGpBusy = true;
        try {
          rebuildJomaGpBody();
        } finally {
          jomaGpBusy = false;
        }
      }, 0);
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function injectJomaGpStyle() {
    let s = document.getElementById("jomaGpAccordionStyle");
    if (!s) {
      s = document.createElement("style");
      s.id = "jomaGpAccordionStyle";
      (document.head || document.documentElement).appendChild(s);
    }
    if (s.dataset.layout === "joma-ex-v4") return;
    s.dataset.layout = "joma-ex-v4";
    s.textContent =
      "#processJomasCard .ex-view-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 12px}" +
      "#processJomasCard .ex-table-scroll{overflow-x:auto;width:100%;border:1px solid #e2e8f0;border-radius:10px;background:#fff}" +
      "#processJomasTable.joma-ex-table.ex-table-fixed{table-layout:fixed!important;width:100%;min-width:720px;border-collapse:separate;border-spacing:0}" +
      "#processJomasTable thead th{position:sticky;top:0;z-index:2;background:#f1f5f9;color:#475569;font-size:12px;font-weight:700;text-align:left;padding:10px 12px;border-bottom:2px solid #cbd5e1;box-shadow:0 1px 0 #e2e8f0}" +
      "#processJomasTable td{padding:8px 12px;vertical-align:middle;border-bottom:1px solid #f1f5f9;line-height:1.35;overflow-wrap:anywhere;word-break:break-word;color:#475569}" +
      "#processJomasTable .ex-dept-hdr td{background:linear-gradient(90deg,#dbeafe 0%,#eff6ff 100%);color:#475569;font-weight:700;font-size:14px;border-bottom:1px solid #93c5fd;border-top:3px solid #3b82f6}" +
      "#processJomasTable .ex-gp-hdr td{background:#f8fafc;color:#475569;font-weight:600}" +
      "#processJomasTable .ex-dept-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}" +
      "#processJomasTable .ex-joma-name{color:#475569;font-weight:700;cursor:pointer}" +
      "#processJomasTable .ex-joma-name:hover{text-decoration:underline;color:#334155}" +
      "#processJomasTable td.ex-proc-merged{vertical-align:top}" +
      "#processJomasTable .ex-gp-cell{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-left:12px;border-left:3px solid #cbd5e1;margin-left:2px}" +
      "#processJomasTable .ex-proc-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}" +
      "#processJomasTable .ex-proc-item{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}" +
      "#processJomasTable .ex-toggle{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;cursor:pointer;user-select:none;background:#fff;border:1px solid #cbd5e1;color:#334155;font-size:12px}" +
      "#processJomasTable .ex-toggle:hover{background:#e2e8f0}" +
      "#processJomasTable .ex-chip{display:inline-flex;align-items:center;gap:4px;min-height:24px;padding:2px 10px;border-radius:999px;background:#1e40af;color:#fff;font-size:12px;font-weight:600;white-space:nowrap}" +
      "#processJomasTable .ex-chip-muted{background:#64748b}" +
      "#processJomasTable .ex-link{color:#1d4ed8;cursor:pointer;text-decoration:underline;text-underline-offset:2px}" +
      "#processJomasTable .ex-link:hover{color:#1e3a8a}" +
      "#processJomasTable .ex-gp-label{font-weight:600;color:#475569}" +
      "#processJomasTable.joma-ex-table.ex-table-fixed th:nth-child(1),#processJomasTable.joma-ex-table.ex-table-fixed td:nth-child(1){width:34%}" +
      "#processJomasTable.joma-ex-table.ex-table-fixed th:nth-child(2),#processJomasTable.joma-ex-table.ex-table-fixed td:nth-child(2){width:33%}" +
      "#processJomasTable.joma-ex-table.ex-table-fixed th:nth-child(3),#processJomasTable.joma-ex-table.ex-table-fixed td:nth-child(3){width:33%}" +
      "#processGroupsTable{table-layout:fixed;width:100%;}" +
      "#processGroupsTable th:nth-child(1),#processGroupsTable td:nth-child(1){width:34%;min-width:0;}" +
      "#processGroupsTable th:nth-child(2),#processGroupsTable td:nth-child(2){width:51%;min-width:0;}" +
      "#processGroupsTable th:nth-child(3),#processGroupsTable td:nth-child(3){width:15%;}" +
      "#processGroupsTable td{overflow-wrap:anywhere;}" +
      "#processGroupsTable tbody tr.process-accordion-part{display:none;}" +
      "#processGroupsTable tbody tr.process-accordion-part.is-visible{display:table-row;}" +
      "#processGroupsTable tbody tr.process-accordion-hdr{cursor:pointer;}" +
      ".joma-gp-caret{display:inline-block;width:1em;margin-right:6px;color:#312e81;font-weight:600;cursor:pointer;}" +
      ".list-title-under-diagram{margin:6px 0 10px;}";
  }

  function setupJomaGpView() {
    injectJomaGpStyle();
    normalizeDiagramTitles();
    injectListTitlesUnderDiagram();
    injectStatsButtons();
    updateGpCountTiles();
    wrapJomasRender();
    wrapGroupsRender();
    observeJomaTableBody();
    observeJomaCardVisible();
    const card = document.getElementById(JOMA_CARD_ID);
    if (card && !card.classList.contains("hidden")) {
      jomaGpBusy = true;
      try {
        rebuildJomaGpBody();
      } finally {
        jomaGpBusy = false;
      }
    }
    const groupsCard = document.getElementById("processGroupsCard");
    if (groupsCard && !groupsCard.classList.contains("hidden")) addGroupCarets();
  }

  function boot() {
    FIELD_IDS.forEach((id) => upgradeInputToSelect(id));
    refreshAll();
    observeCard("catalogEditorCard");
    observeCatalogFormDisable();
    hookRenderTable();
    hookLoadCatalog();
    setupJomaGpView();
    [300, 1000, 2500].forEach((ms) => {
      setTimeout(() => {
        hookRenderTable();
        hookLoadCatalog();
        refreshAll();
        setupJomaGpView();
      }, ms);
    });
  }

  window.Joma = {
    collectAllJomas,
    refreshOptions: refreshAll,
    addCustomJoma: saveCustomJoma,
    removeCustomJoma,
    getCustomJomas: loadCustomJomas,
    getJomaStats,
    getProcessJomaBreakdown,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
