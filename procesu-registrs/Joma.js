/**
 * Joma — GP kartiņā jomas izvēle no pilna jomu saraksta.
 * Pārveido #cDarbibasJoma par <select> ar visām zināmām jomām.
 */
(function () {
  "use strict";

  const FIELD_IDS = ["cDarbibasJoma"];
  const EMPTY_LABEL = "— Izvēlēties jomu —";
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

    function add(label) {
      splitJomaValues(label).forEach((display) => {
        const key = normKey(display);
        if (!key) return;
        if (!seen.has(key) || String(display).length > String(seen.get(key)).length) {
          seen.set(key, display);
        }
      });
    }

    const rows = [];
    if (typeof window.getMergedProcessRegisterRows === "function") {
      rows.push.apply(rows, window.getMergedProcessRegisterRows() || []);
    }
    if (typeof window.getProcessRows === "function") {
      rows.push.apply(rows, window.getProcessRows() || []);
    }
    if (typeof window.getCatalogRows === "function") {
      rows.push.apply(rows, window.getCatalogRows() || []);
    }

    rows.forEach((row) => {
      if (!row || typeof row !== "object") return;
      add(row.darbibasJoma);
      if (row.jomaText) add(row.jomaText);
      if (Array.isArray(row.gpItems)) {
        row.gpItems.forEach((gp) => add(gp && gp.jomaText));
      }
    });

    loadCustomJomas().forEach(add);

    if (window.JomaKartina && typeof window.JomaKartina.listJomaLabels === "function") {
      window.JomaKartina.listJomaLabels().forEach(add);
    }

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));
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
    const cur = pickSingleJoma(currentValue != null ? currentValue : select.value);
    const jomas = collectAllJomas();
    if (cur && !jomas.some((j) => j === cur)) jomas.unshift(cur);
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
    const obs = new MutationObserver(() => {
      if (card.classList.contains("hidden")) return;
      // fillForm / fillCatalogForm pēc kartiņas atvēršanas — pagaidām, lai vērtība jau ir iestatīta.
      setTimeout(() => refreshAll(), 0);
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
  const gpExpanded = new Set();
  let jomaGpBusy = false;
  let originalJomasRender = null;

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

    function addGp(jomaLabels, gpName, row, procKey) {
      const name = String(gpName || "").trim();
      if (!name) return;
      const gpKey = normKey(name);
      allGp.add(gpKey);
      const list = jomaLabels && jomaLabels.length ? jomaLabels : ["—"];
      list.forEach((jl) => {
        const bucket = ensureBucket(jl);
        if (!bucket.gps.has(gpKey)) bucket.gps.set(gpKey, { name, row });
        if (procKey) bucket.procs.add(procKey);
      });
    }

    const merged = getMergedRowsSafe();
    let usedMerged = false;
    merged.forEach((r) => {
      const procKey = normKey(String((r && r.processNo) || (r && r.process) || ""));
      if (procKey) allProc.add(procKey);
      const gpItems = Array.isArray(r && r.gpItems) ? r.gpItems : [];
      gpItems.forEach((gp) => {
        const gpName = String((gp && gp.name) || "").trim();
        if (!gpName) return;
        usedMerged = true;
        const catRow = catLookup.get(normKey(gpName)) || {
          type: gpName,
          procNo: String((gp && gp.procNo) || (r && r.processNo) || ""),
        };
        let jomas = splitJomaValues(gp && gp.jomaText);
        if (!jomas.length) jomas = splitJomaValues(catRow && catRow.darbibasJoma);
        if (!jomas.length) jomas = splitJomaValues(r && r.darbibasJoma);
        addGp(jomas, gpName, catRow, procKey);
      });
    });

    // Rezerves variants — ja apvienotās rindas nedeva GP, grupējam kataloga rindas pēc darbibasJoma.
    if (!usedMerged) {
      getCatalogRowsSafe().forEach((r) => {
        const gpName = String((r && r.type) || "").trim();
        if (!gpName) return;
        const procKey = normKey(String((r && r.procNo) || ""));
        if (procKey) allProc.add(procKey);
        addGp(splitJomaValues(r && r.darbibasJoma), gpName, r, procKey);
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
  const GP_TILE_TARGETS = [
    { card: "processListCard", id: "statProcessGpCount" },
    { card: "processGroupsCard", id: "pgStatProcessGpCount" },
    { card: "processJomasCard", id: "pjStatGpCount" },
  ];

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

  function updateJomaTableHead() {
    const table = document.getElementById(JOMA_TABLE_ID);
    if (!table) return;
    const ths = table.querySelectorAll("thead th");
    if (ths.length >= 3) {
      if (ths[1].textContent !== "Galaprodukts") {
        ths[1].textContent = "Galaprodukts";
        ths[1].setAttribute("data-filter-label", "Galaprodukts");
      }
      if (ths[2].textContent !== "Galaprodukta kartiņa") {
        ths[2].textContent = "Galaprodukta kartiņa";
        ths[2].setAttribute("data-filter-label", "Galaprodukta kartiņa");
      }
    }
  }

  function tbodyIsMine(tbody) {
    return !!(tbody && tbody.querySelector(".joma-gp-hdr"));
  }

  function rebuildJomaGpBody() {
    const card = document.getElementById(JOMA_CARD_ID);
    const table = document.getElementById(JOMA_TABLE_ID);
    if (!card || !table) return;
    if (card.classList.contains("hidden")) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;

    updateJomaTableHead();
    updateGpCountTiles();

    const data = buildJomaGpData();
    const byJoma = data.byJoma;
    const sorted = Array.from(byJoma.values()).sort((a, b) =>
      String(a.display || "").localeCompare(String(b.display || ""), "lv", { sensitivity: "base" })
    );

    tbody.innerHTML = "";
    sorted.forEach((bucket) => {
      const jomaName = String(bucket.display || "—");
      const gps = Array.from(bucket.gps.values()).sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "lv", { sensitivity: "base" })
      );
      const open = gpExpanded.has(jomaName);

      const hdr = document.createElement("tr");
      hdr.className = "process-accordion-hdr joma-gp-hdr";
      hdr.style.cursor = "pointer";
      hdr.setAttribute("data-joma-gp-name", jomaName);
      hdr.setAttribute("aria-expanded", open ? "true" : "false");

      const tdJoma = document.createElement("td");
      if (jomaName !== "—") {
        const jomaOpen = document.createElement("span");
        jomaOpen.className = "pj-joma-open";
        jomaOpen.textContent = jomaName;
        jomaOpen.title = "Atvērt informāciju par jomu";
        jomaOpen.onclick = (ev) => {
          ev.stopPropagation();
          if (typeof window.openJomaEditor === "function") window.openJomaEditor(jomaName);
        };
        tdJoma.appendChild(jomaOpen);
      } else {
        const strong = document.createElement("strong");
        strong.textContent = jomaName;
        tdJoma.appendChild(strong);
      }

      const tdCount = document.createElement("td");
      const gpWord = gps.length === 1 ? "galaprodukts" : "galaprodukti";
      const caret = document.createElement("span");
      caret.className = "joma-gp-caret" + (open ? " open" : "");
      caret.textContent = open ? "▾" : "▸";
      caret.title = open ? "Aizvērt galaproduktu sarakstu" : "Atvērt galaproduktu sarakstu";
      const cntStrong = document.createElement("strong");
      cntStrong.textContent = `Kopā: ${gps.length} ${gpWord}`;
      tdCount.appendChild(caret);
      tdCount.appendChild(document.createTextNode(" "));
      tdCount.appendChild(cntStrong);
      const tdEmpty = document.createElement("td");

      hdr.appendChild(tdJoma);
      hdr.appendChild(tdCount);
      hdr.appendChild(tdEmpty);
      hdr.onclick = (ev) => {
        if (ev.target.closest("button") || ev.target.closest(".pj-joma-open")) return;
        if (gpExpanded.has(jomaName)) gpExpanded.delete(jomaName);
        else gpExpanded.add(jomaName);
        jomaGpBusy = true;
        try {
          rebuildJomaGpBody();
        } finally {
          jomaGpBusy = false;
        }
      };
      tbody.appendChild(hdr);

      gps.forEach((gp) => {
        const tr = document.createElement("tr");
        tr.className = "process-accordion-part joma-gp-part";
        tr.classList.toggle("is-visible", !!open);
        const td1 = document.createElement("td");
        td1.textContent = "";
        const td2 = document.createElement("td");
        const gpOpen = document.createElement("span");
        gpOpen.className = "pj-process-open";
        gpOpen.textContent = String(gp.name || "");
        gpOpen.title = "Atvērt galaprodukta kartiņu";
        gpOpen.onclick = () => {
          if (typeof window.openCatalogEditor === "function") window.openCatalogEditor(gp.row);
        };
        td2.appendChild(gpOpen);
        const td3 = document.createElement("td");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "secondary";
        btn.textContent = "Galaprodukta kartiņa";
        btn.onclick = () => {
          if (typeof window.openCatalogEditor === "function") window.openCatalogEditor(gp.row);
        };
        td3.appendChild(btn);
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tbody.appendChild(tr);
      });
    });

    if (typeof window.applyTableColumnSizing === "function") {
      try { window.applyTableColumnSizing(JOMA_TABLE_ID); } catch (_) {}
    }
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
    if (document.getElementById("jomaGpAccordionStyle")) return;
    const style = document.createElement("style");
    style.id = "jomaGpAccordionStyle";
    style.textContent =
      // Jomu tabula — fiksēts izkārtojums, lai, atverot akordeonu, kolonnas nelec.
      "#processJomasTable{table-layout:fixed;width:100%;}" +
      "#processJomasTable th:nth-child(1),#processJomasTable td:nth-child(1){width:34%;min-width:0;}" +
      "#processJomasTable th:nth-child(2),#processJomasTable td:nth-child(2){width:51%;min-width:0;}" +
      "#processJomasTable th:nth-child(3),#processJomasTable td:nth-child(3){width:15%;}" +
      "#processJomasTable td{overflow-wrap:anywhere;}" +
      "#processJomasTable tbody tr.joma-gp-part{display:none;}" +
      "#processJomasTable tbody tr.joma-gp-part.is-visible{display:table-row;}" +
      "#processJomasTable tbody tr.joma-gp-hdr{cursor:pointer;}" +
      // Procesu grupu tabula — tāds pats akordeons (ciet pēc noklusējuma) un fiksēts izkārtojums.
      "#processGroupsTable{table-layout:fixed;width:100%;}" +
      "#processGroupsTable th:nth-child(1),#processGroupsTable td:nth-child(1){width:34%;min-width:0;}" +
      "#processGroupsTable th:nth-child(2),#processGroupsTable td:nth-child(2){width:51%;min-width:0;}" +
      "#processGroupsTable th:nth-child(3),#processGroupsTable td:nth-child(3){width:15%;}" +
      "#processGroupsTable td{overflow-wrap:anywhere;}" +
      "#processGroupsTable tbody tr.process-accordion-part{display:none;}" +
      "#processGroupsTable tbody tr.process-accordion-part.is-visible{display:table-row;}" +
      "#processGroupsTable tbody tr.process-accordion-hdr{cursor:pointer;}" +
      ".joma-gp-caret{display:inline-block;width:1em;margin-right:6px;color:#312e81;font-weight:600;cursor:pointer;transition:transform .12s ease;}" +
      ".list-title-under-diagram{margin:6px 0 10px;}";
    (document.head || document.documentElement).appendChild(style);
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
