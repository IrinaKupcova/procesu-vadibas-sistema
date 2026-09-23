/**
 * Izpildītāji: uzskaite pēc struktūrvienības → galaprodukts → process.
 * Avots: GP katalogs (primārais) + procesu reģistrs (GP bez kataloga ieraksta).
 */
(function () {
  "use strict";

  const TABLE_ID = "executorsTable";
  const ROWS_ID = "executorsTableBody";
  let inlineEditMode = false;
  const executorDeptExpanded = new Set();
  const BULK_BTN_ID = "executorsBulkAccordionToggleBtn";
  const SUMMARY_ID = "executorsViewSummary";
  const DEPT_EMPTY_LABEL = "Nav norādīta struktūrvienība";

  const COL_DEFS = [
    { label: "Pārvalde", filter: "Pārvalde" },
    {
      label: "Struktūrvienība/ amats, kas atbild par galaprodukta radīšanu",
      filter: "Struktūrvienība/ amats",
    },
    { label: "Galaprodukts", filter: "Galaprodukts" },
    { label: "Process", filter: "Process" },
  ];

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function syncExecutorsTableColumns(table) {
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
    const thHtml = COL_DEFS.map(
      (c) => `<th data-filter-label="${escHtml(c.filter)}">${escHtml(c.label)}</th>`
    ).join("");
    const colOrderKey = "parvalde-dept-gp-proc";
    if (tr.children.length !== COL_DEFS.length || tr.dataset.colOrder !== colOrderKey) {
      tr.innerHTML = thHtml;
      tr.dataset.colOrder = colOrderKey;
      tr.dataset.filtersReady = "";
      if (table.dataset) table.dataset.exFiltersInit = "";
    } else {
      COL_DEFS.forEach((c, i) => {
        if (!tr.children[i]) return;
        tr.children[i].setAttribute("data-filter-label", c.filter);
        if (!tr.children[i].querySelector(".th-filter-wrap")) {
          tr.children[i].textContent = c.label;
        }
      });
    }
  }

  function ensureControls(card) {
    if (!card) return;
    if (!document.getElementById(SUMMARY_ID)) {
      const summary = document.createElement("p");
      summary.id = SUMMARY_ID;
      summary.className = "ex-view-summary";
      summary.setAttribute("aria-live", "polite");
      const toolbar = card.querySelector(".toolbar");
      if (toolbar) toolbar.insertAdjacentElement("afterend", summary);
      else card.insertBefore(summary, card.firstChild);
    }
    if (document.getElementById(BULK_BTN_ID)) return;
    const controls = document.createElement("div");
    controls.className = "ex-view-controls";
    const bulk = document.createElement("button");
    bulk.type = "button";
    bulk.id = BULK_BTN_ID;
    bulk.className = "secondary";
    bulk.textContent = "Atvērt visus akordeonus";
    controls.appendChild(bulk);
    const summary = document.getElementById(SUMMARY_ID);
    if (summary) summary.insertAdjacentElement("afterend", controls);
    else card.insertBefore(controls, card.firstChild);
  }

  function getText(v) {
    return v === null || v === undefined ? "" : String(v).trim();
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

  function ensureTable(card) {
    if (!card) return null;

    ensureControls(card);
    let table = document.getElementById(TABLE_ID);
    if (!table) {
      table = document.createElement("table");
      table.id = TABLE_ID;
      table.className = "ex-table";
      table.innerHTML = `
        <colgroup class="ex-cols"><col><col><col><col></colgroup>
        <thead>
          <tr>
            ${COL_DEFS.map(
              (c) => `<th data-filter-label="${escHtml(c.filter)}">${escHtml(c.label)}</th>`
            ).join("")}
          </tr>
        </thead>
        <tbody id="${ROWS_ID}"></tbody>
      `;
      const hint = card.querySelector("p.hint");
      if (hint) hint.remove();
      const wrap = document.createElement("div");
      wrap.className = "ex-table-scroll";
      wrap.appendChild(table);
      card.appendChild(wrap);
    } else {
      let tb = document.getElementById(ROWS_ID);
      if (!tb) {
        const tbody = document.createElement("tbody");
        tbody.id = ROWS_ID;
        table.appendChild(tbody);
      }
    }

    syncExecutorsTableColumns(table);
    lockExecutorsTableLayout(table);
    return table;
  }

  function lockExecutorsTableLayout(table) {
    if (!table) return;
    table.classList.add("ex-table-fixed");
    let cg = table.querySelector("colgroup.ex-cols");
    if (!cg) {
      cg = document.createElement("colgroup");
      cg.className = "ex-cols";
      cg.innerHTML = "<col><col><col><col>";
      table.insertBefore(cg, table.firstChild);
    } else if (cg.children.length !== 4) {
      cg.innerHTML = "<col><col><col><col>";
    }
  }

  function ensureStyles() {
    let s = document.getElementById("executorsAccordionCss");
    if (!s) {
      s = document.createElement("style");
      s.id = "executorsAccordionCss";
      document.head.appendChild(s);
    }
    if (s.dataset.layout === "dept-gp-proc-v3") return;
    s.dataset.layout = "dept-gp-proc-v3";
    s.textContent = `
      #executorsCard .ex-view-summary{margin:8px 0 4px;font-size:13px;color:#475569;line-height:1.4}
      #executorsCard .ex-view-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 12px}
      #executorsCard .ex-table-scroll{overflow-x:auto;width:100%;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
      #${TABLE_ID}.ex-table-fixed{table-layout:fixed!important;width:100%;min-width:920px;border-collapse:separate;border-spacing:0}
      #${TABLE_ID} thead th{
        position:sticky;top:0;z-index:2;
        background:#f1f5f9;color:#0f172a;font-size:12px;font-weight:700;
        text-align:left;padding:10px 12px;border-bottom:2px solid #cbd5e1;
        box-shadow:0 1px 0 #e2e8f0
      }
      #${TABLE_ID} td{padding:8px 12px;vertical-align:middle;border-bottom:1px solid #f1f5f9;line-height:1.35}
      #${TABLE_ID} .ex-dept-hdr td{
        background:linear-gradient(90deg,#dbeafe 0%,#eff6ff 100%);
        color:#0f172a;font-weight:700;font-size:14px;
        border-bottom:1px solid #93c5fd;border-top:3px solid #3b82f6
      }
      #${TABLE_ID} .ex-gp-hdr td{background:#f8fafc;color:#1e293b;font-weight:600}
      #${TABLE_ID} .ex-dept-title{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      #${TABLE_ID} .ex-gp-cell{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-left:12px;border-left:3px solid #cbd5e1;margin-left:2px}
      #${TABLE_ID} .ex-proc-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
      #${TABLE_ID} .ex-proc-item{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}
      #${TABLE_ID} .ex-proc-meta{font-size:12px;color:#64748b;margin-top:2px}
      #${TABLE_ID} .ex-toggle{
        display:inline-flex;align-items:center;justify-content:center;
        width:26px;height:26px;border-radius:6px;cursor:pointer;user-select:none;
        background:#fff;border:1px solid #cbd5e1;color:#334155;font-size:12px
      }
      #${TABLE_ID} .ex-toggle:hover{background:#e2e8f0}
      #${TABLE_ID} .ex-chip{
        display:inline-flex;align-items:center;gap:4px;
        min-height:24px;padding:2px 10px;border-radius:999px;
        background:#1e40af;color:#fff;font-size:12px;font-weight:600;white-space:nowrap
      }
      #${TABLE_ID} .ex-chip-muted{background:#64748b}
      #${TABLE_ID} .ex-link{color:#1d4ed8;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
      #${TABLE_ID} .ex-link:hover{color:#1e3a8a}
      #${TABLE_ID} .ex-gp-label{font-weight:600;color:#0f172a}
      #${TABLE_ID} .ex-unit-tag{font-size:12px;color:#475569}
      #${TABLE_ID} td{overflow-wrap:anywhere;word-break:break-word}
      #${TABLE_ID}.ex-table-fixed th:nth-child(1),#${TABLE_ID}.ex-table-fixed td:nth-child(1){width:16%}
      #${TABLE_ID}.ex-table-fixed th:nth-child(2),#${TABLE_ID}.ex-table-fixed td:nth-child(2){width:26%}
      #${TABLE_ID}.ex-table-fixed th:nth-child(3),#${TABLE_ID}.ex-table-fixed td:nth-child(3){width:28%}
      #${TABLE_ID}.ex-table-fixed th:nth-child(4),#${TABLE_ID}.ex-table-fixed td:nth-child(4){width:30%}
      body.theme-light #${TABLE_ID} .ex-dept-hdr td{background:linear-gradient(90deg,#dbeafe 0%,#eff6ff 100%)}
    `;
  }

  function splitUnitValues(v) {
    return String(v || "")
      .split(/[,;\n]/)
      .map((x) => String(x || "").replace(/\.+$/g, "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function splitProductValues(v) {
    return String(v || "")
      .split(/[;\n]/)
      .map((x) => String(x || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function mergeUnits(intoSet, raw) {
    splitUnitValues(raw).forEach((u) => intoSet.add(u));
  }

  function unitsText(set) {
    if (!set || !set.size) return "—";
    return Array.from(set).sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" })).join(", ");
  }

  function resolveProcessNoFallback(processRows, procNo, procName) {
    const direct = getText(procNo);
    if (direct) return direct;
    const targetName = getText(procName).toLowerCase();
    if (!targetName) return "";
    const hit = (processRows || []).find(
      (r) => getText(r && r.process).toLowerCase() === targetName && getText(r && r.processNo)
    );
    return hit ? getText(hit.processNo) : "";
  }

  function openProcessCard(processRows, procNo, procName) {
    if (typeof window.openProcessEditorByProcNoOrName === "function") {
      window.openProcessEditorByProcNoOrName(procNo, procName);
      return;
    }
    const resolvedNo = resolveProcessNoFallback(processRows, procNo, procName);
    const fallbackName = getText(procName);
    if (!resolvedNo && !fallbackName) return;
    if (typeof window.openProcessEditorByTaskProcNos === "function") {
      window.openProcessEditorByTaskProcNos(fallbackName, resolvedNo);
    }
  }

  function canEdit() {
    if (typeof window.canEdit === "function") return window.canEdit();
    const role = document.getElementById("roleSelect");
    return !!(role && (role.value === "admin" || role.value === "admin_edit"));
  }

  /** deptKey → { department, deptKey, gpMap } */
  function computeExecutors(processRows, catalogRows) {
    const byDept = new Map();

    const getDeptEntry = (deptRaw) => {
      const display = getText(deptRaw) || DEPT_EMPTY_LABEL;
      const key = normKey(display) || "__empty__";
      if (!byDept.has(key)) {
        byDept.set(key, { department: display, deptKey: key, gpMap: new Map() });
      }
      return byDept.get(key);
    };

    const getGpEntry = (deptEntry, gpNo, gpName) => {
      const gKey = `${normKey(gpNo)}¦${normKey(gpName)}`;
      if (!deptEntry.gpMap.has(gKey)) {
        deptEntry.gpMap.set(gKey, {
          gpKey: gKey,
          no: getText(gpNo),
          name: getText(gpName),
          units: new Set(),
          processMap: new Map(),
        });
      }
      return deptEntry.gpMap.get(gKey);
    };

    const catalogByProc = new Map();
    (catalogRows || []).forEach((c) => {
      const pn = getText(c.procNo);
      if (!pn) return;
      if (!catalogByProc.has(pn)) catalogByProc.set(pn, []);
      catalogByProc.get(pn).push(c);
    });

    (catalogRows || []).forEach((c) => {
      const gpName = getText(c.type);
      if (!gpName) return;
      const deptEntry = getDeptEntry(c.department);
      const gp = getGpEntry(deptEntry, c.typeNo, gpName);
      mergeUnits(gp.units, c.unit);

      const procNo = getText(c.procNo);
      const proc = getText(c.process);
      const pKey = `${normKey(procNo)}¦${normKey(proc)}`;
      if (!gp.processMap.has(pKey)) {
        gp.processMap.set(pKey, { procNo, proc, procKey: pKey, units: new Set() });
      }
      mergeUnits(gp.processMap.get(pKey).units, c.unit);
    });

    (processRows || []).forEach((p) => {
      const procNo = getText(p.processNo);
      const proc = getText(p.process);
      if (!procNo && !proc) return;
      const linkedCatalog = catalogByProc.get(procNo) || [];
      if (linkedCatalog.length) return;

      const gpNames = splitProductValues(p.products);
      if (!gpNames.length) return;
      const deptEntry = getDeptEntry(p.executorDala || "");
      gpNames.forEach((name) => {
        const gp = getGpEntry(deptEntry, "", name);
        mergeUnits(gp.units, p.executorPatstaviga);
        const pKey = `${normKey(procNo)}¦${normKey(proc)}`;
        if (!gp.processMap.has(pKey)) {
          gp.processMap.set(pKey, { procNo, proc, procKey: pKey, units: new Set() });
        }
        mergeUnits(gp.processMap.get(pKey).units, p.executorPatstaviga);
      });
    });

    return Array.from(byDept.values()).sort((a, b) =>
      String(a.department || "").localeCompare(String(b.department || ""), "lv", { sensitivity: "base" })
    );
  }

  function hasAnyExecutorAccordionOpen() {
    return executorDeptExpanded.size > 0;
  }

  function setAllExecutorAccordionsOpen(processRows, catalogRows, open) {
    executorDeptExpanded.clear();
    if (!open) return;
    computeExecutors(processRows, catalogRows).forEach((d) => {
      executorDeptExpanded.add(d.deptKey);
    });
  }

  function collectDeptUnits(gpList) {
    const all = new Set();
    gpList.forEach((g) => {
      if (g.units && g.units.forEach) g.units.forEach((u) => all.add(u));
      if (!g.processMap || !g.processMap.forEach) return;
      g.processMap.forEach((pr) => {
        if (pr.units && pr.units.forEach) pr.units.forEach((u) => all.add(u));
      });
    });
    return all;
  }

  function fillProcessCell(td, processes, processRows, fallbackUnits) {
    td.className = "ex-proc-cell";
    td.textContent = "";
    if (!processes.length) {
      td.textContent = "—";
      td.style.color = "#94a3b8";
      return;
    }
    const ul = document.createElement("ul");
    ul.className = "ex-proc-list";
    processes.forEach((pr) => {
      const li = document.createElement("li");
      li.className = "ex-proc-item";
      const main = document.createElement("div");
      const procLabel = [pr.procNo, pr.proc].filter(Boolean).join(" — ") || "—";
      const link = document.createElement("span");
      link.className = "ex-link";
      link.textContent = procLabel;
      link.title = "Atvērt procesa kartiņu";
      link.addEventListener("click", () => openProcessCard(processRows, pr.procNo, pr.proc));
      main.appendChild(link);
      const pBtn = document.createElement("button");
      pBtn.type = "button";
      pBtn.className = "secondary";
      pBtn.style.fontSize = "12px";
      pBtn.textContent = "Procesa kartiņa";
      pBtn.addEventListener("click", () => openProcessCard(processRows, pr.procNo, pr.proc));
      main.appendChild(pBtn);
      li.appendChild(main);
      const procUnits = unitsText(pr.units);
      const fb = unitsText(fallbackUnits);
      if (procUnits && procUnits !== "—" && procUnits !== fb) {
        const meta = document.createElement("div");
        meta.className = "ex-proc-meta";
        meta.textContent = "Pārvalde (procesam): " + procUnits;
        li.appendChild(meta);
      }
      ul.appendChild(li);
    });
    td.appendChild(ul);
  }

  function bindToggle(el, fn) {
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      fn();
    });
  }

  function renderExecutorsView() {
    const card = document.getElementById("executorsCard");
    if (!card) return;

    const table = ensureTable(card);
    if (!table) return;
    ensureStyles();

    const tb = document.getElementById(ROWS_ID);
    if (!tb) return;

    const p = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    const c = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    const departments = computeExecutors(p, c);

    let totalGp = 0;
    let totalProc = 0;
    departments.forEach((d) => {
      totalGp += d.gpMap.size;
      d.gpMap.forEach((g) => {
        totalProc += g.processMap.size;
      });
    });
    const summaryEl = document.getElementById(SUMMARY_ID);
    if (summaryEl) {
      summaryEl.textContent =
        `${departments.length} struktūrvienība(s) · ${totalGp} galaprodukti · ${totalProc} procesu saites. ` +
        "Hierarhija: struktūrvienība → galaprodukts → process.";
    }

    const bulkBtn = document.getElementById(BULK_BTN_ID);
    if (bulkBtn && !bulkBtn.dataset.bound) {
      bulkBtn.addEventListener("click", () => {
        const wantOpen = !hasAnyExecutorAccordionOpen();
        const pp = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
        const cc = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
        setAllExecutorAccordionsOpen(pp, cc, wantOpen);
        renderExecutorsView();
      });
      bulkBtn.dataset.bound = "1";
    }
    if (bulkBtn) {
      bulkBtn.textContent = hasAnyExecutorAccordionOpen() ? "Aizvērt visus akordeonus" : "Atvērt visus akordeonus";
    }

    tb.innerHTML = "";

    if (!departments.length) {
      const empty = document.createElement("tr");
      empty.innerHTML = `<td colspan="4" style="padding:16px;color:#64748b">Nav datu GP katalogā un procesu reģistrā.</td>`;
      tb.appendChild(empty);
      afterExecutorsRender(table);
      return;
    }

    departments.forEach((d) => {
      const deptOpen = executorDeptExpanded.has(d.deptKey);
      const gpList = Array.from(d.gpMap.values()).sort((a, b) =>
        `${a.no} ${a.name}`.localeCompare(`${b.no} ${b.name}`, "lv", { sensitivity: "base" })
      );
      const procCount = gpList.reduce((acc, g) => acc + g.processMap.size, 0);
      const deptUnits = collectDeptUnits(gpList);

      const hdr = document.createElement("tr");
      hdr.className = "ex-dept-hdr";
      const toggleDept = () => {
        if (executorDeptExpanded.has(d.deptKey)) executorDeptExpanded.delete(d.deptKey);
        else executorDeptExpanded.add(d.deptKey);
        renderExecutorsView();
      };
      const cParvalde = document.createElement("td");
      cParvalde.className = "ex-unit-tag";
      cParvalde.textContent = unitsText(deptUnits);
      const cDept = document.createElement("td");
      cDept.innerHTML = `
        <div class="ex-dept-title">
          <span class="ex-toggle ex-dept-toggle" title="Atvērt/aizvērt">${deptOpen ? "▾" : "▸"}</span>
          <span>${escHtml(d.department)}</span>
        </div>
      `;
      bindToggle(cDept.querySelector(".ex-dept-toggle"), toggleDept);
      const cGp = document.createElement("td");
      cGp.innerHTML = `<span class="ex-chip ex-chip-muted">${gpList.length} GP</span>`;
      const cProc = document.createElement("td");
      cProc.innerHTML = `<span class="ex-chip ex-chip-muted">${procCount} procesi</span>`;
      hdr.appendChild(cParvalde);
      hdr.appendChild(cDept);
      hdr.appendChild(cGp);
      hdr.appendChild(cProc);
      tb.appendChild(hdr);

      if (!deptOpen) return;

      gpList.forEach((g) => {
        const processes = Array.from(g.processMap.values()).sort((a, b) =>
          `${a.procNo} ${a.proc}`.localeCompare(`${b.procNo} ${b.proc}`, "lv", { sensitivity: "base" })
        );

        const gtr = document.createElement("tr");
        gtr.className = "ex-gp-hdr";
        const gpLabel = g.no ? `${g.no} — ${g.name}` : g.name;

        const tParvalde = document.createElement("td");
        tParvalde.className = "ex-unit-tag";
        tParvalde.textContent = "";

        const tDept = document.createElement("td");
        tDept.textContent = "";

        const tGp = document.createElement("td");
        tGp.innerHTML = `
          <div class="ex-gp-cell">
            <span class="ex-gp-label">${escHtml(gpLabel)}</span>
          </div>
        `;
        const gpBtn = document.createElement("button");
        gpBtn.type = "button";
        gpBtn.className = "secondary";
        gpBtn.style.fontSize = "12px";
        gpBtn.textContent = "GP kartiņa";
        gpBtn.addEventListener("click", () => {
          const procNo = processes[0] ? processes[0].procNo : "";
          if (typeof window.openCatalogByProcessGp === "function") {
            window.openCatalogByProcessGp(procNo, g.name);
          }
        });
        tGp.querySelector(".ex-gp-cell").appendChild(gpBtn);

        const tProc = document.createElement("td");
        fillProcessCell(tProc, processes, p, g.units);

        gtr.appendChild(tParvalde);
        gtr.appendChild(tDept);
        gtr.appendChild(tGp);
        gtr.appendChild(tProc);
        tb.appendChild(gtr);
      });
    });

    afterExecutorsRender(table);
    lockExecutorsTableLayout(table);
  }

  let executorsDbSyncTimer = null;
  function afterExecutorsRender(table) {
    if (typeof window.applyExecutorsFilters === "function") {
      try {
        window.applyExecutorsFilters();
      } catch (_) {}
    }
    if (!table || table.dataset.exFiltersInit === "1") return;
    table.dataset.exFiltersInit = "1";
    if (typeof window.syncExecutorsColumnFilters === "function") {
      try {
        window.syncExecutorsColumnFilters(true);
      } catch (_) {}
    }
  }

  window.renderExecutorsView = renderExecutorsView;

  window.addEventListener("app:db-sync", () => {
    try {
      const card = document.getElementById("executorsCard");
      if (!card || card.classList.contains("hidden")) return;
      if (executorsDbSyncTimer) clearTimeout(executorsDbSyncTimer);
      executorsDbSyncTimer = setTimeout(() => {
        executorsDbSyncTimer = null;
        renderExecutorsView();
      }, 800);
    } catch (_) {}
  });

  document.addEventListener("DOMContentLoaded", () => {
    try {
      const tasksCard = document.getElementById("tasksViewCard");
      const tasksTitle = tasksCard ? tasksCard.querySelector(".section-title") : null;
      if (tasksTitle && tasksTitle.textContent && tasksTitle.textContent.trim() === "Uzdevumu skats") {
        tasksTitle.textContent = "Uzdevumi";
      }

      const settingsInner = document.getElementById("settingsInner");
      const settingsBtn = document.getElementById("settingsToggleBtn");
      if (settingsInner && settingsBtn) {
        settingsInner.classList.add("hidden");
        settingsBtn.setAttribute("aria-expanded", "false");
        settingsBtn.textContent = "Atvērt";
      }

      const card = document.getElementById("executorsCard");
      if (!card) return;
      const toggleBtn = document.getElementById("executorsInlineEditToggleBtn");
      if (toggleBtn && !toggleBtn.dataset.boundInlineEdit) {
        toggleBtn.dataset.boundInlineEdit = "1";
        toggleBtn.addEventListener("click", () => {
          if (!canEdit()) {
            alert("Tabulas labošanas režīms pieejams tikai administrators (labot).");
            return;
          }
          inlineEditMode = !inlineEditMode;
          toggleBtn.textContent = inlineEditMode ? "Pabeigt tabulas labošanu" : "Labot tabulas režīmā";
          renderExecutorsView();
        });
      }

      let executorsWasHidden = card.classList.contains("hidden");
      const obs = new MutationObserver(() => {
        const hidden = card.classList.contains("hidden");
        if (executorsWasHidden && !hidden) renderExecutorsView();
        executorsWasHidden = hidden;
      });
      obs.observe(card, { attributes: true, attributeFilter: ["class"] });
    } catch (_) {}
  });
})();
