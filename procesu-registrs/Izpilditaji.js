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
      table.style.minWidth = "1200px";
      table.style.borderCollapse = "collapse";
      table.innerHTML = `
        <thead>
          <tr>
            <th>Procesa izpildītājs, pārvalde</th>
            <th>Procesa izpildītājs, daļa</th>
            <th>Process</th>
            <th>Procesa kartiņa</th>
            <th>Procesa galaprodukts (GP)</th>
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

  function splitValues(v) {
    return String(v || "")
      .split(/[;,\n]/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function computeRows(processRows, catalogRows) {
    const rows = [];
    const byProcNo = new Map();
    (catalogRows || []).forEach((c) => {
      const pn = getText(c.procNo);
      if (!pn) return;
      if (!byProcNo.has(pn)) byProcNo.set(pn, []);
      byProcNo.get(pn).push(c);
    });
    for (const p of processRows) {
      const procNo = getText(p.processNo);
      if (!procNo) continue;
      const proc = getText(p.process);
      const linked = byProcNo.get(procNo) || [];
      const unitsFromProcess = splitValues(p.executorPatstaviga);
      const departmentsFromProcess = splitValues(p.executorDala);
      const unitsFromCatalog = Array.from(new Set(linked.map((c) => getText(c.unit)).filter(Boolean)));
      const departmentsFromCatalog = Array.from(new Set(linked.map((c) => getText(c.department)).filter(Boolean)));
      const units = Array.from(new Set([].concat(unitsFromProcess, unitsFromCatalog))).filter(Boolean);
      const departments = Array.from(new Set([].concat(departmentsFromProcess, departmentsFromCatalog))).filter(Boolean);
      const normalizedUnits = units.length ? units : [""];
      const departmentText = departments.join(", ");
      const gpFromProc = splitValues(p.products);
      normalizedUnits.forEach((unit) => {
        const gpSet = new Set();
        linked.forEach((c) => {
          const cUnit = getText(c.unit);
          if (!cUnit || !unit || cUnit.toLowerCase() === unit.toLowerCase()) {
            const t = getText(c.type);
            if (t) gpSet.add(t);
          }
        });
        gpFromProc.forEach((t) => gpSet.add(t));
        rows.push({
          executor: unit,
          department: departmentText,
          procNo,
          proc,
          gpList: Array.from(gpSet),
        });
      });
    }
    return rows.sort((a, b) => `${a.executor} ${a.department} ${a.procNo} ${a.proc}`.localeCompare(`${b.executor} ${b.department} ${b.procNo} ${b.proc}`, "lv"));
  }

  function renderExecutorsView() {
    const card = document.getElementById("executorsCard");
    if (!card) return;

    const table = ensureTable(card);
    if (!table) return;

    const tb = document.getElementById(ROWS_ID);
    if (!tb) return;

    const p = typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
    const c = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];

    const rows = computeRows(p, c);

    tb.innerHTML = "";
    for (const r of rows) {
      const tr = document.createElement("tr");
      const td = (txt) => {
        const el = document.createElement("td");
        el.textContent = txt == null ? "" : String(txt);
        return el;
      };
      tr.appendChild(td(r.executor || ""));
      tr.appendChild(td(r.department || ""));
      tr.appendChild(td([r.procNo, r.proc].filter(Boolean).join(" - ")));

      const tdBtn = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = "Atvērt kartiņu";
      btn.addEventListener("click", () => {
        if (typeof window.openProcessEditorByTaskProcNos === "function") {
          window.openProcessEditorByTaskProcNos("", r.procNo);
        }
      });
      tdBtn.appendChild(btn);
      tr.appendChild(tdBtn);

      const tdGp = document.createElement("td");
      if (Array.isArray(r.gpList) && r.gpList.length) {
        r.gpList.forEach((gp) => {
          const line = document.createElement("div");
          line.style.display = "flex";
          line.style.alignItems = "center";
          line.style.gap = "6px";
          const txt = document.createElement("span");
          txt.textContent = gp;
          const gpBtn = document.createElement("button");
          gpBtn.type = "button";
          gpBtn.className = "secondary";
          gpBtn.textContent = "GP kartiņa";
          gpBtn.addEventListener("click", () => {
            if (typeof window.openCatalogByProcessGp === "function") {
              window.openCatalogByProcessGp(r.procNo, gp);
            }
          });
          line.appendChild(txt);
          line.appendChild(gpBtn);
          tdGp.appendChild(line);
        });
      }
      tr.appendChild(tdGp);

      tb.appendChild(tr);
    }

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

