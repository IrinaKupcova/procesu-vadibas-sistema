(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function uniq(vals) {
    return Array.from(new Set(vals.map((v) => String(v || "").trim()).filter(Boolean)));
  }
  function fmtPair(no, name) {
    const n = String(no || "").trim();
    const t = String(name || "").trim();
    if (n && t) return `${n} — ${t}`;
    return n || t || "";
  }

  function moveControlsToRegistry() {
    const row = $("searchInput") ? $("searchInput").parentElement : null;
    const processRight = $("processListCard") ? $("processListCard").querySelector(".toolbar .right") : null;
    if (!row || !processRight) return;

    const levelSelect = $("levelSelect");
    const levelLabel = levelSelect ? levelSelect.closest("label") : null;
    if (levelLabel && !processRight.contains(levelLabel)) processRight.prepend(levelLabel);

    const newBtn = $("newBtn");
    if (newBtn && !processRight.contains(newBtn)) processRight.appendChild(newBtn);
  }

  function getFieldText(tr, mode) {
    const tds = Array.from(tr.children);
    if (mode === "task") return `${tds[1]?.textContent || ""} ${tds[2]?.textContent || ""}`;
    if (mode === "owner") return `${tds[5]?.textContent || ""}`;
    if (mode === "output") return `${tds[8]?.textContent || ""}`;
    return `${tds[3]?.textContent || ""} ${tds[4]?.textContent || ""}`;
  }

  function applyMainSearchByView() {
    const table = $("processTable");
    const input = $("searchInput");
    const select = $("viewFilterSelect");
    if (!table || !input || !select) return;

    const q = String(input.value || "").trim().toLowerCase();
    if (!q) return; // netraucē citiem filtriem, ja galvenais filtrs tukšs
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    rows.forEach((tr) => {
      if (!q) {
        if (tr.style.display === "none") tr.style.display = "";
        return;
      }
      const text = getFieldText(tr, select.value).toLowerCase();
      tr.style.display = text.includes(q) ? "" : "none";
    });
  }

  function ensureExtraViewsUi() {
    if ($("extraViewsCard")) return;
    const processCard = $("processListCard");
    if (!processCard || !processCard.parentElement) return;

    const card = document.createElement("div");
    card.className = "card";
    card.id = "extraViewsCard";
    card.innerHTML = `
      <div class="toolbar">
        <div class="left">
          <label style="margin-left:0;font-size:18px;font-weight:700;color:#0f172a">Skata izvēle
            <select id="extraViewSelect">
              <option value="owners" selected>Izpildītāji</option>
              <option value="tasks">Uzdevumi</option>
            </select>
          </label>
        </div>
      </div>
      <div id="tasksViewWrap" class="hidden">
        <table id="tasksViewTable"><thead><tr><th>Uzdevums (Nr. un nosaukums)</th><th>Procesi (Nr. un nosaukumi)</th><th>Izpildītāji</th></tr></thead><tbody></tbody></table>
      </div>
      <div id="ownersViewWrap">
        <table id="ownersViewTable"><thead><tr><th>Izpildītājs</th><th>Uzdevumi (Nr. un nosaukumi)</th><th>Procesi (Nr. un nosaukumi)</th><th>GP veidi</th></tr></thead><tbody></tbody></table>
      </div>
    `;
    const catalogEditorCard = $("catalogEditorCard");
    if (catalogEditorCard && catalogEditorCard.parentElement) {
      catalogEditorCard.parentElement.insertBefore(card, catalogEditorCard.nextSibling);
    } else {
      processCard.parentElement.appendChild(card);
    }

    $("extraViewSelect").addEventListener("change", () => {
      const v = $("extraViewSelect").value;
      $("tasksViewWrap").classList.toggle("hidden", v !== "tasks");
      $("ownersViewWrap").classList.toggle("hidden", v !== "owners");
    });
  }

  function renderTasksView(rows) {
    const tb = $("tasksViewTable") ? $("tasksViewTable").querySelector("tbody") : null;
    if (!tb) return;
    const catalogRows = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    const byTask = new Map();
    rows.forEach((r) => {
      const k = fmtPair(r.taskNo, r.task);
      if (!k) return;
      if (!byTask.has(k)) byTask.set(k, { processes: [], executors: [] });
      const x = byTask.get(k);
      x.processes.push(fmtPair(r.processNo, r.process));
      const rowKey = `${String(r.taskNo || "").trim()}|${String(r.processNo || "").trim()}`;
      catalogRows.forEach((c) => {
        const ck = `${String(c.taskNo || "").trim()}|${String(c.procNo || "").trim()}`;
        if (ck === rowKey) {
          const ex = String(c.unit || "").trim();
          if (ex) x.executors.push(ex);
        }
      });
    });
    tb.innerHTML = "";
    Array.from(byTask.keys()).sort().forEach((task) => {
      const data = byTask.get(task);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${task}</td><td>${uniq(data.processes).join("; ")}</td><td>${uniq(data.executors).join("; ")}</td>`;
      tb.appendChild(tr);
    });
  }

  function renderOwnersView(rows) {
    const tb = $("ownersViewTable") ? $("ownersViewTable").querySelector("tbody") : null;
    if (!tb) return;
    const catalogRows = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    const processIndex = new Map();
    rows.forEach((r) => {
      const key = `${String(r.taskNo || "").trim()}|${String(r.processNo || "").trim()}`;
      processIndex.set(key, r);
    });

    const byOwner = new Map();
    catalogRows.forEach((c) => {
      const owner = String(c.unit || "").trim(); // Izpildītājs no GP kataloga
      if (!owner) return;
      const key = `${String(c.taskNo || "").trim()}|${String(c.procNo || "").trim()}`;
      const p = processIndex.get(key);
      if (!byOwner.has(owner)) byOwner.set(owner, { tasks: [], processes: [], outputs: [] });
      const x = byOwner.get(owner);
      x.tasks.push((p && fmtPair(p.taskNo, p.task)) || String(c.taskNo || "").trim());
      x.processes.push((p && fmtPair(p.processNo, p.process)) || String(c.procNo || "").trim());
      x.outputs.push(c.type || "");
    });

    tb.innerHTML = "";
    Array.from(byOwner.keys()).sort().forEach((owner) => {
      const data = byOwner.get(owner);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${owner}</td><td>${uniq(data.tasks).join("; ")}</td><td>${uniq(data.processes).join("; ")}</td><td>${uniq(data.outputs).join("; ")}</td>`;
      tb.appendChild(tr);
    });
  }

  function renderExtraViews() {
    const rows = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    renderTasksView(rows);
    renderOwnersView(rows);
  }

  function setup() {
    moveControlsToRegistry();
    ensureExtraViewsUi();

    const searchInput = $("searchInput");
    const viewSelect = $("viewFilterSelect");
    if (searchInput) searchInput.addEventListener("input", applyMainSearchByView);
    if (viewSelect) viewSelect.addEventListener("change", applyMainSearchByView);

    const originalRender = window.renderTable;
    if (typeof originalRender === "function" && !window.__procRegHooked) {
      window.renderTable = function () {
        originalRender();
        applyMainSearchByView();
        renderExtraViews();
      };
      window.__procRegHooked = true;
    }

    window.renderExtraViews = renderExtraViews;
    renderExtraViews();
  }

  function boot() {
    if (!$("processListCard") || typeof window.renderTable !== "function") {
      setTimeout(boot, 200);
      return;
    }
    setup();
  }

  boot();
})();

