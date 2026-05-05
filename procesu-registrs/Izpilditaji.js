/**
 * Izpildītāji: tabula/skats, kas agregē datus no
 * - Procesu reģistra blokiem (processRows via window.getProcessRows)
 * - GP kataloga blokiem (catalog rows via window.getCatalogRows)
 *
 * Renderē tabulu `executorsCard` iekšpusē.
 */
(function () {
  "use strict";

  const TABLE_ID = "executorsTable";
  const ROWS_ID = "executorsTableBody";
  let inlineEditMode = false;
  const executorProcessExpanded = new Set();
  const executorProcessSectionExpanded = new Set();
  const executorGpSectionExpanded = new Set();

  function getText(v) {
    return v === null || v === undefined ? "" : String(v).trim();
  }

  function ensureTable(card) {
    if (!card) return null;

    let table = document.getElementById(TABLE_ID);
    if (!table) {
      table = document.createElement("table");
      table.id = TABLE_ID;
      table.style.width = "100%";
      table.style.minWidth = "980px";
      table.style.borderCollapse = "collapse";
      table.style.tableLayout = "fixed";
      table.innerHTML = `
        <colgroup>
          <col style="width:38%">
          <col style="width:34%">
          <col style="width:28%">
        </colgroup>
        <thead>
          <tr>
            <th>Procesa izpildītājs, pārvalde</th>
            <th>Process</th>
            <th>Galaprodukts</th>
          </tr>
        </thead>
        <tbody id="${ROWS_ID}"></tbody>
      `;
      // Neizdzēšam visu karti (tur ir toolbar); tikai noņemam esošo hint tekstu.
      const hint = card.querySelector("p.hint");
      if (hint) hint.remove();
      const wrap = document.createElement("div");
      wrap.style.overflowX = "auto";
      wrap.style.width = "100%";
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

    return table;
  }

  function ensureStyles() {
    if (document.getElementById("executorsAccordionCss")) return;
    const s = document.createElement("style");
    s.id = "executorsAccordionCss";
    s.textContent = `
      #${TABLE_ID} .ex-unit-hdr td{font-weight:700;background:#e2e8f0;color:#0f172a;border-top:2px solid #94a3b8}
      #${TABLE_ID} .ex-proc-hdr td{background:#f8fafc;color:#1f2937}
      #${TABLE_ID} .ex-gp-row td{background:#ffffff}
      #${TABLE_ID} .ex-toggle{cursor:pointer;text-decoration:none;color:inherit;user-select:none}
      #${TABLE_ID} .ex-chip{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 8px;border-radius:999px;background:#334155;color:#fff;font-size:12px;font-weight:700;line-height:1}
      #${TABLE_ID} .ex-chip-btn{cursor:pointer}
      #${TABLE_ID} .ex-muted-chip{background:#94a3b8}
      #${TABLE_ID} .ex-link{color:#0f172a;text-decoration:none;cursor:pointer}
      #${TABLE_ID} .ex-link:hover{color:#111827}
      #${TABLE_ID} .ex-gp-wrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      #${TABLE_ID} td, #${TABLE_ID} th{padding:6px 8px;vertical-align:top}
      #${TABLE_ID} .ex-pad{padding-left:8px}
      #${TABLE_ID} .ex-pad2{padding-left:8px}
    `;
    document.head.appendChild(s);
  }

  function splitValues(v) {
    return String(v || "")
      .split(/[;,\n]/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }
  function resolveProcessNoFallback(processRows, procNo, procName) {
    const direct = getText(procNo);
    if (direct) return direct;
    const targetName = getText(procName).toLowerCase();
    if (!targetName) return "";
    const hit = (processRows || []).find((r) => getText(r && r.process).toLowerCase() === targetName && getText(r && r.processNo));
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
    const role = document.getElementById("roleSelect");
    return !!(role && role.value === "admin_edit");
  }

  function processFormValsFromRow(r, overrides) {
    const o = overrides || {};
    return {
      group: o.group !== undefined ? o.group : (r.group || ""),
      taskNo: o.taskNo !== undefined ? o.taskNo : (r.taskNo || ""),
      task: o.task !== undefined ? o.task : (r.task || ""),
      processNo: o.processNo !== undefined ? o.processNo : (r.processNo || ""),
      process: o.process !== undefined ? o.process : (r.process || ""),
      darbibasJoma: o.darbibasJoma !== undefined ? o.darbibasJoma : (r.darbibasJoma || ""),
      owner: o.owner !== undefined ? o.owner : (r.owner || ""),
      products: o.products !== undefined ? o.products : (r.products || ""),
      productTypes: o.productTypes !== undefined ? o.productTypes : (r.productTypes || ""),
      input: o.input !== undefined ? o.input : (r.input || ""),
      relatedProcesses: o.relatedProcesses !== undefined ? o.relatedProcesses : (r.relatedProcesses || ""),
      services: o.services !== undefined ? o.services : (r.services || ""),
      flowcharts: o.flowcharts !== undefined ? o.flowcharts : (r.flowcharts || ""),
      itResources: o.itResources !== undefined ? o.itResources : (r.itResources || ""),
      optimization: o.optimization !== undefined ? o.optimization : (r.optimization || ""),
      executorPatstaviga: o.executorPatstaviga !== undefined ? o.executorPatstaviga : (r.executorPatstaviga || ""),
      executorDala: o.executorDala !== undefined ? o.executorDala : (r.executorDala || ""),
      otherMetrics: o.otherMetrics !== undefined ? o.otherMetrics : (r.otherMetrics || ""),
    };
  }

  function computeExecutors(processRows, catalogRows) {
    const byUnit = new Map();
    const getUnitEntry = (unit) => {
      const key = getText(unit) || "—";
      if (!byUnit.has(key)) {
        byUnit.set(key, {
          unit: key,
          processMap: new Map(), // procKey -> { procNo, proc, gpMap }
        });
      }
      return byUnit.get(key);
    };

    const catalogByProc = new Map();
    (catalogRows || []).forEach((c) => {
      const pn = getText(c.procNo);
      if (!pn) return;
      if (!catalogByProc.has(pn)) catalogByProc.set(pn, []);
      catalogByProc.get(pn).push(c);
    });

    (processRows || []).forEach((p) => {
      const procNo = getText(p.processNo);
      const proc = getText(p.process);
      if (!procNo && !proc) return;
      const procKey = `${procNo}¦${proc}`;
      const linkedCatalog = catalogByProc.get(procNo) || [];
      const units = Array.from(new Set([]
        .concat(splitValues(p.executorPatstaviga))
        .concat(linkedCatalog.flatMap((x) => splitValues(x.unit)))
        .filter(Boolean)));
      const finalUnits = units.length ? units : ["—"];

      finalUnits.forEach((u) => {
        const unitEntry = getUnitEntry(u);
        if (!unitEntry.processMap.has(procKey)) unitEntry.processMap.set(procKey, { procNo, proc, gpMap: new Map() });
        const processEntry = unitEntry.processMap.get(procKey);

        const gpFromProcess = splitValues(p.products).map((name) => ({ no: "", name, procNo, proc }));
        const gpFromCatalog = linkedCatalog
          .filter((x) => {
            const unitVals = splitValues(x.unit);
            if (!unitVals.length || u === "—") return true;
            return unitVals.some((uv) => getText(uv).toLowerCase() === getText(u).toLowerCase());
          })
          .map((x) => ({
            no: getText(x.typeNo),
            name: getText(x.type),
            procNo: getText(x.procNo) || procNo,
            proc: getText(x.process) || proc,
          }));
        gpFromProcess.concat(gpFromCatalog).forEach((g) => {
          if (!getText(g.name)) return;
          const gpKey = `${getText(g.no)}¦${getText(g.name)}¦${getText(g.procNo)}`;
          if (!processEntry.gpMap.has(gpKey)) processEntry.gpMap.set(gpKey, g);
        });
      });
    });

    return Array.from(byUnit.values()).sort((a, b) => a.unit.localeCompare(b.unit, "lv", { sensitivity: "base" }));
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
    const units = computeExecutors(p, c);

    tb.innerHTML = "";
    units.forEach((u) => {
      const unitKey = u.unit;
      const processList = Array.from(u.processMap.values()).sort((a, b) =>
        `${a.procNo} ${a.proc}`.localeCompare(`${b.procNo} ${b.proc}`, "lv", { sensitivity: "base" })
      );
      const unitGpCount = processList.reduce((acc, pr) => acc + Array.from(pr.gpMap.values()).length, 0);
      const processSectionOpen = executorProcessSectionExpanded.has(unitKey);
      const gpSectionOpen = executorGpSectionExpanded.has(unitKey);
      const isOpen = processSectionOpen || gpSectionOpen;

      const hdr = document.createElement("tr");
      hdr.className = "ex-unit-hdr";
      hdr.innerHTML = `
        <td>${u.unit}</td>
        <td><span class="ex-chip ex-chip-btn" title="Atvērt/aizvērt procesus"><span class="ex-arrow">${processSectionOpen ? "▾" : "▸"}</span> ${processList.length}</span></td>
        <td><span class="ex-chip ex-chip-btn" title="Atvērt/aizvērt galaproduktus"><span class="ex-arrow">${gpSectionOpen ? "▾" : "▸"}</span> ${unitGpCount}</span></td>
      `;
      const processChip = hdr.children[1] && hdr.children[1].querySelector(".ex-chip-btn");
      if (processChip) {
        const toggle = () => {
          if (executorProcessSectionExpanded.has(unitKey)) executorProcessSectionExpanded.delete(unitKey);
          else executorProcessSectionExpanded.add(unitKey);
          renderExecutorsView();
        };
        processChip.addEventListener("click", toggle);
        const processArrow = processChip.querySelector(".ex-arrow");
        if (processArrow) processArrow.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
      }
      const gpChip = hdr.children[2] && hdr.children[2].querySelector(".ex-chip-btn");
      if (gpChip) {
        const toggle = () => {
          if (executorGpSectionExpanded.has(unitKey)) executorGpSectionExpanded.delete(unitKey);
          else executorGpSectionExpanded.add(unitKey);
          renderExecutorsView();
        };
        gpChip.addEventListener("click", toggle);
        const gpArrow = gpChip.querySelector(".ex-arrow");
        if (gpArrow) gpArrow.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
      }
      tb.appendChild(hdr);
      if (!isOpen) return;
      if (!processSectionOpen && !gpSectionOpen) return;

      processList.forEach((pr) => {
        const pKey = `${unitKey}¦${pr.procNo}¦${pr.proc}`;
        const pOpen = executorProcessExpanded.has(pKey);
        const gpList = Array.from(pr.gpMap.values()).sort((a, b) =>
          `${a.no} ${a.name}`.localeCompare(`${b.no} ${b.name}`, "lv", { sensitivity: "base" })
        );
        const tr = document.createElement("tr");
        tr.className = "ex-proc-hdr";
        const c0 = document.createElement("td");
        c0.className = "ex-pad";
        c0.innerHTML = `<span class="ex-toggle"><span class="ex-arrow">${pOpen ? "▾" : "▸"}</span></span>`;
        const toggleProcess = () => {
          if (executorProcessExpanded.has(pKey)) executorProcessExpanded.delete(pKey);
          else executorProcessExpanded.add(pKey);
          renderExecutorsView();
        };
        const procToggle = c0.querySelector(".ex-toggle");
        if (procToggle) procToggle.addEventListener("click", toggleProcess);
        const procArrow = c0.querySelector(".ex-arrow");
        if (procArrow) procArrow.addEventListener("click", (e) => { e.stopPropagation(); toggleProcess(); });
        const c1 = document.createElement("td");
        const pText = document.createElement("span");
        pText.className = "ex-link";
        pText.textContent = [pr.procNo, pr.proc].filter(Boolean).join(" — ");
        pText.title = "Atvērt procesa kartiņu";
        pText.addEventListener("click", () => {
          openProcessCard(p, pr.procNo, pr.proc);
        });
        c1.appendChild(pText);
        c1.appendChild(document.createTextNode(" "));
        const pBtn = document.createElement("button");
        pBtn.type = "button";
        pBtn.className = "secondary";
        pBtn.textContent = "Procesa kartiņa";
        pBtn.addEventListener("click", () => {
          openProcessCard(p, pr.procNo, pr.proc);
        });
        c1.appendChild(pBtn);
        const c2 = document.createElement("td");
        c2.innerHTML = `<span class="ex-chip ex-muted-chip ex-chip-btn" title="Atvērt/aizvērt galaproduktus"><span class="ex-arrow">${pOpen ? "▾" : "▸"}</span> ${gpList.length}</span>`;
        const gpCountChip = c2.querySelector(".ex-chip-btn");
        if (gpCountChip) {
          const toggle = () => {
            if (!executorProcessSectionExpanded.has(unitKey)) executorProcessSectionExpanded.add(unitKey);
            if (executorProcessExpanded.has(pKey)) executorProcessExpanded.delete(pKey);
            else executorProcessExpanded.add(pKey);
            renderExecutorsView();
          };
          gpCountChip.addEventListener("click", toggle);
          const gpArrow = gpCountChip.querySelector(".ex-arrow");
          if (gpArrow) gpArrow.addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
        }
        tr.appendChild(c0); tr.appendChild(c1); tr.appendChild(c2);
        if (processSectionOpen || gpSectionOpen) tb.appendChild(tr);

        if (!gpSectionOpen) return;
        gpList.forEach((gp) => {
          const gtr = document.createElement("tr");
          gtr.className = "ex-gp-row";
          const g0 = document.createElement("td");
          g0.className = "ex-pad2";
          g0.textContent = "";
          const g1 = document.createElement("td");
          g1.textContent = "";
          const wrap = document.createElement("div");
          wrap.className = "ex-gp-wrap";
          const gpText = document.createElement("span");
          gpText.textContent = gp.no ? `${gp.no} — ${gp.name}` : gp.name;
          const gpBtn = document.createElement("button");
          gpBtn.type = "button";
          gpBtn.className = "secondary";
          gpBtn.textContent = "Galaprodukta kartiņa";
          gpBtn.addEventListener("click", () => {
            if (typeof window.openCatalogByProcessGp === "function") {
              window.openCatalogByProcessGp(gp.procNo, gp.name);
            }
          });
          wrap.appendChild(gpText);
          wrap.appendChild(gpBtn);
          const g2 = document.createElement("td");
          g2.appendChild(wrap);
          gtr.appendChild(g0); gtr.appendChild(g1); gtr.appendChild(g2);
          tb.appendChild(gtr);
        });
      });
    });

    if (typeof window.refreshExtraTableFilters === "function") {
      window.refreshExtraTableFilters();
    }
  }

  // publiskais API
  window.renderExecutorsView = renderExecutorsView;

  // Kad lapā dati atjaunojas
  window.addEventListener("app:db-sync", () => {
    // nerenderējam, ja skats pašlaik nav redzams (bet neobligāti)
    try {
      const card = document.getElementById("executorsCard");
      if (card && !card.classList.contains("hidden")) renderExecutorsView();
    } catch (_) {}
  });

  // pirmreizēja renderēšana, ja skats jau ir atvērts
  document.addEventListener("DOMContentLoaded", () => {
    try {
      // UI korekcijas (ja lapā joprojām ir veci teksti / sākotnējais stāvoklis).
      const tasksCard = document.getElementById("tasksViewCard");
      const tasksTitle = tasksCard ? tasksCard.querySelector(".section-title") : null;
      if (tasksTitle && tasksTitle.textContent && tasksTitle.textContent.trim() === "Uzdevumu skats") {
        tasksTitle.textContent = "Uzdevumi";
      }

      // Iestatījumi pēc noklusējuma: aizvērts.
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

      const rerenderIfVisible = () => {
        if (!card.classList.contains("hidden")) renderExecutorsView();
      };

      // Pirmais mēģinājums
      rerenderIfVisible();

      // Ja lietotājs atver/ aizver sadaļu navigācijā, renderējam pēc tam
      const obs = new MutationObserver(() => rerenderIfVisible());
      obs.observe(card, { attributes: true, attributeFilter: ["class"] });
    } catch (_) {}
  });
})();

