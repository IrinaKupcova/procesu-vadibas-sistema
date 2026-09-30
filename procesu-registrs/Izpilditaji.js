/**
 * Izpildītāji: struktūrvienība/amats → galaprodukts → galaprodukta joma (deduplikācija, merge).
 * Avots: GP katalogs + procesu reģistrs.
 */
(function () {
  "use strict";

  const ROOT_ID = "executorsListRoot";
  const TABLE_ID = "executorsTable";
  const ROWS_ID = "executorsTableBody";
  const BULK_BTN_ID = "executorsBulkAccordionToggleBtn";
  const UNIT_EMPTY_LABEL = "Nav norādīta patstāvīgā struktūrvienība";
  const AMATS_EMPTY_LABEL = "Nav norādīts amats";

  let inlineEditMode = false;
  const executorUnitOpen = new Set();

  const COL_DEFS = [
    { label: "Patstāvīgā struktūrvienība", filter: "Patstāvīgā struktūrvienība" },
    { label: "Struktūrvienība/ amats", filter: "Struktūrvienība/ amats" },
    { label: "Galaprodukts", filter: "Galaprodukts" },
    { label: "Galaprodukta joma", filter: "Galaprodukta joma" },
  ];

  const INNER_COL_DEFS = [
    { label: "Struktūrvienība/ amats", filter: "Struktūrvienība/ amats" },
    { label: "Galaprodukts", filter: "Galaprodukts" },
    { label: "Galaprodukta joma", filter: "Galaprodukta joma" },
  ];

  const JOMA_EMPTY_LABEL = "—";

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function gpLabelFromParts(no, name) {
    if (typeof window.pvPairLabel === "function") {
      return window.pvPairLabel(no, name) || name || no || "—";
    }
    const n = getText(no);
    const t = getText(name);
    return n ? `${n} ${t}`.trim() : t || "—";
  }

  function compareUnitLabel(a, b) {
    const au = String(a || "");
    const bu = String(b || "");
    const aEmpty = au === UNIT_EMPTY_LABEL;
    const bEmpty = bu === UNIT_EMPTY_LABEL;
    if (aEmpty && !bEmpty) return 1;
    if (!aEmpty && bEmpty) return -1;
    return au.localeCompare(bu, "lv", { sensitivity: "base" });
  }

  function sameGpRow(a, b) {
    return (
      a.unit === b.unit &&
      a.amats === b.amats &&
      normKey(a.gpNo) === normKey(b.gpNo) &&
      normKey(a.gpName) === normKey(b.gpName)
    );
  }

  function jomaLabelFromRow(row) {
    const j = getText(row && row.gpJoma);
    return j || JOMA_EMPTY_LABEL;
  }

  function unitKeyFromLabel(unit) {
    return normKey(unit) || "__empty__";
  }

  function groupRowsByUnit(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const key = unitKeyFromLabel(r.unit);
      if (!map.has(key)) map.set(key, { unit: r.unit, unitKey: key, rows: [] });
      map.get(key).rows.push(r);
    });
    return Array.from(map.values()).sort((a, b) => compareUnitLabel(a.unit, b.unit));
  }

  function ensureControls(card) {
    if (!card || document.getElementById(BULK_BTN_ID)) return;
    const controls = document.createElement("div");
    controls.className = "ex-view-controls";
    const bulk = document.createElement("button");
    bulk.type = "button";
    bulk.id = BULK_BTN_ID;
    bulk.className = "secondary";
    bulk.textContent = "Atvērt visas kartiņas";
    controls.appendChild(bulk);
    const stats = card.querySelector(".inline-stats");
    if (stats) stats.insertAdjacentElement("afterend", controls);
    else card.querySelector(".toolbar")?.insertAdjacentElement("afterend", controls);
  }

  function buildExecutorFlatRows(processRows, catalogRows) {
    const byKey = new Map();

    function pushRow(unitRaw, amatsRaw, gpNo, gpName, procNo, proc, gpJoma) {
      const gpN = getText(gpName);
      if (!gpN) return;
      const unit = getText(unitRaw) || UNIT_EMPTY_LABEL;
      const amats = getText(amatsRaw) || AMATS_EMPTY_LABEL;
      const pn = getText(gpNo);
      const pNo = getText(procNo);
      const pName = getText(proc);
      const joma = getText(gpJoma);
      const key = [normKey(unit), normKey(amats), normKey(pn), normKey(gpN)].join("|");
      if (byKey.has(key)) {
        const prev = byKey.get(key);
        if (joma && !getText(prev.gpJoma)) prev.gpJoma = joma;
        if (pNo && !getText(prev.procNo)) prev.procNo = pNo;
        if (pName && !getText(prev.proc)) prev.proc = pName;
        return;
      }
      byKey.set(key, {
        unit,
        amats,
        gpNo: pn,
        gpName: gpN,
        gpJoma: joma,
        procNo: pNo,
        proc: pName,
      });
    }

    const catalogByProc = new Map();
    (catalogRows || []).forEach((c) => {
      const pn = getText(c.procNo);
      if (!pn) return;
      if (!catalogByProc.has(pn)) catalogByProc.set(pn, []);
      catalogByProc.get(pn).push(c);
    });

    (catalogRows || []).forEach((c) => {
      let units = splitUnitValues(c.unit);
      if (!units.length) units = [""];
      units.forEach((u) => {
        pushRow(u, c.department, c.typeNo, c.type, c.procNo, c.process, c.darbibasJoma);
      });
    });

    (processRows || []).forEach((p) => {
      const procNo = getText(p.processNo);
      const proc = getText(p.process);
      if (!procNo && !proc) return;
      if ((catalogByProc.get(procNo) || []).length) return;
      const gpNames = splitProductValues(p.products);
      if (!gpNames.length) return;
      let units = splitUnitValues(p.executorPatstaviga);
      if (!units.length) units = [""];
      units.forEach((u) => {
        gpNames.forEach((name) => {
          pushRow(u, p.executorDala, "", name, procNo, proc, p.darbibasJoma);
        });
      });
    });

    const rows = Array.from(byKey.values());
    rows.sort((a, b) => {
      let c = compareUnitLabel(a.unit, b.unit);
      if (c !== 0) return c;
      c = String(a.amats).localeCompare(String(b.amats), "lv", { sensitivity: "base" });
      if (c !== 0) return c;
      c = gpLabelFromParts(a.gpNo, a.gpName).localeCompare(gpLabelFromParts(b.gpNo, b.gpName), "lv", {
        sensitivity: "base",
      });
      if (c !== 0) return c;
      return jomaLabelFromRow(a).localeCompare(jomaLabelFromRow(b), "lv", { sensitivity: "base" });
    });

    return rows;
  }

  function rowSpanFrom(i, rows, sameFn) {
    let n = 1;
    while (i + n < rows.length && sameFn(rows[i], rows[i + n])) n += 1;
    return n;
  }

  function syncExecutorsTableColumns(table) {
    if (!table) return;
    let tr = table.querySelector("thead tr");
    if (!tr) return;
    const colOrderKey = "exec-flat-merge-v3";
    const thHtml = COL_DEFS.map(
      (c) => `<th data-filter-label="${escHtml(c.filter)}">${escHtml(c.label)}</th>`
    ).join("");
    if (tr.children.length !== COL_DEFS.length || tr.dataset.colOrder !== colOrderKey) {
      tr.innerHTML = thHtml;
      tr.dataset.colOrder = colOrderKey;
      tr.dataset.filtersReady = "";
      if (table.dataset) table.dataset.exFiltersInit = "";
    }
  }

  function ensureMount(card) {
    if (!card) return null;
    ensureControls(card);
    card.querySelector(".ex-table-scroll")?.remove();

    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      root.className = "ex-parvalde-list";
      card.appendChild(root);
    }

    let table = document.getElementById(TABLE_ID);
    if (!table) {
      table = document.createElement("table");
      table.id = TABLE_ID;
      table.className = "ex-export-table hidden";
      table.setAttribute("aria-hidden", "true");
      table.innerHTML = `<thead><tr>${COL_DEFS.map(
        (c) => `<th>${escHtml(c.label)}</th>`
      ).join("")}</tr></thead><tbody id="${ROWS_ID}"></tbody>`;
      card.appendChild(table);
    }
    return root;
  }

  function ensureStyles() {
    let s = document.getElementById("executorsAccordionCss");
    if (!s) {
      s = document.createElement("style");
      s.id = "executorsAccordionCss";
      document.head.appendChild(s);
    }
    if (s.dataset.layout === "exec-parvalde-cards-v1") return;
    s.dataset.layout = "exec-parvalde-cards-v1";
    s.textContent = `
      #executorsCard .ex-view-controls{margin:8px 0 12px}
      #executorsCard .ex-parvalde-list-heading{margin:0 0 10px;font-size:14px;font-weight:700;color:#334155}
      #executorsCard .ex-parvalde-list{display:flex;flex-direction:column;gap:10px;width:100%}
      #executorsCard .ex-parvalde-block{display:flex;flex-direction:column;gap:0;width:100%}
      #executorsCard .ex-parvalde-picker{
        display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;width:100%;text-align:left;
        padding:14px 16px;border:2px solid #cbd5e1;border-radius:14px;background:#fff;
        cursor:pointer;font:inherit;color:#475569;box-shadow:0 2px 6px rgba(15,23,42,.06)
      }
      #executorsCard .ex-parvalde-picker:hover{border-color:#93c5fd;background:#f8fafc}
      #executorsCard .ex-parvalde-picker.ex-parvalde-picker--open{
        border-radius:14px 14px 0 0;border-bottom:1px solid #cbd5e1;
        border-color:#2563eb;background:linear-gradient(180deg,#eff6ff 0%,#fff 100%)
      }
      #executorsCard .ex-parvalde-picker-name{flex:1 1 200px;font-weight:700;font-size:14px;color:#334155}
      #executorsCard .ex-parvalde-picker-meta{display:flex;flex-wrap:wrap;gap:6px}
      #executorsCard .ex-unit-chip{
        display:inline-flex;padding:2px 10px;border-radius:999px;background:#64748b;color:#fff;
        font-size:12px;font-weight:600
      }
      #executorsCard .ex-parvalde-picker-hint{font-size:11px;color:#64748b}
      #executorsCard .ex-parvalde-body{
        border:2px solid #2563eb;border-top:0;border-radius:0 0 14px 14px;padding:14px 16px 16px;
        background:#fff;margin:0 0 8px;box-shadow:0 4px 12px rgba(37,99,235,.1)
      }
      #executorsCard .ex-parvalde-body .ex-inner-scroll{overflow-x:auto}
      #executorsCard .ex-inner-table{width:100%;min-width:720px;border-collapse:separate;border-spacing:0 6px}
      #executorsCard .ex-inner-table thead th{
        font-size:12px;font-weight:700;color:#475569;text-align:left;padding:8px 10px;
        background:#f1f5f9;border-bottom:2px solid #cbd5e1
      }
      #executorsCard .ex-inner-table tbody tr.ex-exec-row-card td{
        padding:10px 12px;vertical-align:top;border:1px solid #e2e8f0;background:#fff;color:#475569;line-height:1.35
      }
      #executorsCard .ex-inner-table tbody tr.ex-exec-row-card td:first-child{
        border-left:4px solid #6366f1;border-radius:8px 0 0 8px
      }
      #executorsCard .ex-inner-table tbody tr.ex-exec-row-card td:last-child{border-radius:0 8px 8px 0}
      #executorsCard .ex-inner-table td.ex-merged-cell{background:#f8fafc}
      #executorsCard .ex-gp-label{font-weight:600;color:#475569}
      #executorsCard .ex-link{color:#1d4ed8;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
      #executorsCard .ex-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
      #executorsCard .ex-empty-hint{color:#94a3b8;font-size:13px;margin:0;padding:8px 0}
      #executorsCard .ex-export-table.hidden{display:none!important}
    `;
  }

  function canEdit() {
    if (typeof window.canEdit === "function") return window.canEdit();
    const role = document.getElementById("roleSelect");
    if (window.PVRoles) return window.PVRoles.canEditFromSelectValue(role && role.value);
    return !!(role && role.value === "admin");
  }

  function fillGpCell(td, row) {
    td.innerHTML = `<div class="ex-gp-label">${escHtml(gpLabelFromParts(row.gpNo, row.gpName))}</div>`;
    const actions = document.createElement("div");
    actions.className = "ex-actions";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.style.fontSize = "12px";
    btn.textContent = "GP kartiņa";
    btn.addEventListener("click", () => {
      if (typeof window.openCatalogByProcessGp === "function") {
        window.openCatalogByProcessGp(row.procNo, row.gpName);
      }
    });
    actions.appendChild(btn);
    td.appendChild(actions);
  }

  function syncExportTable(rows) {
    const tb = document.getElementById(ROWS_ID);
    if (!tb) return;
    tb.innerHTML = "";
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        `<td>${escHtml(row.unit)}</td><td>${escHtml(row.amats)}</td>` +
        `<td>${escHtml(gpLabelFromParts(row.gpNo, row.gpName))}</td>` +
        `<td>${escHtml(jomaLabelFromRow(row))}</td>`;
      tb.appendChild(tr);
    });
  }

  function appendMergedRows(tbody, unitRows, unitLabel) {
    unitRows.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.className = "ex-exec-row-card";
      tr.dataset.filterHay = [
        unitLabel,
        row.amats,
        gpLabelFromParts(row.gpNo, row.gpName),
        jomaLabelFromRow(row),
      ]
        .join(" ")
        .toLowerCase();

      const showAmats = i === 0 || unitRows[i - 1].amats !== row.amats;
      const showGp = i === 0 || !sameGpRow(unitRows[i - 1], row);

      if (showAmats) {
        const td = document.createElement("td");
        td.className = "ex-merged-cell";
        td.rowSpan = rowSpanFrom(i, unitRows, (a, b) => a.amats === b.amats);
        td.textContent = row.amats;
        tr.appendChild(td);
      }
      if (showGp) {
        const td = document.createElement("td");
        td.className = "ex-merged-cell";
        td.rowSpan = rowSpanFrom(i, unitRows, sameGpRow);
        fillGpCell(td, row);
        tr.appendChild(td);
      }
      const tdJoma = document.createElement("td");
      tdJoma.textContent = jomaLabelFromRow(row);
      tr.appendChild(tdJoma);
      tbody.appendChild(tr);
    });
  }

  function buildParvaldeBody(unitGroup) {
    const body = document.createElement("div");
    body.className = "ex-parvalde-body";
    const unitRows = unitGroup.rows;
    if (!unitRows.length) {
      body.innerHTML = '<p class="ex-empty-hint">Nav saistītu ierakstu.</p>';
      return body;
    }
    const scroll = document.createElement("div");
    scroll.className = "ex-inner-scroll";
    const table = document.createElement("table");
    table.className = "ex-inner-table";
    table.innerHTML = `<thead><tr>${INNER_COL_DEFS.map((c) => `<th>${escHtml(c.label)}</th>`).join("")}</tr></thead>`;
    const tbody = document.createElement("tbody");
    appendMergedRows(tbody, unitRows, unitGroup.unit);
    table.appendChild(tbody);
    scroll.appendChild(table);
    body.appendChild(scroll);
    return body;
  }

  function renderExecutorsView() {
    const card = document.getElementById("executorsCard");
    if (!card) return;

    const root = ensureMount(card);
    if (!root) return;
    ensureStyles();

    const processRows = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    const catalogRows = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    const rows = buildExecutorFlatRows(processRows, catalogRows);
    const groups = groupRowsByUnit(rows);
    syncExportTable(rows);

    const gpSet = new Set();
    rows.forEach((r) => gpSet.add(`${normKey(r.gpNo)}|${normKey(r.gpName)}`));

    const elDept = document.getElementById("statExecutorsDeptCount");
    const elGp = document.getElementById("statExecutorsGpCount");
    const elProc = document.getElementById("statExecutorsProcLinks");
    if (elDept) elDept.textContent = String(groups.length);
    if (elGp) elGp.textContent = String(gpSet.size);
    if (elProc) elProc.textContent = String(rows.length);

    const bulkBtn = document.getElementById(BULK_BTN_ID);
    if (bulkBtn && !bulkBtn.dataset.bound) {
      bulkBtn.addEventListener("click", () => {
        const openAll = executorUnitOpen.size < groups.length;
        executorUnitOpen.clear();
        if (openAll) groups.forEach((g) => executorUnitOpen.add(g.unitKey));
        renderExecutorsView();
      });
      bulkBtn.dataset.bound = "1";
    }
    if (bulkBtn) {
      bulkBtn.textContent =
        executorUnitOpen.size > 0 ? "Aizvērt visas kartiņas" : "Atvērt visas kartiņas";
    }

    root.innerHTML = "";

    if (!groups.length) {
      root.innerHTML = '<p class="ex-empty-hint">Nav datu GP katalogā un procesu reģistrā.</p>';
      afterExecutorsRender();
      return;
    }

    const heading = document.createElement("h3");
    heading.className = "ex-parvalde-list-heading";
    heading.textContent = "Patstāvīgās struktūrvienības";
    root.appendChild(heading);

    groups.forEach((g) => {
      const isOpen = executorUnitOpen.has(g.unitKey);
      const gpCount = new Set(g.rows.map((r) => `${normKey(r.gpNo)}|${normKey(r.gpName)}`)).size;
      const procCount = g.rows.length;

      const block = document.createElement("div");
      block.className = "ex-parvalde-block";
      block.dataset.unitKey = g.unitKey;
      block.dataset.filterHay = [
        g.unit,
        ...g.rows.map((r) => [r.amats, gpLabelFromParts(r.gpNo, r.gpName), jomaLabelFromRow(r)].join(" ")),
      ]
        .join(" ")
        .toLowerCase();

      const picker = document.createElement("button");
      picker.type = "button";
      picker.className = "ex-parvalde-picker" + (isOpen ? " ex-parvalde-picker--open" : "");
      const name = document.createElement("span");
      name.className = "ex-parvalde-picker-name";
      name.textContent = g.unit;
      const meta = document.createElement("span");
      meta.className = "ex-parvalde-picker-meta";
      meta.innerHTML =
        `<span class="ex-unit-chip">${gpCount} GP</span><span class="ex-unit-chip">${procCount} saites</span>`;
      const hint = document.createElement("span");
      hint.className = "ex-parvalde-picker-hint";
      hint.textContent = isOpen ? "Aizvērt kartiņu" : "Atvērt kartiņu";
      picker.appendChild(name);
      picker.appendChild(meta);
      picker.appendChild(hint);
      picker.addEventListener("click", () => {
        if (executorUnitOpen.has(g.unitKey)) executorUnitOpen.delete(g.unitKey);
        else executorUnitOpen.add(g.unitKey);
        renderExecutorsView();
      });
      block.appendChild(picker);

      if (isOpen) {
        block.appendChild(buildParvaldeBody(g));
      }

      root.appendChild(block);
    });

    afterExecutorsRender();
  }

  let executorsDbSyncTimer = null;
  function afterExecutorsRender() {
    if (typeof window.applyExecutorsFilters === "function") {
      try {
        window.applyExecutorsFilters();
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
      const card = document.getElementById("executorsCard");
      if (!card) return;
      const toggleBtn = document.getElementById("executorsInlineEditToggleBtn");
      if (toggleBtn && !toggleBtn.dataset.boundInlineEdit) {
        toggleBtn.dataset.boundInlineEdit = "1";
        toggleBtn.addEventListener("click", () => {
          if (!canEdit()) {
            alert("Tabulas labošanas režīms pieejams tikai lietotājam ar administratora tiesībām (loma Administrators).");
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
