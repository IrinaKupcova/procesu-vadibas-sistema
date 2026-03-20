(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  function uniq(vals) {
    return Array.from(new Set(vals.map((v) => String(v || "").trim()).filter(Boolean)));
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

  function ensureViewSelector() {
    const row = $("searchInput") ? $("searchInput").parentElement : null;
    if (!row || $("viewFilterSelect")) return;

    const wrap = document.createElement("label");
    wrap.textContent = "Skata izvēle";
    const select = document.createElement("select");
    select.id = "viewFilterSelect";
    select.innerHTML = [
      '<option value="process">Process</option>',
      '<option value="task">Uzdevums</option>',
      '<option value="owner">Izpildītājs</option>',
      '<option value="output">Galaprodukta (GP) veids</option>'
    ].join("");
    wrap.appendChild(select);

    row.insertBefore(wrap, $("searchInput"));
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
          <strong>Skatu zona</strong>
          <label style="margin-left:8px">Skata izvēle
            <select id="extraViewSelect">
              <option value="tasks">Uzdevumi</option>
              <option value="owners">Izpildītāji</option>
              <option value="output">Galaproduktu (GP) veidi</option>
            </select>
          </label>
        </div>
      </div>
      <div id="tasksViewWrap">
        <table id="tasksViewTable"><thead><tr><th>Uzdevums</th><th>Saistītie procesi</th><th>Izpildītāji</th></tr></thead><tbody></tbody></table>
      </div>
      <div id="ownersViewWrap" class="hidden">
        <table id="ownersViewTable"><thead><tr><th>Izpildītājs</th><th>Saistītie uzdevumi</th><th>Saistītie procesi</th><th>GP veidi</th></tr></thead><tbody></tbody></table>
      </div>
      <div id="outputViewWrap" class="hidden">
        <table id="outputViewTable"><thead><tr><th>GP veids</th><th>Saistītie uzdevumi</th><th>Saistītie procesi</th><th>Izpildītāji</th></tr></thead><tbody></tbody></table>
      </div>
    `;
    processCard.parentElement.insertBefore(card, $("catalogListCard"));

    $("extraViewSelect").addEventListener("change", () => {
      const v = $("extraViewSelect").value;
      $("tasksViewWrap").classList.toggle("hidden", v !== "tasks");
      $("ownersViewWrap").classList.toggle("hidden", v !== "owners");
      $("outputViewWrap").classList.toggle("hidden", v !== "output");
    });
  }

  function renderTasksView(rows) {
    const tb = $("tasksViewTable") ? $("tasksViewTable").querySelector("tbody") : null;
    if (!tb) return;
    const byTask = new Map();
    rows.forEach((r) => {
      const k = String(r.task || r.taskNo || "").trim();
      if (!k) return;
      if (!byTask.has(k)) byTask.set(k, { processes: [], owners: [] });
      const x = byTask.get(k);
      x.processes.push(r.process || r.processNo || "");
      x.owners.push(r.owner || "");
    });
    tb.innerHTML = "";
    Array.from(byTask.keys()).sort().forEach((task) => {
      const data = byTask.get(task);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${task}</td><td>${uniq(data.processes).join("; ")}</td><td>${uniq(data.owners).join("; ")}</td>`;
      tb.appendChild(tr);
    });
  }

  function renderOwnersView(rows) {
    const tb = $("ownersViewTable") ? $("ownersViewTable").querySelector("tbody") : null;
    if (!tb) return;
    const byOwner = new Map();
    rows.forEach((r) => {
      const k = String(r.owner || "").trim();
      if (!k) return;
      if (!byOwner.has(k)) byOwner.set(k, { tasks: [], processes: [], outputs: [] });
      const x = byOwner.get(k);
      x.tasks.push(r.task || r.taskNo || "");
      x.processes.push(r.process || r.processNo || "");
      x.outputs.push(r.productTypes || "");
    });
    tb.innerHTML = "";
    Array.from(byOwner.keys()).sort().forEach((owner) => {
      const data = byOwner.get(owner);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${owner}</td><td>${uniq(data.tasks).join("; ")}</td><td>${uniq(data.processes).join("; ")}</td><td>${uniq(data.outputs).join("; ")}</td>`;
      tb.appendChild(tr);
    });
  }

  function renderOutputView(rows) {
    const tb = $("outputViewTable") ? $("outputViewTable").querySelector("tbody") : null;
    if (!tb) return;
    const byOutput = new Map();
    rows.forEach((r) => {
      const outputs = String(r.productTypes || "")
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      outputs.forEach((gp) => {
        if (!byOutput.has(gp)) byOutput.set(gp, { tasks: [], processes: [], owners: [] });
        const x = byOutput.get(gp);
        x.tasks.push(r.task || r.taskNo || "");
        x.processes.push(r.process || r.processNo || "");
        x.owners.push(r.owner || "");
      });
    });
    tb.innerHTML = "";
    Array.from(byOutput.keys()).sort().forEach((gp) => {
      const data = byOutput.get(gp);
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${gp}</td><td>${uniq(data.tasks).join("; ")}</td><td>${uniq(data.processes).join("; ")}</td><td>${uniq(data.owners).join("; ")}</td>`;
      tb.appendChild(tr);
    });
  }

  function renderExtraViews() {
    const rows = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    renderTasksView(rows);
    renderOwnersView(rows);
    renderOutputView(rows);
  }

  function setup() {
    moveControlsToRegistry();
    ensureViewSelector();
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

