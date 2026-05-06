(function () {
  "use strict";

  const state = {
    quick: { process: "", task: "", output: "" },
    processHeader: {},
    catalogHeader: {},
    tasksHeader: {},
    executorsHeader: {},
    processGroupsHeader: {},
    processJomasHeader: {}
  };
  let extraRefreshRunning = false;
  let filterUiWired = false;
  let openFilterRef = null; // { tableId, colIndex }
  let suspendRestoreUntil = 0;

  function norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function contains(text, term) {
    if (!term) return true;
    return norm(text).includes(norm(term));
  }
  function splitCellValues(v) {
    return String(v || "")
      .split(/[;\n,]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }
  function getProcessTypeNoValuesFromCell(td) {
    if (!td) return [];
    const parts = Array.from(td.querySelectorAll("div"))
      .map((n) => String(n.textContent || "").trim())
      .filter(Boolean);
    if (parts.length) return parts;
    return splitCellValues(td.textContent || "");
  }
  function processTypeNoCellLineValues(cellLine) {
    return splitCellValues(cellLine ? cellLine.textContent : "");
  }
  /** GP akordeona detaļrindām tukšas ir procesa kopējās kolonnas (0–2) un platās kolonnas (7–13); filtrējot nedrīkst tās salīdzināt kā tukšās — izmantojam bloka galvenes rindas šūnas. */
  function processAccordionHeaderByBlock(rows) {
    const m = new Map();
    rows.forEach((tr) => {
      if (!tr.classList || !tr.classList.contains("process-accordion-hdr")) return;
      const bid = tr.getAttribute("data-accordion-block");
      if (bid) m.set(bid, tr);
    });
    return m;
  }
  function accordionPartHeader(tr, headerByBlock) {
    if (!tr.classList || !tr.classList.contains("process-accordion-part")) return null;
    const bid = tr.getAttribute("data-accordion-block");
    return bid ? headerByBlock.get(bid) || null : null;
  }
  /** Teksts kolonnas filtream / īso filtru laukiem — detaļrindām kopīgās kolonnas ņem no hdr (3–6: katras GP rindas šūnas šajā TR). */
  function processFilterCellText(tr, colNum, hdr) {
    const inheritHdr =
      hdr &&
      tr.classList &&
      tr.classList.contains("process-accordion-part") &&
      (colNum <= 2 || (colNum >= 7 && colNum <= 13));
    const rowEl = inheritHdr ? hdr : tr;
    const td = rowEl && rowEl.children ? rowEl.children[colNum] : null;
    return td ? String(td.textContent || "") : "";
  }

  function applyProcessGpLineFilter(tr, typeNoTerm) {
    const tds = Array.from(tr.children || []);
    const tdTypeNo = tds[3];
    const tdType = tds[4];
    const tdJoma = tds[5];
    const tdExec = tds[6];
    const noLines = tdTypeNo ? Array.from(tdTypeNo.querySelectorAll(":scope > div")) : [];
    const gpLines = tdType ? Array.from(tdType.querySelectorAll(":scope > div")) : [];
    const jomaLines = tdJoma ? Array.from(tdJoma.querySelectorAll(":scope > div")) : [];
    const execLines = tdExec ? Array.from(tdExec.querySelectorAll(":scope > div")) : [];
    if (!noLines.length) return true;
    let anyVisible = false;
    noLines.forEach((line, idx) => {
      const values = processTypeNoCellLineValues(line);
      const pass = !typeNoTerm || values.some((v) => norm(v) === norm(typeNoTerm));
      line.style.display = pass ? "" : "none";
      if (gpLines[idx]) gpLines[idx].style.display = pass ? "" : "none";
      if (jomaLines[idx]) jomaLines[idx].style.display = pass ? "" : "none";
      if (execLines[idx]) execLines[idx].style.display = pass ? "" : "none";
      if (pass) anyVisible = true;
    });
    return anyVisible;
  }

  function injectFilterStyles() {
    if (document.getElementById("filtersCss")) return;
    const s = document.createElement("style");
    s.id = "filtersCss";
    s.textContent = `
      .main-filter-wrap{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .search-icon-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;font-size:13px;cursor:pointer;flex-shrink:0}
      .main-filter-wrap select,.main-filter-wrap input{font-size:12px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px}
      .th-filter-wrap{display:flex;align-items:center;gap:4px;justify-content:space-between}
      .th-filter-zone{position:relative}
      .th-filter-btn{font-size:10px;padding:2px 5px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;cursor:pointer;line-height:1}
      .th-filter-btn.active{background:#dc2626;color:#fff;border-color:#dc2626;box-shadow:0 0 14px rgba(220,38,38,.45)}
      .th-filter-box{display:none;margin-top:4px}
      .th-filter-box.open{display:block}
      .th-filter-box select{width:100%;font-size:11px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#fff}
    `;
    document.head.appendChild(s);
  }

  function closeAllHeaderFilterBoxes(exceptBox) {
    document.querySelectorAll(".th-filter-box.open").forEach((box) => {
      if (exceptBox && box === exceptBox) return;
      box.classList.remove("open");
    });
    if (!exceptBox) openFilterRef = null;
  }

  function restoreOpenFilterBox() {
    if (Date.now() < suspendRestoreUntil) return;
    if (!openFilterRef || !openFilterRef.tableId) return;
    const table = document.getElementById(openFilterRef.tableId);
    if (!table) return;
    const sel = table.querySelector(`.th-filter-box select[data-col-index="${openFilterRef.colIndex}"]`);
    if (!sel) return;
    const box = sel.closest(".th-filter-box");
    if (!box) return;
    closeAllHeaderFilterBoxes(box);
    box.classList.add("open");
  }

  function wireFilterUiEvents() {
    if (filterUiWired) return;
    filterUiWired = true;
    // Hard-lock režīms: neaizveram filtrus ar ārēju klikšķi,
    // lai native select ritināšana/izvēle neizsistu popupu.
    // Aizvēršana notiek:
    // - pēc izvēles (change handler),
    // - ar atkārtotu klikšķi uz "Filtrs" pogas,
    // - ar Esc.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Esc") closeAllHeaderFilterBoxes();
    });
  }

  function ensureQuickFilters() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    if (!document.getElementById("searchIconBadge")) {
      const icon = document.createElement("span");
      icon.id = "searchIconBadge";
      icon.className = "search-icon-badge";
      icon.title = "Meklēt (vai Enter)";
      icon.textContent = "🔍";
      searchInput.insertAdjacentElement("afterend", icon);
    }
    const icon = document.getElementById("searchIconBadge");
    if (icon && !icon.dataset.boundSearchClick) {
      icon.dataset.boundSearchClick = "1";
      icon.addEventListener("click", () => {
        if (typeof window.runGlobalSearch === "function") window.runGlobalSearch();
      });
    }
    if (!searchInput.dataset.boundSearchEnter) {
      searchInput.dataset.boundSearchEnter = "1";
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (typeof window.runGlobalSearch === "function") window.runGlobalSearch();
        }
      });
    }
    searchInput.placeholder = "Meklē visās sadaļās...";
  }

  function ensureHeaderFilters(tableId, key, skipLast) {
    if (tableId === "processJomasTable") return; // Jomu sadaļai filtrēšana ir izslēgta.
    const table = document.getElementById(tableId);
    if (!table) return;
    const headRow = table.querySelector("thead tr");
    if (!headRow) return;
    if (headRow.dataset.filtersReady === "1") return;

    const sourceHeaders = Array.from(headRow.children);
    sourceHeaders.forEach((th, idx) => {
      const isLast = idx === sourceHeaders.length - 1;
      if (skipLast && isLast) return;

      const title = (th.getAttribute("data-filter-label") || "").trim() || (th.textContent || "").trim();
      th.textContent = "";

      const wrap = document.createElement("div");
      wrap.className = "th-filter-wrap";
      const zone = document.createElement("div");
      zone.className = "th-filter-zone";

      const label = document.createElement("span");
      label.textContent = title;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "th-filter-btn";
      btn.textContent = "Filtrs";
      btn.title = "Filtrēt kolonnu";

      const box = document.createElement("div");
      box.className = "th-filter-box";

      const select = document.createElement("select");
      select.dataset.colIndex = String(idx);
      select.dataset.tableId = tableId;
      const emptyOpt = document.createElement("option");
      emptyOpt.value = "";
      emptyOpt.textContent = "Visas vērtības";
      select.appendChild(emptyOpt);

      const onFilterChange = (value) => {
        const col = select.dataset.colIndex;
        state[key][col] = value;
        btn.classList.toggle("active", norm(value) !== "");
        box.classList.remove("open");
        openFilterRef = null;
        if (tableId === "executorsTable") {
          applyExecutorsFilters();
          refreshClearFilterButtonActive();
          return;
        }
        selectBestLevel();
        applyAllFilters();
      };
      select.addEventListener("change", (e) => onFilterChange(e.target.value));

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Klikšķis uz "degošas" ikonas = notīrīt šīs kolonnas filtru.
        if (btn.classList.contains("active")) {
          select.value = "";
          onFilterChange("");
          closeAllHeaderFilterBoxes();
          openFilterRef = null;
          suspendRestoreUntil = Date.now() + 1200;
          return;
        }
        const isOpen = box.classList.contains("open");
        // Uz klikšķa pa jau atvērtu ikonu — vienmēr aizveram.
        if (isOpen) {
          closeAllHeaderFilterBoxes();
          openFilterRef = null;
          suspendRestoreUntil = Date.now() + 1200;
          return;
        }
        const willOpen = true;
        closeAllHeaderFilterBoxes(willOpen ? box : null);
        box.classList.toggle("open", willOpen);
        if (box.classList.contains("open")) {
          openFilterRef = { tableId, colIndex: String(idx) };
          select.focus();
        } else {
          openFilterRef = null;
        }
      });
      box.addEventListener("click", (e) => e.stopPropagation());
      box.appendChild(select);
      wrap.appendChild(label);
      wrap.appendChild(btn);
      zone.appendChild(wrap);
      zone.appendChild(box);
      th.appendChild(zone);
    });

    headRow.dataset.filtersReady = "1";
  }

  function selectBestLevel() {
    const level = document.getElementById("levelSelect");
    if (!level) return;

    const hasOutput = norm(state.quick.output) !== "" || Object.keys(state.processHeader).some((k) => Number(k) >= 8 && norm(state.processHeader[k]) !== "");
    const hasMain = norm(state.quick.process) !== "" || norm(state.quick.task) !== "";

    let target = null;
    if (hasOutput) target = "3";
    else if (hasMain) target = "2";

    if (target && level.value !== target) {
      level.value = target;
      if (typeof window.applyLevel === "function") window.applyLevel();
      if (typeof window.rebuildMx === "function") window.rebuildMx();
    }
  }

  function applyProcessFilters() {
    const tbody = document.querySelector("#processTable tbody");
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll("tr"));
    const headerByBlock = processAccordionHeaderByBlock(rows);
    rows.forEach((tr) => {
      const hdr = accordionPartHeader(tr, headerByBlock);
      const taskText = `${processFilterCellText(tr, 1, hdr)} ${processFilterCellText(tr, 2, hdr)}`;
      const processText = `${processFilterCellText(tr, 3, hdr)} ${processFilterCellText(tr, 4, hdr)}`;
      const outputText = processFilterCellText(tr, 7, hdr);

      let show =
        contains(processText, state.quick.process) &&
        contains(taskText, state.quick.task) &&
        contains(outputText, state.quick.output);
      const typeNoFilter = state.processHeader["3"] || "";

      if (show) {
        for (const col in state.processHeader) {
          const term = state.processHeader[col];
          const colNum = Number(col);
          const typeNoTd = tr.children && tr.children[colNum] != null ? tr.children[colNum] : null;
          // "Procesa galaprodukta Nr." kolonnā šūnā var būt vairāki Nr.;
          // filtrējam pēc atsevišķa numura, nevis pēc salīmēta teksta.
          const pass = colNum === 3
            ? getProcessTypeNoValuesFromCell(typeNoTd).some((v) => norm(v) === norm(term))
            : contains(processFilterCellText(tr, colNum, hdr), term);
          if (!pass) {
            show = false;
            break;
          }
        }
      }
      if (show && norm(typeNoFilter) !== "") {
        show = applyProcessGpLineFilter(tr, typeNoFilter);
      } else {
        applyProcessGpLineFilter(tr, "");
      }
      tr.style.display = show ? "" : "none";
    });

    headerByBlock.forEach((hdr, bid) => {
      if ((hdr.style && hdr.style.display) === "none") {
        tbody.querySelectorAll(`tr.process-accordion-part[data-accordion-block="${CSS.escape(bid)}"]`).forEach((part) => {
          part.style.display = "none";
        });
      }
    });
  }

  function applyCatalogFilters() {
    const tbody = document.querySelector("#catalogTable tbody");
    if (!tbody) return;
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = !globalTerm || contains(tds.map((td) => td.textContent || "").join(" "), globalTerm);
      for (const col in state.catalogHeader) {
        const term = state.catalogHeader[col];
        if (!contains(tds[Number(col)]?.textContent || "", term)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function applyTasksFilters() {
    const tbody = document.querySelector("#tasksSummaryTable tbody");
    if (!tbody) return;
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = !globalTerm || contains(tds.map((td) => td.textContent || "").join(" "), globalTerm);
      for (const col in state.tasksHeader) {
        const term = state.tasksHeader[col];
        if (!contains(tds[Number(col)]?.textContent || "", term)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function applyExecutorsFilters() {
    const tbody = document.querySelector("#executorsTable tbody");
    if (!tbody) return;
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      // Izpildītāju skatā pēdējā kolonna var saturēt ļoti garu GP tekstu;
      // to neiekļaujam globālajā meklēšanā, lai nepieļautu UI uzkāršanos.
      const quickSearchText = tds.slice(0, 4).map((td) => td.textContent || "").join(" ");
      let show = !globalTerm || contains(quickSearchText, globalTerm);
      for (const col in state.executorsHeader) {
        const term = state.executorsHeader[col];
        if (!contains(tds[Number(col)]?.textContent || "", term)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function applySimpleTableFilters(tableId, key) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = true;
      for (const col in state[key]) {
        const term = state[key][col];
        if (!contains(tds[Number(col)]?.textContent || "", term)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }
  function applyAccordionTableFilters(tableId, key) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const headers = rows.filter((tr) => tr.classList && tr.classList.contains("process-accordion-hdr"));
    const hasTerms = Object.values(state[key] || {}).some((v) => norm(v) !== "");
    // Bez aktīviem filtriem NEAIZTIEKAM tabulas redzamību:
    // atstājam tieši renderētās atvēršanas/aizvēršanas stāvokli.
    if (!hasTerms) return;
    const cellText = (tr, col, hdr) => {
      if (!tr) return "";
      const isPart = tr.classList && tr.classList.contains("process-accordion-part");
      if (isPart && Number(col) === 0 && hdr) return String(hdr.children[0]?.textContent || "");
      return String(tr.children[Number(col)]?.textContent || "");
    };
    const rowMatches = (tr, hdr) => {
      for (const col in state[key]) {
        const term = state[key][col];
        if (!contains(cellText(tr, col, hdr), term)) return false;
      }
      return true;
    };
    headers.forEach((hdr) => {
      const bid = hdr.getAttribute("data-accordion-block");
      const parts = bid
        ? rows.filter((tr) => tr.classList && tr.classList.contains("process-accordion-part") && tr.getAttribute("data-accordion-block") === bid)
        : [];
      const hdrMatch = rowMatches(hdr, hdr);
      const partMatches = parts.map((tr) => rowMatches(tr, hdr));
      const anyPartMatch = partMatches.some(Boolean);
      const blockShow = hdrMatch || anyPartMatch;
      hdr.style.display = blockShow ? "" : "none";
      parts.forEach((tr, idx) => {
        if (!blockShow) {
          tr.style.display = "none";
          return;
        }
        tr.style.display = partMatches[idx] ? "" : "none";
      });
    });
  }

  function hasActiveFilters() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput && norm(searchInput.value) !== "") return true;
    if (Object.values(state.processHeader || {}).some((v) => norm(v) !== "")) return true;
    if (Object.values(state.catalogHeader || {}).some((v) => norm(v) !== "")) return true;
    if (Object.values(state.tasksHeader || {}).some((v) => norm(v) !== "")) return true;
    if (Object.values(state.executorsHeader || {}).some((v) => norm(v) !== "")) return true;
    if (Object.values(state.processGroupsHeader || {}).some((v) => norm(v) !== "")) return true;
    if (typeof window.hasActiveStatsFilters === "function" && window.hasActiveStatsFilters()) return true;
    return false;
  }

  function refreshClearFilterButtonActive() {
    const btn = document.getElementById("clearFiltersBtn");
    if (!btn) return;
    const on = hasActiveFilters();
    btn.classList.toggle("filter-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function applyAllFilters() {
    applyProcessFilters();
    applyCatalogFilters();
    applyTasksFilters();
    applyExecutorsFilters();
    applyAccordionTableFilters("processGroupsTable", "processGroupsHeader");
    autoOpenOnFilteredResult();
    refreshClearFilterButtonActive();
    if (typeof window.renderReports === "function") window.renderReports();
  }

  function autoOpenOnFilteredResult() {
    const processTable = document.getElementById("processTable");
    const catalogTable = document.getElementById("catalogTable");
    const processHasFilter = Object.values(state.processHeader || {}).some((v) => norm(v) !== "");
    const catalogHasFilter = Object.values(state.catalogHeader || {}).some((v) => norm(v) !== "");

    if (processTable && processHasFilter) {
      const hasVisible = Array.from(processTable.querySelectorAll("tbody tr")).some((tr) => tr.style.display !== "none");
      if (hasVisible && processTable.classList.contains("table-body-hidden")) {
        processTable.classList.remove("table-body-hidden");
        const b = document.getElementById("toggleProcessBtn");
        if (b) b.textContent = "Aizvērt procesu reģistru";
      }
    }
    if (catalogTable && catalogHasFilter) {
      const hasVisible = Array.from(catalogTable.querySelectorAll("tbody tr")).some((tr) => tr.style.display !== "none");
      if (hasVisible && catalogTable.classList.contains("table-body-hidden")) {
        catalogTable.classList.remove("table-body-hidden");
        const b = document.getElementById("toggleCatalogBtn");
        if (b) b.textContent = "Aizvērt katalogu";
      }
    }

    const tasksTable = document.getElementById("tasksSummaryTable");
    const tasksHasFilter = Object.values(state.tasksHeader || {}).some((v) => norm(v) !== "");
    if (tasksTable && tasksHasFilter) {
      const taskCard = document.getElementById("tasksViewCard");
      const hasVisible = Array.from(tasksTable.querySelectorAll("tbody tr")).some((tr) => tr.style.display !== "none");
      if (taskCard && hasVisible) taskCard.classList.remove("hidden");
      if (tasksTable.classList.contains("table-body-hidden")) {
        tasksTable.classList.remove("table-body-hidden");
        if (document.getElementById("toggleTasksBtn")) document.getElementById("toggleTasksBtn").textContent = "Aizvērt uzdevumu skatu";
      }
    }

    // Izpildītāju skatu šeit automātiski neveram vaļā, jo tas var izraisīt
    // class-change -> rerender ciklus un UI uzkāršanos.
  }

  function refreshHeaderFilterOptions(tableId, key) {
    if (tableId === "processJomasTable") return; // Jomu sadaļai filtrēšana ir izslēgta.
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const selects = Array.from(table.querySelectorAll(".th-filter-box select[data-col-index]"));
    selects.forEach((select) => {
      const col = Number(select.dataset.colIndex);
      const selected = state[key][String(col)] || "";
      const uniqVals = new Set();
      if (
        tableId === "processTable" &&
        col === 5 &&
        typeof window.collectProcessTableJomaFilterLikeValues === "function" &&
        typeof window.getMergedProcessRegisterRows === "function"
      ) {
        const mergedRows = window.getMergedProcessRegisterRows();
        const jomaVals = window.collectProcessTableJomaFilterLikeValues(mergedRows);
        Array.from(jomaVals || []).forEach((v) => {
          const clean = String(v || "").trim();
          if (clean) uniqVals.add(clean);
        });
      } else {
      if (tableId === "processJomasTable" || tableId === "processGroupsTable") {
        const hdrRows = Array.from(tbody.querySelectorAll("tr.process-accordion-hdr"));
        if (col === 0) {
          hdrRows.forEach((tr) => {
            const raw = String(tr.children[0]?.textContent || "").trim();
            if (raw) uniqVals.add(raw);
          });
        } else {
          const partRows = Array.from(tbody.querySelectorAll("tr.process-accordion-part"));
          partRows.forEach((tr) => {
            const raw = String(tr.children[col]?.textContent || "").trim();
            if (raw) uniqVals.add(raw);
          });
        }
      } else {
      Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
        const raw = String(tr.children[col]?.textContent || "").trim();
        if (!raw) return;
        if (tableId === "processTable" && col === 3) {
          getProcessTypeNoValuesFromCell(tr.children[col]).forEach((v) => uniqVals.add(v));
          return;
        }
        uniqVals.add(raw);
      });
      }
      }
      select.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Visas vērtības";
      select.appendChild(empty);
      Array.from(uniqVals).sort().slice(0, 600).forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        select.appendChild(o);
      });
      select.value = selected;
      const btn = select.closest("th")?.querySelector(".th-filter-btn");
      if (btn) btn.classList.toggle("active", norm(selected) !== "");
    });
    restoreOpenFilterBox();
  }

  function rerender() {
    if (typeof window.renderTable === "function") window.renderTable();
    applyAllFilters();
  }

  function clearAllFilters() {
    state.quick = { process: "", task: "", output: "" };
    state.processHeader = {};
    state.catalogHeader = {};
    state.tasksHeader = {};
    state.executorsHeader = {};
    state.processGroupsHeader = {};
    state.processJomasHeader = {};

    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    document.querySelectorAll(".th-filter-box select[data-col-index]").forEach((s) => {
      s.value = "";
    });
    document.querySelectorAll(".th-filter-btn.active").forEach((b) => b.classList.remove("active"));
    if (typeof window.clearStatsFilters === "function") window.clearStatsFilters();

    rerender();
    refreshClearFilterButtonActive();
  }

  function setupRenderHook() {
    // index.html renderTable ir lokāla funkcija; drošāk ir dot publisku pēcrendera callback.
    window.__afterTableRenderFilters = function () {
      // Galvenes var tikt pārbūvētas (kompaktais/detalizētais skats), tāpēc filtrus
      // vienmēr nodrošinām atkārtoti pirms opciju atjaunošanas.
      ensureHeaderFilters("processTable", "processHeader", true);
      ensureHeaderFilters("catalogTable", "catalogHeader", false);
      refreshHeaderFilterOptions("processTable", "processHeader");
      refreshHeaderFilterOptions("catalogTable", "catalogHeader");
      refreshHeaderFilterOptions("tasksSummaryTable", "tasksHeader");
      // executorsTable ir dinamiska; refreshHeaderFilterOptions droši ignorēs, ja nav
      refreshHeaderFilterOptions("executorsTable", "executorsHeader");
      refreshHeaderFilterOptions("processGroupsTable", "processGroupsHeader");
      applyAllFilters();
    };
  }

  function refreshExtraTableFilters() {
    if (extraRefreshRunning) return;
    extraRefreshRunning = true;
    try {
    ensureHeaderFilters("tasksSummaryTable", "tasksHeader", true);
    refreshHeaderFilterOptions("tasksSummaryTable", "tasksHeader");
    const execTable = document.getElementById("executorsTable");
    const execHead = execTable ? execTable.querySelector("thead tr") : null;
    const execHasFilters = !!(execHead && execHead.querySelector(".th-filter-box select[data-col-index]"));
    if (execHead && !execHasFilters) execHead.dataset.filtersReady = "";
    ensureHeaderFilters("executorsTable", "executorsHeader", true);
    refreshHeaderFilterOptions("executorsTable", "executorsHeader");
    applyTasksFilters();
    applyExecutorsFilters();
    refreshClearFilterButtonActive();
    } finally {
      extraRefreshRunning = false;
    }
  }

  function init() {
    injectFilterStyles();
    wireFilterUiEvents();
    ensureQuickFilters();
    ensureHeaderFilters("processTable", "processHeader", true);
    ensureHeaderFilters("catalogTable", "catalogHeader", false);
    ensureHeaderFilters("tasksSummaryTable", "tasksHeader", true);
    ensureHeaderFilters("processGroupsTable", "processGroupsHeader", false);
    refreshHeaderFilterOptions("processTable", "processHeader");
    refreshHeaderFilterOptions("catalogTable", "catalogHeader");
    refreshHeaderFilterOptions("tasksSummaryTable", "tasksHeader");
    refreshHeaderFilterOptions("processGroupsTable", "processGroupsHeader");
    setupRenderHook();
    applyAllFilters();
    window.removeAllFilters = clearAllFilters;
    window.refreshClearFilterButtonActive = refreshClearFilterButtonActive;
    window.refreshExtraTableFilters = refreshExtraTableFilters;
    const clearBtn = document.getElementById("clearFiltersBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearAllFilters);
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.addEventListener("input", refreshClearFilterButtonActive);
    refreshClearFilterButtonActive();

    // executors table ir dinamiska (tiek ģenerēta Izpilditaji.js laikā),
    // tāpēc mēģinām piesaistīt kolonnu filtrus, kad tā parādās.
    const execTimer = setInterval(() => {
      const table = document.getElementById("executorsTable");
      if (!table) return;
      if (table.dataset.filtersReady === "1") {
        const hasSelects = table.querySelector("thead tr .th-filter-box select[data-col-index]");
        if (hasSelects) {
          clearInterval(execTimer);
          return;
        }
      }
      ensureHeaderFilters("executorsTable", "executorsHeader", true);
      refreshHeaderFilterOptions("executorsTable", "executorsHeader");
      table.dataset.filtersReady = "1";
      applyAllFilters();
      refreshClearFilterButtonActive();
      clearInterval(execTimer);
    }, 400);
  }

  function boot() {
    if (!document.getElementById("processTable") || typeof window.renderTable !== "function") {
      setTimeout(boot, 200);
      return;
    }
    init();
  }

  boot();
})();
