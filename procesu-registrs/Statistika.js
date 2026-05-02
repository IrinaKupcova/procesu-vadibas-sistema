/* Statistika: salokāmi bloki + tabulas */
(function () {
  "use strict";

  let orgOpen = false;
  let processOpen = false;
  let jomaOpen = false;
  const filterState = { org: {}, proc: {}, joma: {} };

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeGroup(g) {
    const t = String(g || "").trim().toLowerCase();
    if (t.includes("pamatdarb")) return "pamat";
    if (t.includes("atbalsta")) return "atbalsta";
    if (t.includes("vad")) return "vadibas";
    return "cits";
  }

  function norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function contains(text, term) {
    if (!term) return true;
    return norm(text).includes(norm(term));
  }

  function ensureFilterStyles() {
    if (document.getElementById("statsFilterCss")) return;
    const s = document.createElement("style");
    s.id = "statsFilterCss";
    s.textContent = `
      .th-filter-wrap{display:flex;align-items:center;gap:4px;justify-content:space-between}
      .th-filter-btn{font-size:10px;padding:2px 5px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;cursor:pointer;line-height:1}
      .th-filter-btn.active{background:#2563eb;color:#fff;border-color:#2563eb}
      .th-filter-box{display:none;margin-top:4px}
      .th-filter-box.open{display:block}
      .th-filter-box select{width:100%;font-size:11px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#fff}
    `;
    document.head.appendChild(s);
  }

  function ensureHeaderFilters(tableId, stateKey) {
    const table = $(tableId);
    if (!table) return;
    const headRow = table.querySelector("thead tr");
    if (!headRow || headRow.dataset.filtersReady === "1") return;
    Array.from(headRow.children).forEach((th, idx) => {
      const title = th.textContent || "";
      th.textContent = "";
      const wrap = document.createElement("div");
      wrap.className = "th-filter-wrap";
      const label = document.createElement("span");
      label.textContent = title;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "th-filter-btn";
      btn.textContent = "Filtrs";
      const box = document.createElement("div");
      box.className = "th-filter-box";
      const sel = document.createElement("select");
      sel.dataset.colIndex = String(idx);
      const e = document.createElement("option");
      e.value = "";
      e.textContent = "Visas vērtības";
      sel.appendChild(e);
      sel.addEventListener("change", () => {
        filterState[stateKey][String(idx)] = sel.value;
        btn.classList.toggle("active", norm(sel.value) !== "");
        applyFilters(tableId, stateKey);
        if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
      });
      btn.addEventListener("click", () => box.classList.toggle("open"));
      box.appendChild(sel);
      wrap.appendChild(label);
      wrap.appendChild(btn);
      th.appendChild(wrap);
      th.appendChild(box);
    });
    headRow.dataset.filtersReady = "1";
  }

  function refreshFilterOptions(tableId, stateKey) {
    const table = $(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    table.querySelectorAll(".th-filter-box select[data-col-index]").forEach((sel) => {
      const col = Number(sel.dataset.colIndex);
      const selected = filterState[stateKey][String(col)] || "";
      const vals = new Set();
      Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
        const v = String(tr.children[col]?.textContent || "").trim();
        if (v) vals.add(v);
      });
      sel.innerHTML = "";
      const e = document.createElement("option");
      e.value = "";
      e.textContent = "Visas vērtības";
      sel.appendChild(e);
      Array.from(vals).sort((a, b) => a.localeCompare(b, "lv")).forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
      });
      sel.value = selected;
      const btn = sel.closest("th")?.querySelector(".th-filter-btn");
      if (btn) btn.classList.toggle("active", norm(selected) !== "");
    });
  }

  function applyFilters(tableId, stateKey) {
    const table = $(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = true;
      for (const col in filterState[stateKey]) {
        const term = filterState[stateKey][col];
        if (!contains(tds[Number(col)]?.textContent || "", term)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function makeToggleTitle(h3, open) {
    if (!h3) return;
    h3.style.cursor = "pointer";
    h3.style.userSelect = "none";
    h3.textContent = `${open ? "▼" : "►"} ${h3.dataset.baseTitle || h3.textContent.replace(/^[▼►]\s*/, "")}`;
  }

  function ensurePanelStructure() {
    const reportsWrap = $("reportsBodyWrap");
    const orgCard = $("orgStatsCard");
    if (!reportsWrap || !orgCard) return null;

    const orgTitle = orgCard.querySelector("h3");
    if (orgTitle && !orgTitle.dataset.baseTitle) orgTitle.dataset.baseTitle = "Struktūrvienību statistika";

    let orgBody = $("orgStatsBody");
    if (!orgBody) {
      orgBody = document.createElement("div");
      orgBody.id = "orgStatsBody";
      orgBody.className = "hidden";
      const hint = $("orgStatsHint");
      if (hint) orgBody.appendChild(hint);
      orgCard.appendChild(orgBody);
    }

    if (orgTitle && !orgTitle.dataset.toggleBound) {
      orgTitle.addEventListener("click", () => {
        orgOpen = !orgOpen;
        orgBody.classList.toggle("hidden", !orgOpen);
        makeToggleTitle(orgTitle, orgOpen);
      });
      orgTitle.dataset.toggleBound = "1";
    }
    makeToggleTitle(orgTitle, orgOpen);
    orgBody.classList.toggle("hidden", !orgOpen);

    let processCard = $("processOutputStatsCard");
    if (!processCard) {
      processCard = document.createElement("div");
      processCard.id = "processOutputStatsCard";
      processCard.style.cssText = "margin-top:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;";
      processCard.innerHTML =
        '<h3 id="processOutputStatsTitle" style="margin:0 0 8px;font-size:16px;color:#0f172a;cursor:pointer;user-select:none">Galaprodukti procesos</h3>' +
        '<div id="processOutputStatsBody" class="hidden"></div>';
      reportsWrap.appendChild(processCard);
    }
    const processTitle = $("processOutputStatsTitle");
    const processBody = $("processOutputStatsBody");
    if (processTitle) processTitle.dataset.baseTitle = "Galaprodukti procesos";
    if (processTitle && !processTitle.dataset.toggleBound) {
      processTitle.addEventListener("click", () => {
        processOpen = !processOpen;
        processBody.classList.toggle("hidden", !processOpen);
        makeToggleTitle(processTitle, processOpen);
      });
      processTitle.dataset.toggleBound = "1";
    }
    makeToggleTitle(processTitle, processOpen);
    processBody.classList.toggle("hidden", !processOpen);

    let jomaCard = $("jomaStatsCard");
    if (!jomaCard) {
      jomaCard = document.createElement("div");
      jomaCard.id = "jomaStatsCard";
      jomaCard.style.cssText = "margin-top:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;";
      jomaCard.innerHTML =
        '<h3 id="jomaStatsTitle" style="margin:0 0 8px;font-size:16px;color:#0f172a;cursor:pointer;user-select:none">Jomu statistika</h3>' +
        '<div id="jomaStatsBody" class="hidden"></div>';
      reportsWrap.appendChild(jomaCard);
    }
    const jomaTitle = $("jomaStatsTitle");
    const jomaBody = $("jomaStatsBody");
    if (jomaTitle) jomaTitle.dataset.baseTitle = "Jomu statistika";
    if (jomaTitle && !jomaTitle.dataset.toggleBound) {
      jomaTitle.addEventListener("click", () => {
        jomaOpen = !jomaOpen;
        jomaBody.classList.toggle("hidden", !jomaOpen);
        makeToggleTitle(jomaTitle, jomaOpen);
      });
      jomaTitle.dataset.toggleBound = "1";
    }
    makeToggleTitle(jomaTitle, jomaOpen);
    jomaBody.classList.toggle("hidden", !jomaOpen);

    return { orgBody, processBody, jomaBody };
  }

  function removeStatsTableTotals(host) {
    if (!host) return;
    host.querySelectorAll(".stats-table-total").forEach((n) => n.remove());
  }

  function renderOrgTable(orgBody, processRows, catalogRows) {
    if (!orgBody) return;
    removeStatsTableTotals(orgBody);
    const processIndex = new Map();
    processRows.forEach((r) => {
      const k = String((r && r.processNo) || "").trim();
      if (k) processIndex.set(k, r);
    });

    const byUnit = new Map();
    catalogRows.forEach((c) => {
      const unit = String((c && c.unit) || "").trim();
      if (!unit) return;
      if (!byUnit.has(unit)) {
        byUnit.set(unit, { processGroupPairs: [], services: new Set(), pamat: 0, atbalsta: 0, vadibas: 0 });
      }
      const row = byUnit.get(unit);
      const procNo = String((c && c.procNo) || "").trim();
      const key = procNo;
      const p = processIndex.get(key);
      if (p) {
        const procLabel = String((p && p.processNo) || "").trim() || procNo || "(bez procesa Nr.)";
        const g = normalizeGroup(p.group);
        row.processGroupPairs.push({ processNo: procLabel, group: g });
        const svc = String((p && p.services) || "").trim();
        if (svc) row.services.add(svc);
        if (g === "pamat") row.pamat += 1;
        else if (g === "atbalsta") row.atbalsta += 1;
        else if (g === "vadibas") row.vadibas += 1;
      } else if (procNo) {
        row.processGroupPairs.push({ processNo: procNo, group: "cits" });
      }
    });

    const old = $("orgStatsTable");
    if (old && old.parentElement) old.parentElement.removeChild(old);
    const tbl = document.createElement("table");
    tbl.id = "orgStatsTable";
    tbl.innerHTML =
      "<thead><tr><th>Procesa izpildītājs, pārvalde</th><th>Procesi</th><th>Pamatdarbības procesi</th><th>Atbalsta procesi</th><th>Vadības procesi</th><th>Pakalpojumi</th></tr></thead><tbody></tbody>";
    const tb = tbl.querySelector("tbody");
    Array.from(byUnit.keys()).sort((a, b) => a.localeCompare(b, "lv")).forEach((unit) => {
      const x = byUnit.get(unit);
      const processUnique = new Set(x.processGroupPairs.map((it) => String(it.processNo || "").trim()).filter(Boolean));
      const groupedList = `<strong>Procesi kopā: ${processUnique.size}</strong>`;
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${unit}</td><td>${groupedList || "-"}</td><td>${x.pamat}</td><td>${x.atbalsta}</td><td>${x.vadibas}</td><td>${x.services.size}</td>`;
      tb.appendChild(tr);
    });
    const hint = $("orgStatsHint");
    if (hint) hint.textContent = "Statistika pēc procesa izpildītāja, pārvaldes (no Galaproduktu kataloga).";
    orgBody.appendChild(tbl);
    const sumPamat = Array.from(byUnit.values()).reduce((s, x) => s + x.pamat, 0);
    const sumAtbalsta = Array.from(byUnit.values()).reduce((s, x) => s + x.atbalsta, 0);
    const sumVadibas = Array.from(byUnit.values()).reduce((s, x) => s + x.vadibas, 0);
    const sumPak = Array.from(byUnit.values()).reduce((s, x) => s + x.services.size, 0);
    const tot = document.createElement("p");
    tot.className = "stats-table-total";
    tot.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:600;color:#0f172a;";
    tot.textContent =
      `Kopskaits — tabulas rindas: ${byUnit.size}; pamatdarbības (summa): ${sumPamat}; atbalsta: ${sumAtbalsta}; vadības: ${sumVadibas}; atšķirīgu pakalpojumu (summa): ${sumPak}.`;
    orgBody.appendChild(tot);
    ensureHeaderFilters("orgStatsTable", "org");
    refreshFilterOptions("orgStatsTable", "org");
    applyFilters("orgStatsTable", "org");
  }

  function getStatsProcessRows() {
    if (typeof window.getMergedProcessRegisterRows === "function") {
      const m = window.getMergedProcessRegisterRows();
      if (Array.isArray(m) && m.length) return m;
    }
    return typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
  }

  function countGalaproduktiInProcess(r) {
    const raw = String((r && r.products) || "").trim();
    if (!raw) return 0;
    return raw
      .split(/[;\n]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean).length;
  }

  /** GP skaits tāpat kā procesu tabulas loģiskajam procesam (gpItems / productsText), nevis katras DB rindas «products» lauks atsevišķi. */
  function countGalaproduktiOnMergedRow(r) {
    if (!r) return 0;
    if (Array.isArray(r.gpItems) && r.gpItems.length) {
      const named = r.gpItems.filter((g) => String((g && g.name) || "").trim()).length;
      if (named > 0) return named;
    }
    const pt = String((r && r.productsText) || "").trim();
    if (pt) {
      return pt
        .split(/[;\n]+/)
        .map((x) => String(x || "").trim())
        .filter(Boolean).length;
    }
    return countGalaproduktiInProcess(r);
  }

  function normProcessStatsKey(name) {
    return String(name || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** Pārskats «Galaprodukti procesos» — apvienotas procesu reģistra rindas; viena rinda uz procesa nosaukumu, skaits = GP šim procesam. */
  function renderProcessOutputTable(processBody) {
    if (!processBody) return;
    removeStatsTableTotals(processBody);
    const merged = getStatsProcessRows();
    const byName = new Map();
    merged.forEach((r) => {
      const displayName = String((r && r.process) || "").trim() || "—";
      const k = normProcessStatsKey(displayName);
      const n = countGalaproduktiOnMergedRow(r);
      if (!byName.has(k)) {
        byName.set(k, { processName: displayName, gpCount: 0 });
      }
      byName.get(k).gpCount += n;
    });
    const rows = Array.from(byName.values());

    const old = $("processOutputStatsTable");
    if (old && old.parentElement) old.parentElement.removeChild(old);
    const tbl = document.createElement("table");
    tbl.id = "processOutputStatsTable";
    tbl.innerHTML =
      "<thead><tr><th>Procesa numurs</th><th>Process</th><th>Galaproduktu skaits procesā</th></tr></thead><tbody></tbody>";
    const tb = tbl.querySelector("tbody");
    rows
      .sort((a, b) => a.processName.localeCompare(b.processName, "lv"))
      .forEach((x) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td></td><td>${x.processName}</td><td>${x.gpCount}</td>`;
        tb.appendChild(tr);
      });
    processBody.appendChild(tbl);
    const totalGp = rows.reduce((s, x) => s + x.gpCount, 0);
    const tot = document.createElement("p");
    tot.className = "stats-table-total";
    tot.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:600;color:#0f172a;";
    tot.textContent = `Kopskaits — procesi (ieraksti tabulā): ${rows.length}; galaprodukti (visiem procesiem kopā): ${totalGp}.`;
    processBody.appendChild(tot);
    ensureHeaderFilters("processOutputStatsTable", "proc");
    refreshFilterOptions("processOutputStatsTable", "proc");
    applyFilters("processOutputStatsTable", "proc");
  }

  function gpLinesForJomaStats(r) {
    return Array.isArray(r.gpItems) && r.gpItems.length
      ? r.gpItems
      : [{ jomaText: String((r && r.darbibasJoma) || "") }];
  }

  function processTouchesJomaLabel(r, jomaLabel) {
    return gpLinesForJomaStats(r).some((gp) => String((gp && gp.jomaText) || "").trim() === jomaLabel);
  }

  /** Jomu sadalījums pēc tām pašām vērtībām kā procesu tabulas «Joma» kolonnas filtrs (katrs GP). */
  function renderJomaStatsTable(jomaBody) {
    if (!jomaBody) return;
    removeStatsTableTotals(jomaBody);
    const merged = getStatsProcessRows();
    const collect =
      typeof window.collectProcessTableJomaFilterLikeValues === "function"
        ? window.collectProcessTableJomaFilterLikeValues
        : null;
    const uniqJomas = collect ? collect(merged) : new Set();
    if (!collect) {
      merged.forEach((r) => {
        const j = String((r && r.darbibasJoma) || "").trim() || "(nav jomas)";
        uniqJomas.add(j);
      });
    }
    let navJomas = 0;
    merged.forEach((r) => {
      const any = gpLinesForJomaStats(r).some((gp) => String((gp && gp.jomaText) || "").trim());
      if (!any) navJomas += 1;
    });
    const byJoma = new Map();
    Array.from(uniqJomas)
      .sort((a, b) => a.localeCompare(b, "lv"))
      .forEach((joma) => {
        let n = 0;
        merged.forEach((r) => {
          if (processTouchesJomaLabel(r, joma)) n += 1;
        });
        byJoma.set(joma, n);
      });
    if (navJomas > 0) byJoma.set("(nav jomas)", navJomas);

    const old = $("jomaStatsTable");
    if (old && old.parentElement) old.parentElement.removeChild(old);
    const tbl = document.createElement("table");
    tbl.id = "jomaStatsTable";
    tbl.innerHTML = "<thead><tr><th>Joma</th><th>Procesu skaits</th></tr></thead><tbody></tbody>";
    const tb = tbl.querySelector("tbody");
    const jomaKeys = Array.from(byJoma.keys()).filter((k) => k !== "(nav jomas)");
    jomaKeys.sort((a, b) => a.localeCompare(b, "lv"));
    if (byJoma.has("(nav jomas)")) jomaKeys.push("(nav jomas)");
    jomaKeys.forEach((joma) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${joma}</td><td>${byJoma.get(joma)}</td>`;
      tb.appendChild(tr);
    });
    jomaBody.appendChild(tbl);
    const totalProcesi = merged.length;
    const tot = document.createElement("p");
    tot.className = "stats-table-total";
    tot.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:600;color:#0f172a;";
    tot.textContent = `Kopskaits — procesi (loģiskie): ${totalProcesi}; jomu grupas tabulā: ${byJoma.size}.`;
    jomaBody.appendChild(tot);
    ensureHeaderFilters("jomaStatsTable", "joma");
    refreshFilterOptions("jomaStatsTable", "joma");
    applyFilters("jomaStatsTable", "joma");
  }

  function renderOrgStats() {
    const refs = ensurePanelStructure();
    if (!refs) return;
    const processRows = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    const catalogRows = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    renderOrgTable(refs.orgBody, processRows, catalogRows);
    renderProcessOutputTable(refs.processBody);
    renderJomaStatsTable(refs.jomaBody);
    if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
  }

  function hasActiveStatsFilters() {
    return Object.values(filterState.org || {}).some((v) => norm(v) !== "") ||
      Object.values(filterState.proc || {}).some((v) => norm(v) !== "") ||
      Object.values(filterState.joma || {}).some((v) => norm(v) !== "");
  }

  function clearStatsFilters() {
    filterState.org = {};
    filterState.proc = {};
    filterState.joma = {};
    document.querySelectorAll(
      "#orgStatsTable .th-filter-box select[data-col-index], #processOutputStatsTable .th-filter-box select[data-col-index], #jomaStatsTable .th-filter-box select[data-col-index]"
    ).forEach((s) => {
      s.value = "";
    });
    document.querySelectorAll(
      "#orgStatsTable .th-filter-btn.active, #processOutputStatsTable .th-filter-btn.active, #jomaStatsTable .th-filter-btn.active"
    ).forEach((b) => {
      b.classList.remove("active");
    });
    applyFilters("orgStatsTable", "org");
    applyFilters("processOutputStatsTable", "proc");
    applyFilters("jomaStatsTable", "joma");
    if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
  }

  window.renderOrgStats = renderOrgStats;
  window.hasActiveStatsFilters = hasActiveStatsFilters;
  window.clearStatsFilters = clearStatsFilters;

  function boot() {
    ensureFilterStyles();
    renderOrgStats();
    window.addEventListener("app:db-sync", renderOrgStats);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
