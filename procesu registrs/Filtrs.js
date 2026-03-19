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
      .th-filter-box input{width:100%;font-size:11px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px}
    `;
    document.head.appendChild(s);
  }

  function ensureQuickFilters() {
    const searchInput = document.getElementById("searchInput");
    if (!searchInput || document.getElementById("mainFilterField")) return;

    const host = searchInput.parentElement;
    if (!host) return;

    const wrap = document.createElement("div");
    wrap.className = "main-filter-wrap";
    wrap.id = "mainFilterWrap";

    const field = document.createElement("select");
    field.id = "mainFilterField";
    field.innerHTML = [
      '<option value="process">Process</option>',
      '<option value="task">Uzdevums</option>',
      '<option value="owner">Izpildītājs</option>',
      '<option value="output">Galaprodukta veids</option>'
    ].join("");

    const input = document.createElement("input");
    input.id = "mainFilterValue";
    input.placeholder = "Filtrēšanas vērtība...";
    input.style.minWidth = "220px";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "secondary";
    clearBtn.textContent = "Notīrīt filtru";

    wrap.appendChild(field);
    wrap.appendChild(input);
    wrap.appendChild(clearBtn);
    host.appendChild(wrap);

    const syncMain = () => {
      state.quick.process = "";
      state.quick.task = "";
      state.quick.owner = "";
      state.quick.output = "";
      state.quick[field.value] = input.value;
      selectBestLevel();
      rerender();
    };

    field.addEventListener("change", syncMain);
    input.addEventListener("input", syncMain);
    clearBtn.addEventListener("click", () => {
      input.value = "";
      syncMain();
    });
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

      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Filtrēt...";
      input.dataset.colIndex = String(idx);

      input.addEventListener("input", (e) => {
        const col = e.target.dataset.colIndex;
        state[key][col] = e.target.value;
        btn.classList.toggle("active", norm(e.target.value) !== "");
        selectBestLevel();
        applyAllFilters();
      });

      btn.addEventListener("click", () => {
        box.classList.toggle("open");
        if (box.classList.contains("open")) input.focus();
      });

      box.appendChild(input);
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
    injectFilterStyles();
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
