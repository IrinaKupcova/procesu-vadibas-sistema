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

  function extractFirstNumber(s) {
    const t = getText(s);
    // atbalstām gan 1,23 gan 1.23
    const m = t.match(/-?\d+(?:[.,]\d+)?/);
    if (!m) return NaN;
    const num = Number(m[0].replace(",", "."));
    return Number.isFinite(num) ? num : NaN;
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
              <th>Izpildītājs - Strukturvienība izpildītājs, kas rada galaproduktu veidu</th>
            <th>Uzdevuma Nr.</th>
            <th>Uzdevums</th>
            <th>Procesa Nr.</th>
            <th>Process</th>
            <th>Galaproduks</th>
            <th>Galaprodukta veida Nr</th>
            <th>Galaprodukta veids</th>
            <th>GP veida skaits</th>
            <th>GP veida vidējais izpildes laiks</th>
            <th>Pakalpojums</th>
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

  function computeRows(processRows, catalogRows) {
    function pickTimeRaw(procRow) {
      // Supabase "laika" lauks (vidējais izpildes laiks) dažreiz atnāk ar citu nosaukumu.
      // Tava norāde: laika nosaukums = "Papildu informācija".
      const candidates = [
        procRow?.services,
        procRow?.outputAvgTime,
        procRow?.videjais_izpildes_laiks,
        procRow?.["Papildu informācija"],
        procRow?.["Papildu informacija"],
        procRow?.papilduInformacija,
        procRow?.additionalInfo,
        procRow?.additionalInformation,
      ];
      for (const c of candidates) {
        const t = getText(c);
        if (t) return t;
      }
      return "";
    }

    const linkedByProcessKey = (p) => {
      const t = getText(p.taskNo);
      const pn = getText(p.processNo);
      if (!t && !pn) return [];
      return catalogRows.filter((c) => {
        const ct = getText(c.taskNo);
        const cp = getText(c.procNo);
        if (t && pn) return ct === t && cp === pn;
        if (t) return ct === t;
        return cp === pn;
      });
    };

    // agregācija pēc (unit=izpildītājs, typeNo=GP veids)
    const agg = new Map(); // key -> {count, timeSum, timeN, servicesSet}
    const rows = []; // sīkās rindas

    const ensureAgg = (executor, typeNo) => {
      const k = `${executor}|${typeNo}`;
      if (!agg.has(k)) agg.set(k, { count: 0, timeSum: 0, timeN: 0, servicesSet: new Set() });
      return agg.get(k);
    };

    for (const p of processRows) {
      const executorCandidate = null;
      const linked = linkedByProcessKey(p);
      const taskNo = getText(p.taskNo);
      const task = getText(p.task);
      const procNo = getText(p.processNo);
      const proc = getText(p.process);
      const products = getText(p.products);

      if (!linked.length) continue;

      for (const c of linked) {
        const executor = getText(c.unit);
        const typeNo = getText(c.typeNo);
        const type = getText(c.type);

        const a = ensureAgg(executor, typeNo);
        a.count += 1;

        // vidējais izpildes laiks
        const svcRaw = getText(p.services); // pakalpojuma/teksta heuristikai
        const timeRaw = pickTimeRaw(p);
        const num = extractFirstNumber(timeRaw);
        if (!Number.isNaN(num)) {
          a.timeSum += num;
          a.timeN += 1;
        } else if (svcRaw) {
          a.servicesSet.add(svcRaw);
        }

        rows.push({
          executor,
          taskNo,
          task,
          procNo,
          proc,
          products,
          typeNo,
          type,
          aggKey: `${executor}|${typeNo}`,
          svcRaw,
        });
      }
    }

    // finālie rindas objekti ar agregātiem
    const finalRows = rows.map((r) => {
      const a = agg.get(r.aggKey);
      const avg = a && a.timeN ? a.timeSum / a.timeN : NaN;
      const avgText = Number.isNaN(avg) ? "" : (Math.round(avg * 100) / 100).toString();

      // pakalpojums: ja svcRaw nav skaitlis -> rādām; ja ir skaitlis -> mēģinam no set
      let servicesText = "";
      const num = extractFirstNumber(r.svcRaw);
      if (r.svcRaw && Number.isNaN(num)) {
        servicesText = r.svcRaw;
      } else if (a && a.servicesSet.size) {
        servicesText = Array.from(a.servicesSet).slice(0, 5).join("; ");
      }

      return {
        ...r,
        gpCount: a ? a.count : 0,
        avgTimeText: avgText,
        servicesText,
      };
    });

    // deduplēšana (lai nerastos pārāk daudz identisku rindu vienādu atslēgu dēļ)
    const seen = new Set();
    const dedup = [];
    for (const r of finalRows) {
      const key = [
        r.executor,
        r.taskNo,
        r.task,
        r.procNo,
        r.proc,
        r.products,
        r.typeNo,
        r.type,
      ].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(r);
    }

    dedup.sort((a, b) => {
      const x = `${a.executor} ${a.taskNo} ${a.procNo} ${a.typeNo}`.toLowerCase();
      const y = `${b.executor} ${b.taskNo} ${b.procNo} ${b.typeNo}`.toLowerCase();
      return x.localeCompare(y, "lv");
    });

    return dedup;
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
      tr.innerHTML = `
        <td>${r.executor || ""}</td>
        <td>${r.taskNo || ""}</td>
        <td>${r.task || ""}</td>
        <td>${r.procNo || ""}</td>
        <td>${r.proc || ""}</td>
        <td>${r.products || ""}</td>
        <td>${r.typeNo || ""}</td>
        <td>${r.type || ""}</td>
        <td>${r.gpCount ?? 0}</td>
        <td>${r.avgTimeText || ""}</td>
        <td>${r.servicesText || ""}</td>
      `;
      tb.appendChild(tr);
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

