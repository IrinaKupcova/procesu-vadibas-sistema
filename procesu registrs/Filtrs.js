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

  function ensureQuickFilters() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput || document.getElementById("filterProcess")) return;

    const host = searchInput.parentElement;
    if (!host) return;

    const mk = (id, placeholder) => {
      const el = document.createElement("input");
      el.id = id;
      el.placeholder = placeholder;
      el.className = "secondary";
      el.style.minWidth = "170px";
      el.style.maxWidth = "220px";
      return el;
    };

    const processEl = mk("filterProcess", "Filtrs: process");
    const taskEl = mk("filterTask", "Filtrs: uzdevums");
    const ownerEl = mk("filterOwner", "Filtrs: izpildītājs");
    const outputEl = mk("filterOutput", "Filtrs: galaprodukta veids");

    host.appendChild(processEl);
    host.appendChild(taskEl);
    host.appendChild(ownerEl);
    host.appendChild(outputEl);

    processEl.addEventListener("input", () => {
      state.quick.process = processEl.value;
      selectBestLevel();
      rerender();
    });
    taskEl.addEventListener("input", () => {
      state.quick.task = taskEl.value;
      selectBestLevel();
      rerender();
    });
    ownerEl.addEventListener("input", () => {
      state.quick.owner = ownerEl.value;
      selectBestLevel();
      rerender();
    });
    outputEl.addEventListener("input", () => {
      state.quick.output = outputEl.value;
      selectBestLevel();
      rerender();
    });
  }

  function ensureHeaderFilters(tableId, key, skipLast) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const headRow = table.querySelector("thead tr");
    if (!headRow) return;
    if (table.querySelector("thead tr.header-filter-row")) return;

    const sourceHeaders = Array.from(headRow.children);
    const filterRow = document.createElement("tr");
    filterRow.className = "header-filter-row";

    sourceHeaders.forEach((th, idx) => {
      const fth = document.createElement("th");
      const isLast = idx === sourceHeaders.length - 1;
      if (skipLast && isLast) {
        fth.textContent = "";
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Filtrēt...";
        input.style.width = "100%";
        input.style.fontSize = "11px";
        input.style.padding = "4px 6px";
        input.dataset.colIndex = String(idx);
        input.addEventListener("input", (e) => {
          const col = e.target.dataset.colIndex;
          state[key][col] = e.target.value;
          selectBestLevel();
          applyAllFilters();
        });
        fth.appendChild(input);
      }
      filterRow.appendChild(fth);
    });
    table.querySelector("thead").appendChild(filterRow);
  }

  function selectBestLevel() {
    const level = document.getElementById("levelSelect");
    if (!level) return;

    const hasOutput = norm(state.quick.output) !== "" || Object.keys(state.processHeader).some((k) => Number(k) >= 13 && norm(state.processHeader[k]) !== "");
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
      const outputText = tds[13]?.textContent || "";

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

  function applyAllFilters() {
    applyProcessFilters();
    applyCatalogFilters();
  }

  function rerender() {
    if (typeof window.renderTable === "function") window.renderTable();
    applyAllFilters();
  }

  function setupRenderHook() {
    if (typeof window.renderTable !== "function" || window.__filterHooked) return;
    const original = window.renderTable;
    window.renderTable = function () {
      original();
      applyAllFilters();
    };
    window.__filterHooked = true;
  }

  function init() {
    ensureQuickFilters();
    ensureHeaderFilters("processTable", "processHeader", true);
    ensureHeaderFilters("catalogTable", "catalogHeader", false);
    setupRenderHook();
    applyAllFilters();
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
