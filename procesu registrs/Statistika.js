/* Statistika: salokāmi bloki + tabulas */
(function () {
  "use strict";

  let orgOpen = false;
  let processOpen = false;
  const filterState = { org: {}, proc: {} };

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
        '<h3 id="processOutputStatsTitle" style="margin:0 0 8px;font-size:16px;color:#0f172a;cursor:pointer;user-select:none">Galaproduktu veidi procesos</h3>' +
        '<div id="processOutputStatsBody" class="hidden"></div>';
      reportsWrap.appendChild(processCard);
    }
    const processTitle = $("processOutputStatsTitle");
    const processBody = $("processOutputStatsBody");
    if (processTitle && !processTitle.dataset.baseTitle) processTitle.dataset.baseTitle = "Galaproduktu veidi procesos";
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

    return { orgBody, processBody };
  }

  function renderOrgTable(orgBody, processRows, catalogRows) {
    if (!orgBody) return;
    const processIndex = new Map();
    processRows.forEach((r) => {
      const k = `${String((r && r.taskNo) || "").trim()}|${String((r && r.processNo) || "").trim()}`;
      if (k !== "|") processIndex.set(k, r);
    });

    const byUnit = new Map();
    catalogRows.forEach((c) => {
      const unit = String((c && c.unit) || "").trim();
      if (!unit) return;
      if (!byUnit.has(unit)) {
        byUnit.set(unit, { tasks: new Set(), processGroupPairs: [], services: new Set(), pamat: 0, atbalsta: 0, vadibas: 0 });
      }
      const row = byUnit.get(unit);
      const taskNo = String((c && c.taskNo) || "").trim();
      const procNo = String((c && c.procNo) || "").trim();
      const key = `${taskNo}|${procNo}`;
      const p = processIndex.get(key);
      if (taskNo) row.tasks.add(taskNo);
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
      "<thead><tr><th>Struktūrvienība izpildītājs</th><th>Uzdevumi</th><th>Procesi</th><th>pamatdarbības procesi</th><th>atbalsta procesi</th><th>Vadības procesi</th><th>Pakalpojumi</th></tr></thead><tbody></tbody>";
    const tb = tbl.querySelector("tbody");
    Array.from(byUnit.keys()).sort((a, b) => a.localeCompare(b, "lv")).forEach((unit) => {
      const x = byUnit.get(unit);
      const processUnique = new Set(x.processGroupPairs.map((it) => String(it.processNo || "").trim()).filter(Boolean));
      const groupedList = `<strong>Procesi kopā: ${processUnique.size}</strong>`;
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${unit}</td><td>${x.tasks.size}</td><td>${groupedList || "-"}</td><td>${x.pamat}</td><td>${x.atbalsta}</td><td>${x.vadibas}</td><td>${x.services.size}</td>`;
      tb.appendChild(tr);
    });
    const hint = $("orgStatsHint");
    if (hint) hint.textContent = "Statistika pēc struktūrvienības izpildītāja (no Galaproduktu veidu kataloga).";
    orgBody.appendChild(tbl);
    ensureHeaderFilters("orgStatsTable", "org");
    refreshFilterOptions("orgStatsTable", "org");
    applyFilters("orgStatsTable", "org");
  }

  function renderProcessOutputTable(processBody, processRows, catalogRows) {
    if (!processBody) return;
    const byProc = new Map();
    processRows.forEach((r) => {
      const taskNo = String((r && r.taskNo) || "").trim();
      const procNo = String((r && r.processNo) || "").trim();
      const key = `${taskNo}|${procNo}`;
      if (!byProc.has(key)) {
        byProc.set(key, {
          processLabel: [procNo, String((r && r.process) || "").trim()].filter(Boolean).join(" - ") || procNo || "(bez procesa)",
          outputs: new Set(),
          executors: new Set(),
        });
      }
    });
    catalogRows.forEach((c) => {
      const key = `${String((c && c.taskNo) || "").trim()}|${String((c && c.procNo) || "").trim()}`;
      if (!byProc.has(key)) {
        byProc.set(key, { processLabel: String((c && c.procNo) || "").trim() || "(bez procesa)", outputs: new Set(), executors: new Set() });
      }
      const x = byProc.get(key);
      const t = String((c && c.type) || "").trim();
      const u = String((c && c.unit) || "").trim();
      if (t) x.outputs.add(t);
      if (u) x.executors.add(u);
    });

    const old = $("processOutputStatsTable");
    if (old && old.parentElement) old.parentElement.removeChild(old);
    const tbl = document.createElement("table");
    tbl.id = "processOutputStatsTable";
    tbl.innerHTML = "<thead><tr><th>Process</th><th>Galaproduktu veidi (skaits)</th><th>Izpildītāji (skaits)</th></tr></thead><tbody></tbody>";
    const tb = tbl.querySelector("tbody");
    Array.from(byProc.values()).sort((a, b) => a.processLabel.localeCompare(b.processLabel, "lv")).forEach((x) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${x.processLabel}</td><td>${x.outputs.size}</td><td>${x.executors.size}</td>`;
      tb.appendChild(tr);
    });
    processBody.appendChild(tbl);
    ensureHeaderFilters("processOutputStatsTable", "proc");
    refreshFilterOptions("processOutputStatsTable", "proc");
    applyFilters("processOutputStatsTable", "proc");
  }

  function renderOrgStats() {
    const refs = ensurePanelStructure();
    if (!refs) return;
    const processRows = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    const catalogRows = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    renderOrgTable(refs.orgBody, processRows, catalogRows);
    renderProcessOutputTable(refs.processBody, processRows, catalogRows);
    if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
  }

  function hasActiveStatsFilters() {
    return Object.values(filterState.org || {}).some((v) => norm(v) !== "") ||
      Object.values(filterState.proc || {}).some((v) => norm(v) !== "");
  }

  function clearStatsFilters() {
    filterState.org = {};
    filterState.proc = {};
    document.querySelectorAll("#orgStatsTable .th-filter-box select[data-col-index], #processOutputStatsTable .th-filter-box select[data-col-index]").forEach((s) => {
      s.value = "";
    });
    document.querySelectorAll("#orgStatsTable .th-filter-btn.active, #processOutputStatsTable .th-filter-btn.active").forEach((b) => {
      b.classList.remove("active");
    });
    applyFilters("orgStatsTable", "org");
    applyFilters("processOutputStatsTable", "proc");
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
