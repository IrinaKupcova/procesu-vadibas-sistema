(function () {
  "use strict";

  const state = {
    quick: { process: "", task: "", owner: "", output: "" },
    processHeader: {},
    catalogHeader: {}
  };

  function norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function contains(text, term) {
    if (!term) return true;
    return norm(text).includes(norm(term));
  }

  function injectFilterStyles() {
    if (document.getElementById("filtersCss")) return;
    const s = document.createElement("style");
    s.id = "filtersCss";
    s.textContent = `
      .main-filter-wrap{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
      .main-filter-wrap select,.main-filter-wrap input{font-size:12px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:4px}
      .th-filter-wrap{display:flex;align-items:center;gap:4px;justify-content:space-between}
      .th-filter-btn{font-size:10px;padding:2px 5px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;cursor:pointer;line-height:1}
      .th-filter-btn.active{background:#2563eb;color:#fff;border-color:#2563eb}
      .th-filter-box{display:none;margin-top:4px}
      .th-filter-box.open{display:block}
      .th-filter-box select{width:100%;font-size:11px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#fff}
    `;
    document.head.appendChild(s);
  }

  function ensureQuickFilters() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput) return;
    // Galvenais filtrs ir pārvaldīts Procesu_registrs.js pusē.
    // Te neatstājam otru (dublējošu) filtra UI.
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
        selectBestLevel();
        applyAllFilters();
      };
      select.addEventListener("change", (e) => onFilterChange(e.target.value));

      btn.addEventListener("click", () => {
        box.classList.toggle("open");
        if (box.classList.contains("open")) select.focus();
      });

      box.appendChild(select);
      wrap.appendChild(label);
      wrap.appendChild(btn);
      th.appendChild(wrap);
      th.appendChild(box);
    });

    headRow.dataset.filtersReady = "1";
  }

  function selectBestLevel() {
    const level = document.getElementById("levelSelect");
    if (!level) return;

    const hasOutput = norm(state.quick.output) !== "" || Object.keys(state.processHeader).some((k) => Number(k) >= 9 && norm(state.processHeader[k]) !== "");
    const hasMain = norm(state.quick.process) !== "" || norm(state.quick.task) !== "" || norm(state.quick.owner) !== "";

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
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      const taskText = `${tds[1]?.textContent || ""} ${tds[2]?.textContent || ""}`;
      const processText = `${tds[3]?.textContent || ""} ${tds[4]?.textContent || ""}`;
      const ownerText = tds[5]?.textContent || "";
      const outputText = tds[8]?.textContent || "";

      let show =
        contains(processText, state.quick.process) &&
        contains(taskText, state.quick.task) &&
        contains(ownerText, state.quick.owner) &&
        contains(outputText, state.quick.output);

      if (show) {
        for (const col in state.processHeader) {
          const term = state.processHeader[col];
          if (!contains(tds[Number(col)]?.textContent || "", term)) {
            show = false;
            break;
          }
        }
      }

      tr.style.display = show ? "" : "none";
    });
  }

  function applyCatalogFilters() {
    const tbody = document.querySelector("#catalogTable tbody");
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll("tr"));
    rows.forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = true;
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

  function hasActiveFilters() {
    const searchInput = document.getElementById("searchInput");
    if (searchInput && norm(searchInput.value) !== "") return true;
    if (Object.values(state.processHeader || {}).some((v) => norm(v) !== "")) return true;
    if (Object.values(state.catalogHeader || {}).some((v) => norm(v) !== "")) return true;
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
    autoOpenOnFilteredResult();
    refreshClearFilterButtonActive();
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
  }

  function refreshHeaderFilterOptions(tableId, key) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    const selects = Array.from(table.querySelectorAll(".th-filter-box select[data-col-index]"));
    selects.forEach((select) => {
      const col = Number(select.dataset.colIndex);
      const selected = state[key][String(col)] || "";
      const uniqVals = new Set();
      Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
        const v = String(tr.children[col]?.textContent || "").trim();
        if (v) uniqVals.add(v);
      });
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
  }

  function rerender() {
    if (typeof window.renderTable === "function") window.renderTable();
    applyAllFilters();
  }

  function clearAllFilters() {
    state.quick = { process: "", task: "", owner: "", output: "" };
    state.processHeader = {};
    state.catalogHeader = {};

    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.value = "";

    document.querySelectorAll(".th-filter-box select[data-col-index]").forEach((s) => {
      s.value = "";
    });
    document.querySelectorAll(".th-filter-btn.active").forEach((b) => b.classList.remove("active"));

    rerender();
    refreshClearFilterButtonActive();
  }

  function setupRenderHook() {
    // index.html renderTable ir lokāla funkcija; drošāk ir dot publisku pēcrendera callback.
    window.__afterTableRenderFilters = function () {
      refreshHeaderFilterOptions("processTable", "processHeader");
      refreshHeaderFilterOptions("catalogTable", "catalogHeader");
      applyAllFilters();
    };
  }

  function init() {
    injectFilterStyles();
    ensureQuickFilters();
    ensureHeaderFilters("processTable", "processHeader", true);
    ensureHeaderFilters("catalogTable", "catalogHeader", false);
    refreshHeaderFilterOptions("processTable", "processHeader");
    refreshHeaderFilterOptions("catalogTable", "catalogHeader");
    setupRenderHook();
    applyAllFilters();
    window.removeAllFilters = clearAllFilters;
    window.refreshClearFilterButtonActive = refreshClearFilterButtonActive;
    const clearBtn = document.getElementById("clearFiltersBtn");
    if (clearBtn) clearBtn.addEventListener("click", clearAllFilters);
    const searchInput = document.getElementById("searchInput");
    if (searchInput) searchInput.addEventListener("input", refreshClearFilterButtonActive);
    refreshClearFilterButtonActive();
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
