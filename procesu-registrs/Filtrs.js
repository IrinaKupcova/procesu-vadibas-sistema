(function () {
  "use strict";

  const state = {
    quick: { process: "", task: "", output: "" },
    processHeader: {},
    catalogHeader: {},
    tasksHeader: {},
    executorsHeader: {},
    processGroupsHeader: {},
    processJomasHeader: {},
    naHeader: {},
  };
  let extraRefreshRunning = false;
  let filterUiWired = false;
  let openFilterRef = null; // { tableId, colIndex }
  let suspendRestoreUntil = 0;

  function norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function normalizeFilterValue(v) {
    if (v == null || v === "") return [];
    if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
    const s = String(v).trim();
    return s ? [s] : [];
  }

  function isFilterActive(v) {
    return normalizeFilterValue(v).length > 0;
  }

  function cellMatchesAnyTerm(cellText, terms, exactValues) {
    const list = normalizeFilterValue(terms);
    if (!list.length) return true;
    if (exactValues && exactValues.length) {
      return list.some((t) => exactValues.some((v) => norm(v) === norm(t)));
    }
    const text = String(cellText || "");
    return list.some((t) => contains(text, t) || norm(text) === norm(t));
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

  function applyProcessGpLineFilter(tr, typeNoTerms) {
    const terms = normalizeFilterValue(typeNoTerms);
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
      const pass = !terms.length || values.some((v) => terms.some((t) => norm(v) === norm(t)));
      line.style.display = pass ? "" : "none";
      if (gpLines[idx]) gpLines[idx].style.display = pass ? "" : "none";
      if (jomaLines[idx]) jomaLines[idx].style.display = pass ? "" : "none";
      if (execLines[idx]) execLines[idx].style.display = pass ? "" : "none";
      if (pass) anyVisible = true;
    });
    return anyVisible;
  }

  const TABLE_IDS_FOR_COL_SIZING = [
    "processTable",
    "catalogTable",
    "tasksSummaryTable",
    "processGroupsTable",
    "processJomasTable",
    "naTable",
  ];

  function getColumnHeaderLabel(th) {
    if (!th) return "";
    const fromData = (th.getAttribute("data-filter-label") || "").trim();
    if (fromData) return fromData;
    const span = th.querySelector(".th-filter-wrap > span");
    if (span) return (span.textContent || "").trim();
    return (th.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isNumericishCellText(text) {
    const t = String(text || "").trim();
    if (!t || t.length > 24) return false;
    if (/^\d+([.,]\d+)?$/.test(t)) return true;
    if (/^\d+([.,]\d+)?\s*%$/.test(t)) return true;
    return /^[\d.,\s%+\-]+$/.test(t);
  }

  function sampleColumnCellTexts(table, colIndex, limit) {
    const max = limit || 24;
    const samples = [];
    const tbody = table.querySelector("tbody");
    if (!tbody) return samples;
    for (const tr of tbody.querySelectorAll("tr")) {
      if (samples.length >= max) break;
      const td = tr.children[colIndex];
      if (!td) continue;
      if (td.querySelector("button, input[type='button'], input[type='submit']") && !td.querySelector("span, a")) continue;
      const txt = (td.textContent || "").trim();
      if (txt) samples.push(txt);
    }
    return samples;
  }

  function classifyTableColumn(th, colIndex, colCount, table) {
    const label = getColumnHeaderLabel(th);
    const l = label.toLowerCase();
    if (/kartiņa/.test(l)) return "col-action";
    if (!l && colIndex === colCount - 1) return "col-action";
    if (/\bnr\.?\b/.test(l) || /\bprocesu\s+skaits\b/.test(l) || /\bkārta\b/.test(l) || /^akt\.?$/.test(l) || /\bskaits\b/.test(l)) {
      return "col-narrow";
    }
    const samples = sampleColumnCellTexts(table, colIndex);
    if (samples.length >= 2) {
      const numeric = samples.filter(isNumericishCellText).length;
      if (numeric / samples.length >= 0.8) return "col-narrow";
    }
    return "col-wide";
  }

  function applyTableColumnSizing(tableOrId) {
    const table = typeof tableOrId === "string" ? document.getElementById(tableOrId) : tableOrId;
    if (!table) return;
    const headRow = table.querySelector("thead tr");
    if (!headRow || !headRow.children.length) return;

    table.classList.add("data-col-sized");
    const colCount = headRow.children.length;
    const types = [];

    Array.from(headRow.children).forEach((th, idx) => {
      const type = classifyTableColumn(th, idx, colCount, table);
      types[idx] = type;
      th.classList.remove("col-narrow", "col-wide", "col-action");
      th.classList.add(type);
    });

    table.querySelectorAll("tbody tr").forEach((tr) => {
      Array.from(tr.children).forEach((td, idx) => {
        if (idx >= colCount) return;
        td.classList.remove("col-narrow", "col-wide", "col-action");
        if (types[idx]) td.classList.add(types[idx]);
      });
    });

    const legacyColgroup = table.querySelector("colgroup");
    if (legacyColgroup) legacyColgroup.remove();
  }

  function applyAllTableColumnSizing() {
    TABLE_IDS_FOR_COL_SIZING.forEach((id) => applyTableColumnSizing(id));
    document.querySelectorAll("table.help-admin-table").forEach((table) => applyTableColumnSizing(table));
  }

  function injectFilterStyles() {
    let s = document.getElementById("filtersCss");
    if (!s) {
      s = document.createElement("style");
      s.id = "filtersCss";
      document.head.appendChild(s);
    }
    s.textContent = `
      .main-filter-wrap{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .search-icon-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;font-size:13px;cursor:pointer;flex-shrink:0}
      .main-filter-wrap select,.main-filter-wrap input{font-size:12px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px}
      .th-filter-wrap{display:flex;flex-direction:column;align-items:flex-start;gap:3px;font-size:11px;font-weight:400;line-height:1.2;text-transform:none;letter-spacing:normal}
      .th-filter-wrap > span{font-weight:400;font-size:11px;line-height:1.25;text-transform:none;letter-spacing:normal;display:block;max-width:100%;word-break:break-word}
      .th-filter-zone{position:relative;text-transform:none;letter-spacing:normal;width:100%}
      .th-filter-btn{font-size:9px;padding:1px 5px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;cursor:pointer;line-height:1.15;font-weight:400;text-transform:none;letter-spacing:normal}
      .th-filter-btn.active{background:#dc2626;color:#fff;border-color:#dc2626;box-shadow:0 0 10px rgba(220,38,38,.35)}
      .th-filter-box{display:none;margin-top:2px;position:relative;z-index:20}
      .th-filter-box.open{display:block}
      .th-filter-checklist{max-height:180px;overflow:auto;border:1px solid #cbd5e1;border-radius:4px;background:#fff;padding:2px 4px;font-size:10px;min-width:140px;max-width:min(280px,70vw);font-weight:400;text-transform:none;letter-spacing:normal}
      .th-filter-checklist label{display:flex;align-items:flex-start;gap:4px;padding:2px 1px;cursor:pointer;line-height:1.2;color:#334155;font-weight:400;text-transform:none;letter-spacing:normal}
      .th-filter-checklist label span{font-weight:400;text-transform:none;letter-spacing:normal}
      .th-filter-checklist label:hover{background:#f1f5f9}
      .th-filter-checklist input[type=checkbox]{margin-top:1px;flex-shrink:0;transform:scale(0.9)}
      .th-filter-check-all{border-bottom:1px solid #e2e8f0;margin-bottom:2px;padding-bottom:2px;font-weight:400;font-size:10px;text-transform:none;letter-spacing:normal}
      table.data-col-sized{table-layout:auto;width:100%}
      table.data-col-sized th.col-narrow,table.data-col-sized td.col-narrow{width:1%;vertical-align:top}
      table.data-col-sized th.col-narrow{min-width:96px;white-space:normal;word-break:break-word;overflow:visible}
      table.data-col-sized td.col-narrow{white-space:nowrap}
      table.data-col-sized th.col-action,table.data-col-sized td.col-action{width:1%;min-width:112px;white-space:nowrap;vertical-align:top;overflow:visible}
      table.data-col-sized th.col-wide,table.data-col-sized td.col-wide{min-width:150px;width:auto;white-space:normal;word-break:break-word;vertical-align:top}
    `;
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
    const list = table.querySelector(`.th-filter-checklist[data-col-index="${openFilterRef.colIndex}"]`);
    if (!list) return;
    const box = list.closest(".th-filter-box");
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
        if (typeof window.runGlobalSearch === "function") window.runGlobalSearch({ scrollToResults: true });
      });
    }
    if (!searchInput.dataset.boundSearchEnter) {
      searchInput.dataset.boundSearchEnter = "1";
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (typeof window.runGlobalSearch === "function") window.runGlobalSearch({ scrollToResults: true });
        }
      });
    }
    if (!searchInput.dataset.boundGlobalFilter) {
      searchInput.dataset.boundGlobalFilter = "1";
      let globalFilterTimer = null;
      searchInput.addEventListener("input", () => {
        if (globalFilterTimer) clearTimeout(globalFilterTimer);
        globalFilterTimer = setTimeout(() => {
          globalFilterTimer = null;
          if (typeof window.runGlobalSearch === "function") window.runGlobalSearch();
          else {
            applyAllFilters();
            refreshClearFilterButtonActive();
          }
        }, 350);
      });
    }
    searchInput.placeholder = "Meklē visās sadaļās...";
  }

  function populateFilterChecklist(list, values, selected) {
    if (!list) return;
    const selectedSet = new Set(normalizeFilterValue(selected).map(norm));
    list.innerHTML = "";
    const allLabel = document.createElement("label");
    allLabel.className = "th-filter-check-all";
    const allCb = document.createElement("input");
    allCb.type = "checkbox";
    allCb.checked = selectedSet.size === 0;
    allLabel.appendChild(allCb);
    allLabel.appendChild(document.createTextNode(" Visas vērtības"));
    allCb.addEventListener("change", () => {
      if (!allCb.checked) return;
      list.querySelectorAll("input.th-filter-value-cb").forEach((cb) => {
        cb.checked = false;
      });
      allCb.checked = true;
      list.dispatchEvent(new Event("filter-checklist-change", { bubbles: true }));
    });
    list.appendChild(allLabel);
    Array.from(values)
      .sort((a, b) => String(a).localeCompare(String(b), "lv", { sensitivity: "base" }))
      .slice(0, 600)
      .forEach((v) => {
        const label = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "th-filter-value-cb";
        cb.value = v;
        cb.checked = selectedSet.has(norm(v));
        cb.addEventListener("change", () => {
          if (cb.checked) allCb.checked = false;
          else if (!list.querySelector("input.th-filter-value-cb:checked")) allCb.checked = true;
          list.dispatchEvent(new Event("filter-checklist-change", { bubbles: true }));
        });
        label.appendChild(cb);
        const txt = document.createElement("span");
        txt.textContent = v;
        label.appendChild(txt);
        list.appendChild(label);
      });
  }

  function readChecklistSelection(list) {
    if (!list) return [];
    return Array.from(list.querySelectorAll("input.th-filter-value-cb:checked"))
      .map((cb) => String(cb.value || "").trim())
      .filter(Boolean);
  }

  function clearChecklistSelection(list) {
    if (!list) return;
    list.querySelectorAll("input.th-filter-value-cb").forEach((cb) => {
      cb.checked = false;
    });
    const allCb = list.querySelector(".th-filter-check-all input[type=checkbox]");
    if (allCb) allCb.checked = true;
  }

  function ensureHeaderFilters(tableId, key, skipLast) {
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

      const list = document.createElement("div");
      list.className = "th-filter-checklist";
      list.dataset.colIndex = String(idx);
      list.dataset.tableId = tableId;
      list.dataset.stateKey = key;

      const onFilterChange = () => {
        const col = list.dataset.colIndex;
        const vals = readChecklistSelection(list);
        if (vals.length) state[key][col] = vals;
        else delete state[key][col];
        btn.classList.toggle("active", vals.length > 0);
        if (tableId === "executorsTable") {
          applyExecutorsFilters();
          refreshClearFilterButtonActive();
          return;
        }
        if (tableId === "naTable") {
          applyNaFilters();
          refreshClearFilterButtonActive();
          return;
        }
        if (tableId === "processJomasTable") {
          applyJomasFilters();
          refreshClearFilterButtonActive();
          return;
        }
        if (tableId === "processGroupsTable") {
          applyAccordionTableFilters(tableId, key);
          refreshClearFilterButtonActive();
          return;
        }
        selectBestLevel();
        applyAllFilters();
      };
      list.addEventListener("filter-checklist-change", onFilterChange);

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.classList.contains("active")) {
          clearChecklistSelection(list);
          onFilterChange();
          closeAllHeaderFilterBoxes();
          openFilterRef = null;
          suspendRestoreUntil = Date.now() + 1200;
          return;
        }
        const isOpen = box.classList.contains("open");
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
        } else {
          openFilterRef = null;
        }
      });
      box.addEventListener("click", (e) => e.stopPropagation());
      box.appendChild(list);
      wrap.appendChild(label);
      wrap.appendChild(btn);
      zone.appendChild(wrap);
      zone.appendChild(box);
      th.appendChild(zone);
    });

    headRow.dataset.filtersReady = "1";
    applyTableColumnSizing(table);
  }

  function selectBestLevel() {
    const level = document.getElementById("levelSelect");
    if (!level) return;

    const hasOutput = norm(state.quick.output) !== "" || Object.keys(state.processHeader).some((k) => Number(k) >= 8 && isFilterActive(state.processHeader[k]));
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

    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
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
      if (show && globalTerm) {
        const rowHay = Array.from(tr.children || [])
          .map((td) => td.textContent || "")
          .join(" ");
        if (!contains(rowHay, globalTerm)) show = false;
      }
      const typeNoFilter = state.processHeader["3"] || "";

      if (show) {
        for (const col in state.processHeader) {
          const terms = normalizeFilterValue(state.processHeader[col]);
          if (!terms.length) continue;
          const colNum = Number(col);
          const typeNoTd = tr.children && tr.children[colNum] != null ? tr.children[colNum] : null;
          const pass = colNum === 3
            ? cellMatchesAnyTerm("", terms, getProcessTypeNoValuesFromCell(typeNoTd))
            : cellMatchesAnyTerm(processFilterCellText(tr, colNum, hdr), terms);
          if (!pass) {
            show = false;
            break;
          }
        }
      }
      if (show && isFilterActive(typeNoFilter)) {
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
        const terms = normalizeFilterValue(state.catalogHeader[col]);
        if (!cellMatchesAnyTerm(tds[Number(col)]?.textContent || "", terms)) {
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
        const terms = normalizeFilterValue(state.tasksHeader[col]);
        if (!cellMatchesAnyTerm(tds[Number(col)]?.textContent || "", terms)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function executorsRowMatches(tr, globalTerm) {
    const fromData = String(tr.dataset.filterHay || "").trim();
    if (fromData) {
      if (globalTerm && !contains(fromData, globalTerm)) return false;
      for (const col in state.executorsHeader) {
        const terms = normalizeFilterValue(state.executorsHeader[col]);
        if (!terms.length) continue;
        if (!cellMatchesAnyTerm(fromData, terms)) return false;
      }
      return true;
    }
    const tds = Array.from(tr.children || []);
    if (!tds.length) return false;
    const text = tds.map((td) => td.textContent || "").join(" ");
    if (globalTerm && !contains(text, globalTerm)) return false;
    for (const col in state.executorsHeader) {
      const terms = normalizeFilterValue(state.executorsHeader[col]);
      if (!terms.length) continue;
      const idx = Number(col);
      if (!cellMatchesAnyTerm(tds[idx]?.textContent || "", terms)) return false;
    }
    return true;
  }

  function jomasTableUsesCardLayout() {
    return !!document.getElementById("jomasListRoot");
  }

  function jomasTableUsesExecutorLayout() {
    return jomasTableUsesCardLayout() || !!document.querySelector("#processJomasTable tbody tr.ex-dept-hdr");
  }

  function jomaRowFilterText(tr, col) {
    const idx = Number(col);
    if (tr.classList.contains("ex-dept-hdr")) {
      return String(tr.children[idx]?.textContent || "").trim();
    }
    if (idx === 0) return String(tr.children[0]?.textContent || "").trim();
    if (idx === 1) {
      return String(tr.getAttribute("data-joma-proc") || tr.children[1]?.textContent || "").trim();
    }
    if (idx === 2) {
      return String(tr.getAttribute("data-joma-gp") || tr.children[tr.children.length - 1]?.textContent || "").trim();
    }
    return "";
  }

  function jomasRowMatches(tr, globalTerm) {
    if (globalTerm) {
      const hay = [
        tr.textContent || "",
        tr.getAttribute("data-joma-proc") || "",
        tr.getAttribute("data-joma-gp") || "",
      ].join(" ");
      if (!contains(hay, globalTerm)) return false;
    }
    for (const col in state.processJomasHeader) {
      const terms = normalizeFilterValue(state.processJomasHeader[col]);
      if (!terms.length) continue;
      const idx = Number(col);
      if (!cellMatchesAnyTerm(jomaRowFilterText(tr, idx), terms)) return false;
    }
    return true;
  }

  function applyJomasFilters() {
    const listRoot = document.getElementById("jomasListRoot");
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const hasColFilters = Object.values(state.processJomasHeader || {}).some((v) => isFilterActive(v));

    if (listRoot) {
      const blocks = Array.from(listRoot.querySelectorAll(".ex-parvalde-block"));
      if (!globalTerm && !hasColFilters) {
        blocks.forEach((b) => {
          b.style.display = "";
        });
        return;
      }
      blocks.forEach((b) => {
        const hay = b.dataset.filterHay || b.textContent || "";
        let show = !globalTerm || contains(hay, globalTerm);
        if (show && hasColFilters) {
          const innerRows = b.querySelectorAll("tbody tr.ex-joma-row-card");
          const jomaLabel = String(b.querySelector(".ex-parvalde-picker-name")?.textContent || "").trim();
          if (innerRows.length) {
            show = Array.from(innerRows).some((tr) => {
              const hay = tr.dataset.filterHay || tr.textContent || "";
              if (globalTerm && !contains(hay, globalTerm)) return false;
              for (const col in state.processJomasHeader) {
                const terms = normalizeFilterValue(state.processJomasHeader[col]);
                if (!terms.length) continue;
                const idx = Number(col);
                let cellText = "";
                if (idx === 0) cellText = jomaLabel;
                else if (idx === 1) cellText = String(tr.children[0]?.textContent || "").trim();
                else cellText = String(tr.children[tr.children.length - 1]?.textContent || "").trim();
                if (!cellMatchesAnyTerm(cellText, terms)) return false;
              }
              return true;
            });
          } else {
            for (const col in state.processJomasHeader) {
              const terms = normalizeFilterValue(state.processJomasHeader[col]);
              if (terms.length && !cellMatchesAnyTerm(hay, terms)) {
                show = false;
                break;
              }
            }
          }
        }
        b.style.display = show ? "" : "none";
      });
      return;
    }

    const tbody = document.querySelector("#processJomasTable tbody");
    if (!tbody) return;
    if (!jomasTableUsesExecutorLayout()) {
      applyAccordionTableFilters("processJomasTable", "processJomasHeader");
      return;
    }
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (!globalTerm && !hasColFilters) {
      rows.forEach((tr) => {
        tr.style.display = "";
      });
      return;
    }

    let i = 0;
    while (i < rows.length) {
      const tr = rows[i];
      if (tr.classList.contains("ex-dept-hdr")) {
        const gpRows = [];
        i += 1;
        while (i < rows.length && !rows[i].classList.contains("ex-dept-hdr")) {
          gpRows.push(rows[i]);
          i += 1;
        }
        let deptShow = jomasRowMatches(tr, globalTerm);
        gpRows.forEach((gpTr) => {
          const gpShow = jomasRowMatches(gpTr, globalTerm);
          gpTr.style.display = gpShow ? "" : "none";
          if (gpShow) deptShow = true;
        });
        tr.style.display = deptShow ? "" : "none";
        continue;
      }
      tr.style.display = jomasRowMatches(tr, globalTerm) ? "" : "none";
      i += 1;
    }
  }

  function applyExecutorsFilters() {
    const listRoot = document.getElementById("executorsListRoot");
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const hasColFilters = Object.values(state.executorsHeader || {}).some((v) => isFilterActive(v));

    if (listRoot) {
      const blocks = Array.from(listRoot.querySelectorAll(".ex-parvalde-block"));
      if (!globalTerm && !hasColFilters) {
        blocks.forEach((b) => {
          b.style.display = "";
        });
        return;
      }
      blocks.forEach((b) => {
        const hay = b.dataset.filterHay || b.textContent || "";
        let show = !globalTerm || contains(hay, globalTerm);
        if (show && hasColFilters) {
          const innerRows = b.querySelectorAll("tbody tr.ex-exec-row-card");
          if (innerRows.length) {
            show = Array.from(innerRows).some((tr) => executorsRowMatches(tr, globalTerm));
          } else {
            for (const col in state.executorsHeader) {
              const terms = normalizeFilterValue(state.executorsHeader[col]);
              if (terms.length && !cellMatchesAnyTerm(hay, terms)) {
                show = false;
                break;
              }
            }
          }
        }
        b.style.display = show ? "" : "none";
      });
      return;
    }

    const tbody = document.querySelector("#executorsTable tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (!globalTerm && !hasColFilters) {
      rows.forEach((tr) => {
        tr.style.display = "";
      });
      return;
    }
    rows.forEach((tr) => {
      tr.style.display = executorsRowMatches(tr, globalTerm) ? "" : "none";
    });
  }

  function applyNaFilters() {
    const tbody = document.querySelector("#naTable tbody");
    if (!tbody) return;
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const naTerm = norm(document.getElementById("naSearchInput")?.value || "");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      if (tds.length === 1 && tds[0].colSpan > 1) {
        tr.style.display = "";
        return;
      }
      const hay = tds.map((td) => td.textContent || "").join(" ");
      let show = true;
      if (globalTerm && !contains(hay, globalTerm)) show = false;
      if (naTerm && !contains(hay, naTerm)) show = false;
      for (const col in state.naHeader) {
        const terms = normalizeFilterValue(state.naHeader[col]);
        if (!cellMatchesAnyTerm(tds[Number(col)]?.textContent || "", terms)) {
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
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = true;
      if (globalTerm) {
        const hay = tds.map((td) => td.textContent || "").join(" ");
        if (!contains(hay, globalTerm)) show = false;
      }
      for (const col in state[key]) {
        const terms = normalizeFilterValue(state[key][col]);
        if (!cellMatchesAnyTerm(tds[Number(col)]?.textContent || "", terms)) {
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
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const headers = rows.filter((tr) => tr.classList && tr.classList.contains("process-accordion-hdr"));
    const hasTerms = Object.values(state[key] || {}).some((v) => isFilterActive(v));
    // Bez aktīviem filtriem NEAIZTIEKAM tabulas redzamību:
    // atstājam tieši renderētās atvēršanas/aizvēršanas stāvokli.
    if (!hasTerms && !globalTerm) return;
    const cellText = (tr, col, hdr) => {
      if (!tr) return "";
      const isPart = tr.classList && tr.classList.contains("process-accordion-part");
      if (isPart && Number(col) === 0 && hdr) return String(hdr.children[0]?.textContent || "");
      return String(tr.children[Number(col)]?.textContent || "");
    };
    const rowMatches = (tr, hdr) => {
      if (globalTerm) {
        const hay = Array.from(tr.children || [])
          .map((td, col) => cellText(tr, col, hdr))
          .join(" ");
        if (!contains(hay, globalTerm)) return false;
      }
      for (const col in state[key]) {
        const terms = normalizeFilterValue(state[key][col]);
        if (!terms.length) continue;
        if (!cellMatchesAnyTerm(cellText(tr, col, hdr), terms)) return false;
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
    if (Object.values(state.processHeader || {}).some((v) => isFilterActive(v))) return true;
    if (Object.values(state.catalogHeader || {}).some((v) => isFilterActive(v))) return true;
    if (Object.values(state.tasksHeader || {}).some((v) => isFilterActive(v))) return true;
    if (Object.values(state.executorsHeader || {}).some((v) => isFilterActive(v))) return true;
    if (Object.values(state.processGroupsHeader || {}).some((v) => isFilterActive(v))) return true;
    if (Object.values(state.processJomasHeader || {}).some((v) => isFilterActive(v))) return true;
    if (Object.values(state.naHeader || {}).some((v) => isFilterActive(v))) return true;
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

  let renderReportsTimer = null;
  function scheduleRenderReports() {
    if (renderReportsTimer) clearTimeout(renderReportsTimer);
    renderReportsTimer = setTimeout(() => {
      renderReportsTimer = null;
      if (typeof window.renderReports === "function") window.renderReports();
    }, 120);
  }

  const GLOBAL_SEARCH_MAX = 35;

  function haystackIncludes(hay, term) {
    const t = norm(term);
    if (!t) return true;
    const h = norm(hay);
    const parts = t.split(/\s+/).filter(Boolean);
    if (!parts.length) return true;
    return parts.every((p) => h.includes(p));
  }

  function objectHaystackExtra(obj) {
    if (!obj || typeof obj !== "object") return "";
    try {
      return JSON.stringify(obj);
    } catch (_) {
      return "";
    }
  }

  function processRowHaystack(r) {
    if (!r) return "";
    const parts = [
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
      r.products,
      r.relatedProcesses,
      r.services,
      r.flowcharts,
      r.itResources,
      r.optimization,
      r.otherMetrics,
      r.task,
      r.taskNo,
      objectHaystackExtra(r.raw),
      objectHaystackExtra(r.gpItems),
    ];
    return parts.join(" ");
  }

  function catalogRowHaystack(r) {
    if (!r) return "";
    return [
      r.typeNo,
      r.id,
      r.type,
      r.unit,
      r.department,
      r.procNo,
      r.process,
      r.darbibasJoma,
      r.group,
      r.additionalInfo,
      objectHaystackExtra(r.raw),
    ].join(" ");
  }

  function getCatalogRowsForSearch() {
    if (typeof window.getCatalogRowsDetailed === "function") {
      const d = window.getCatalogRowsDetailed();
      if (Array.isArray(d) && d.length) return d;
    }
    if (typeof window.getCatalogRows === "function") return window.getCatalogRows() || [];
    return [];
  }

  function scrollToSectionCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.remove("hidden");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function appendGlobalSearchSection(body, title, cardId, hits, onHit) {
    if (!hits.length) return 0;
    const section = document.createElement("div");
    section.className = "gs-section";
    const h = document.createElement("h3");
    h.className = "gs-section-title";
    h.textContent = title;
    section.appendChild(h);
    const ul = document.createElement("ul");
    ul.className = "gs-hits";
    const shown = hits.slice(0, GLOBAL_SEARCH_MAX);
    shown.forEach((hit) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gs-hit-btn";
      btn.textContent = hit.label;
      btn.addEventListener("click", () => {
        scrollToSectionCard(cardId);
        if (typeof onHit === "function") onHit(hit);
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    section.appendChild(ul);
    if (hits.length > GLOBAL_SEARCH_MAX) {
      const more = document.createElement("p");
      more.className = "gs-more";
      more.textContent = `+ vēl ${hits.length - GLOBAL_SEARCH_MAX} atbilstības — precizējiet meklēšanu.`;
      section.appendChild(more);
    }
    body.appendChild(section);
    return hits.length;
  }

  function collectTaskSearchHits(term) {
    const rows =
      typeof window.getProcessRows === "function" ? window.getProcessRows() || [] : [];
    const byTask = new Map();
    rows.forEach((r) => {
      const rawTaskName = String((r && r.task) || "").trim();
      const rawTaskNo = String((r && r.taskNo) || "").trim();
      const key = `${rawTaskNo}|${rawTaskName}`;
      if (!byTask.has(key)) {
        byTask.set(key, { no: rawTaskNo, name: rawTaskName, hay: `${rawTaskNo} ${rawTaskName}` });
      }
      const x = byTask.get(key);
      x.hay += ` ${processRowHaystack(r)}`;
    });
    const out = [];
    byTask.forEach((x) => {
      if (!haystackIncludes(x.hay, term)) return;
      const label =
        (typeof window.pvPairLabel === "function" ? window.pvPairLabel(x.no, x.name) : [x.no, x.name].filter(Boolean).join(" ")) ||
        "(uzdevums)";
      out.push({ label, taskNo: x.no, taskName: x.name });
    });
    out.sort((a, b) => a.label.localeCompare(b.label, "lv", { sensitivity: "base" }));
    return out;
  }

  function collectJomaSearchHits(term) {
    const labels = new Set();
    if (window.JomaKartina && typeof window.JomaKartina.listJomaLabels === "function") {
      (window.JomaKartina.listJomaLabels() || []).forEach((j) => {
        const s = String(j || "").trim();
        if (s) labels.add(s);
      });
    }
    const cat = getCatalogRowsForSearch();
    cat.forEach((r) => {
      String((r && r.darbibasJoma) || "")
        .split(/[;,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((j) => labels.add(j));
    });
    const merged =
      typeof window.getMergedProcessRegisterRows === "function"
        ? window.getMergedProcessRegisterRows() || []
        : [];
    merged.forEach((r) => {
      String((r && r.darbibasJoma) || "")
        .split(/[;,]+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((j) => labels.add(j));
    });
    const out = [];
    labels.forEach((name) => {
      if (!haystackIncludes(name, term)) return;
      out.push({ label: name, joma: name });
    });
    out.sort((a, b) => a.label.localeCompare(b.label, "lv", { sensitivity: "base" }));
    return out;
  }

  function renderGlobalSearchResults() {
    const card = document.getElementById("globalSearchResultsCard");
    const body = document.getElementById("globalSearchResultsBody");
    const meta = document.getElementById("globalSearchResultsMeta");
    if (!card || !body) return;

    const term = norm(document.getElementById("searchInput")?.value || "");
    body.innerHTML = "";
    if (!term) {
      card.classList.add("hidden");
      if (meta) meta.textContent = "";
      return;
    }

    let total = 0;
    const merged =
      typeof window.getMergedProcessRegisterRows === "function"
        ? window.getMergedProcessRegisterRows() || []
        : typeof window.getProcessRows === "function"
          ? window.getProcessRows() || []
          : [];

    const processHits = merged
      .filter((r) => haystackIncludes(processRowHaystack(r), term))
      .map((r) => ({
        label: [r.group, r.processNo, r.process].filter(Boolean).join(" · ") || String(r.process || ""),
        procNo: String(r.processNo || "").trim(),
        process: String(r.process || "").trim(),
      }));
    processHits.sort((a, b) => a.label.localeCompare(b.label, "lv", { sensitivity: "base" }));

    const catalogRows = getCatalogRowsForSearch();
    const catalogHits = catalogRows
      .filter((r) => haystackIncludes(catalogRowHaystack(r), term))
      .map((r) => ({
        label: [r.typeNo, r.type, r.procNo, r.process].filter(Boolean).join(" · "),
        procNo: String(r.procNo || "").trim(),
        type: String(r.type || "").trim(),
        row: r,
      }))
      .filter((h) => h.label);
    catalogHits.sort((a, b) => a.label.localeCompare(b.label, "lv", { sensitivity: "base" }));

    const taskHits = collectTaskSearchHits(term);

    const executorHits = [];
    const executorSeen = new Set();
    const pushExecutorHit = (label, procNo, type) => {
      const key = norm(label);
      if (!key || executorSeen.has(key)) return;
      executorSeen.add(key);
      executorHits.push({ label, procNo: String(procNo || "").trim(), type: String(type || "").trim() });
    };
    catalogRows.forEach((r) => {
      const hay = [r.unit, r.department, r.type, r.procNo, r.process, r.darbibasJoma].join(" ");
      if (!haystackIncludes(hay, term)) return;
      pushExecutorHit(
        [r.unit, r.department, r.type, r.procNo, r.process].filter(Boolean).join(" → "),
        r.procNo,
        r.type
      );
    });
    const rawProcess =
      typeof window.getProcessRows === "function" ? window.getProcessRows() || [] : [];
    rawProcess.forEach((r) => {
      const hay = [r.executorPatstaviga, r.executorDala, processRowHaystack(r)].join(" ");
      if (!haystackIncludes(hay, term)) return;
      pushExecutorHit(
        [r.executorPatstaviga, r.executorDala, r.processNo, r.process].filter(Boolean).join(" → "),
        r.processNo,
        r.productsText || r.products
      );
    });
    executorHits.sort((a, b) => a.label.localeCompare(b.label, "lv", { sensitivity: "base" }));

    const groupSet = new Map();
    merged.forEach((r) => {
      const g = String(r.group || "").trim();
      const p = String(r.process || "").trim();
      const hay = `${g} ${p} ${r.processNo || ""}`;
      if (!haystackIncludes(hay, term)) return;
      const key = `${g}|${p}`.toLowerCase();
      if (!groupSet.has(key)) groupSet.set(key, { label: [g, p].filter(Boolean).join(" · "), group: g, process: p });
    });
    const groupHits = Array.from(groupSet.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "lv", { sensitivity: "base" })
    );

    const jomaHits = collectJomaSearchHits(term);

    const naHits = [];
    const acts =
      window.NormAkti && typeof window.NormAkti.loadActs === "function" ? window.NormAkti.loadActs() || [] : [];
    acts.forEach((a) => {
      const hay = [
        a.nosaukums,
        a.veids,
        a.numurs,
        a.pantsPunkts,
        a.joma,
        a.process,
        a.processNo,
        a.gp,
        a.gpTypeNo,
      ].join(" ");
      if (!haystackIncludes(hay, term)) return;
      naHits.push({
        label: [a.veids, a.nosaukums, a.numurs].filter(Boolean).join(" · "),
        act: a,
      });
    });
    naHits.sort((a, b) => a.label.localeCompare(b.label, "lv", { sensitivity: "base" }));

    total += appendGlobalSearchSection(body, "Procesu reģistrs", "processListCard", processHits, (hit) => {
      if (typeof window.openProcessEditorByProcNoOrName === "function") {
        window.openProcessEditorByProcNoOrName(hit.procNo, hit.process);
      }
    });
    total += appendGlobalSearchSection(body, "Galaproduktu katalogs", "catalogListCard", catalogHits, (hit) => {
      if (typeof window.openCatalogByProcessGp === "function") {
        window.openCatalogByProcessGp(hit.procNo, hit.type);
      }
    });
    total += appendGlobalSearchSection(body, "Uzdevumi", "tasksViewCard", taskHits, () => {});
    total += appendGlobalSearchSection(body, "Izpildītāji", "executorsCard", executorHits, (hit) => {
      if (typeof window.openCatalogByProcessGp === "function") {
        window.openCatalogByProcessGp(hit.procNo, hit.type);
      }
    });
    total += appendGlobalSearchSection(body, "Grupu statistika", "reportsCard", groupHits, () => {
      const navBtn = document.querySelector('.side-nav-jump[data-scroll-target="reportsCard"]');
      if (navBtn) navBtn.click();
      const openGroup = () => {
        if (typeof window.openStatsSection === "function") window.openStatsSection("group");
      };
      setTimeout(openGroup, 120);
      setTimeout(openGroup, 400);
    });
    total += appendGlobalSearchSection(body, "Galaprodukta jomas", "processJomasCard", jomaHits, (hit) => {
      if (typeof window.openJomaEditor === "function") window.openJomaEditor(hit.joma);
    });
    total += appendGlobalSearchSection(body, "Normatīvie akti", "normActsCard", naHits, (hit) => {
      if (window.NormAkti && typeof window.NormAkti.openEditor === "function") {
        window.NormAkti.openEditor(hit.act);
      }
    });

    if (meta) {
      meta.textContent = total
        ? `${total} atbilstība(s) visās sadaļās`
        : "Nav atbilstību — mēģiniet citu atslēgvārdu.";
    }
    card.classList.remove("hidden");
  }

  function applyAllFilters() {
    applyProcessFilters();
    applyCatalogFilters();
    applyTasksFilters();
    applyExecutorsFilters();
    applyAccordionTableFilters("processGroupsTable", "processGroupsHeader");
    applyJomasFilters();
    applyNaFilters();
    autoOpenOnFilteredResult();
    refreshClearFilterButtonActive();
    scheduleRenderReports();
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    if (globalTerm) renderGlobalSearchResults();
  }

  function autoOpenOnFilteredResult() {
    const globalTerm = norm(document.getElementById("searchInput")?.value || "");
    const processTable = document.getElementById("processTable");
    const catalogTable = document.getElementById("catalogTable");
    const processHasFilter =
      globalTerm || Object.values(state.processHeader || {}).some((v) => isFilterActive(v));
    const catalogHasFilter =
      globalTerm || Object.values(state.catalogHeader || {}).some((v) => isFilterActive(v));

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
    const tasksHasFilter =
      globalTerm || Object.values(state.tasksHeader || {}).some((v) => isFilterActive(v));
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
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const lists = Array.from(table.querySelectorAll(".th-filter-checklist[data-col-index]"));
    lists.forEach((list) => {
      const col = Number(list.dataset.colIndex);
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
      if (tableId === "processJomasTable" && jomasTableUsesCardLayout()) {
        if (col === 0) {
          const root = document.getElementById("jomasListRoot");
          if (root) {
            root.querySelectorAll(".ex-parvalde-picker-name").forEach((el) => {
              const raw = String(el.textContent || "").trim();
              if (raw) uniqVals.add(raw);
            });
          }
        } else {
          Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
            const raw = String(tr.children[col]?.textContent || "").trim();
            if (raw) uniqVals.add(raw);
          });
        }
      } else if (tableId === "processJomasTable" && jomasTableUsesExecutorLayout()) {
        if (col === 0) {
          Array.from(tbody.querySelectorAll("tr.ex-dept-hdr")).forEach((tr) => {
            const raw = String(tr.children[0]?.textContent || "")
              .replace(/^[▾▸]\s*/u, "")
              .trim();
            if (raw) uniqVals.add(raw);
          });
        } else {
          Array.from(tbody.querySelectorAll("tr.ex-gp-hdr, tr.ex-dept-hdr")).forEach((tr) => {
            const raw = jomaRowFilterText(tr, col);
            if (raw) uniqVals.add(raw);
          });
        }
      } else if (tableId === "processJomasTable" || tableId === "processGroupsTable") {
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
      populateFilterChecklist(list, uniqVals, selected);
      const btn = list.closest("th")?.querySelector(".th-filter-btn");
      if (btn) btn.classList.toggle("active", isFilterActive(selected));
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
    state.naHeader = {};

    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    document.querySelectorAll(".th-filter-checklist[data-col-index]").forEach((list) => {
      clearChecklistSelection(list);
    });
    document.querySelectorAll(".th-filter-btn.active").forEach((b) => b.classList.remove("active"));
    if (typeof window.clearStatsFilters === "function") window.clearStatsFilters();

    rerender();
    if (typeof renderGlobalSearchResults === "function") renderGlobalSearchResults();
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
      refreshHeaderFilterOptions("processJomasTable", "processJomasHeader");
      refreshHeaderFilterOptions("naTable", "naHeader");
      applyAllFilters();
      applyAllTableColumnSizing();
    };
  }

  function syncExecutorsColumnFilters(refreshOptions) {
    const execTable = document.getElementById("executorsTable");
    if (!execTable) return;
    const execHead = execTable.querySelector("thead tr");
    const execHasFilters = !!(execHead && execHead.querySelector(".th-filter-checklist[data-col-index]"));
    if (execHead && !execHasFilters) execHead.dataset.filtersReady = "";
    ensureHeaderFilters("executorsTable", "executorsHeader", false);
    if (refreshOptions) refreshHeaderFilterOptions("executorsTable", "executorsHeader");
    applyExecutorsFilters();
  }

  function scheduleExecutorsColumnFilters() {
    syncExecutorsColumnFilters(true);
    refreshClearFilterButtonActive();
  }

  function refreshExtraTableFilters() {
    if (extraRefreshRunning) return;
    extraRefreshRunning = true;
    try {
      ensureHeaderFilters("tasksSummaryTable", "tasksHeader", true);
      refreshHeaderFilterOptions("tasksSummaryTable", "tasksHeader");
      syncExecutorsColumnFilters(false);
      ensureHeaderFilters("processJomasTable", "processJomasHeader", true);
      refreshHeaderFilterOptions("processJomasTable", "processJomasHeader");
      ensureHeaderFilters("naTable", "naHeader", true);
      refreshHeaderFilterOptions("naTable", "naHeader");
      applyTasksFilters();
      applyJomasFilters();
      applyNaFilters();
      applyAllTableColumnSizing();
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
    ensureHeaderFilters("processJomasTable", "processJomasHeader", true);
    ensureHeaderFilters("naTable", "naHeader", true);
    refreshHeaderFilterOptions("processTable", "processHeader");
    refreshHeaderFilterOptions("catalogTable", "catalogHeader");
    refreshHeaderFilterOptions("tasksSummaryTable", "tasksHeader");
    refreshHeaderFilterOptions("processGroupsTable", "processGroupsHeader");
    refreshHeaderFilterOptions("processJomasTable", "processJomasHeader");
    refreshHeaderFilterOptions("naTable", "naHeader");
    setupRenderHook();
    applyAllFilters();
    applyAllTableColumnSizing();
    window.removeAllFilters = clearAllFilters;
    window.refreshClearFilterButtonActive = refreshClearFilterButtonActive;
    window.refreshExtraTableFilters = refreshExtraTableFilters;
    window.syncExecutorsColumnFilters = syncExecutorsColumnFilters;
    window.scheduleExecutorsColumnFilters = scheduleExecutorsColumnFilters;
    window.applyExecutorsFilters = applyExecutorsFilters;
    window.applyJomasFilters = applyJomasFilters;
    window.applyAllFilters = applyAllFilters;
    window.renderGlobalSearchResults = renderGlobalSearchResults;
    window.applyTableColumnSizing = applyTableColumnSizing;
    window.applyAllTableColumnSizing = applyAllTableColumnSizing;
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
        const hasLists = table.querySelector("thead tr .th-filter-checklist[data-col-index]");
        if (hasLists) {
          clearInterval(execTimer);
          return;
        }
      }
      ensureHeaderFilters("executorsTable", "executorsHeader", false);
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
