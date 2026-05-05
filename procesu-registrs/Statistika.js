/* Statistika: salokāmi bloki + tabulas */
(function () {
  "use strict";

  let orgOpen = false;
  let processOpen = false;
  let jomaOpen = false;
  const filterState = { org: {}, proc: {}, joma: {} };
  const orgDetailOpenState = {
    process: new Set(),
    gp: new Set(),
    services: new Set(),
  };

  function $(id) {
    return document.getElementById(id);
  }

  function normalizeGroup(g) {
    const t = String(g || "").trim().toLowerCase();
    if (t.includes("pamatdarb")) return "pamat";
    if (t.includes("atbalsta")) return "atbalsta";
    if (t.includes("vad")) return "vadibas";
    return "cits";
  }

  function norm(v) {
    return String(v || "").trim().toLowerCase();
  }

  function contains(text, term) {
    if (!term) return true;
    return norm(text).includes(norm(term));
  }

  function ensureFilterStyles() {
    if (document.getElementById("statsFilterCss")) return;
    const s = document.createElement("style");
    s.id = "statsFilterCss";
    s.textContent = `
      .th-filter-wrap{display:flex;align-items:center;gap:4px;justify-content:space-between}
      .th-filter-btn{font-size:10px;padding:2px 5px;border:1px solid #94a3b8;border-radius:999px;background:#fff;color:#334155;cursor:pointer;line-height:1}
      .th-filter-btn.active{background:#2563eb;color:#fff;border-color:#2563eb}
      .th-filter-box{display:none;margin-top:4px}
      .th-filter-box.open{display:block}
      .th-filter-box select{width:100%;font-size:11px;padding:4px 6px;border:1px solid #cbd5e1;border-radius:4px;background:#fff}
      .stats-org-bar-wrap{display:flex;flex-wrap:wrap;gap:16px;margin:10px 0 14px;align-items:stretch}
      .stats-org-bar-panel{flex:1 1 min(440px,100%);border:1px solid #cbd5e1;border-radius:10px;padding:12px;background:#ffffff}
      body:not(.theme-light) .stats-org-bar-panel{background:#f8fafc}
      .stats-org-bar-panel h4{margin:0 0 10px;font-size:14px;font-weight:700;color:#0f172a}
      .stats-org-bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;min-width:380px}
      .stats-org-bar-row:last-child{margin-bottom:0}
      .stats-org-bar-panel{overflow-x:auto}
      .stats-org-bar-label{flex:0 0 min(220px,36%);overflow:hidden;text-overflow:ellipsis;color:#334155;line-height:1.25}
      .stats-org-bar-track{flex:1;height:18px;background:#e2e8f0;border-radius:6px;overflow:hidden;position:relative}
      .stats-org-bar-fill{height:100%;border-radius:6px;display:flex;align-items:center;padding:0 6px;justify-content:flex-end;font-size:11px;font-weight:700;color:#0f172a;background:linear-gradient(90deg,#93c5fd,#3b82f6);white-space:nowrap}
      .stats-org-bar-fill--gp{background:linear-gradient(90deg,#6ee7b7,#059669)}
      .stats-org-bar-fill--services{background:linear-gradient(90deg,#fca5a5,#dc2626)}
      .stats-org-bar-fill--pamat{background:#60a5fa}
      .stats-org-bar-fill--atbalsta{background:#34d399}
      .stats-org-bar-fill--vadibas{background:#f59e0b}
      .stats-org-bar-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
      .stats-org-help-btn{border:1px solid #94a3b8;background:#fff;border-radius:999px;width:22px;height:22px;line-height:20px;cursor:pointer;color:#1e3a8a;font-weight:700;padding:0;display:inline-flex;align-items:center;justify-content:center}
      .stats-org-help-btn:hover{background:#eff6ff}
      .stats-org-detail{margin:8px 0 10px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;padding:8px 10px}
      .stats-org-detail.hidden{display:none}
      .stats-org-detail-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 6px;font-size:12px;color:#0f172a;font-weight:700}
      .stats-org-detail-close{border:1px solid #94a3b8;background:#fff;border-radius:999px;font-size:11px;padding:2px 8px;cursor:pointer}
      .stats-org-detail-list{margin:0;padding-left:18px;color:#334155;font-size:12px;line-height:1.35;max-height:180px;overflow:auto}
      .stats-org-detail-list li{margin:2px 0}
      .stats-org-bar-track-group{display:flex;flex:1;height:18px;background:#e2e8f0;border-radius:6px;overflow:hidden}
      .stats-org-group-cell{display:flex;align-items:center;justify-content:flex-end;padding:0 6px;font-size:11px;color:#0f172a;font-weight:700}
      .stats-org-group-bars{flex:1;display:grid;grid-template-rows:repeat(3,1fr);gap:2px}
      .stats-org-group-line{height:16px;background:#e2e8f0;border-radius:5px;overflow:hidden}
      .stats-org-group-line-fill{height:100%;display:flex;align-items:center;justify-content:flex-end;padding:0 5px;font-size:10px;font-weight:700;color:#0f172a;white-space:nowrap}
      .stats-org-group-legend{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 0;font-size:11px;color:#334155}
      .stats-org-group-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:middle}
      .stats-simple-bars{display:grid;gap:8px}
      .stats-simple-row{display:flex;gap:8px;align-items:center;font-size:12px;min-width:380px}
      .stats-simple-label{flex:0 0 min(260px,45%);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155}
      .stats-simple-track{flex:1;height:20px;background:#e2e8f0;border-radius:6px;overflow:hidden}
      .stats-simple-fill{height:100%;display:flex;align-items:center;justify-content:flex-end;padding:0 6px;font-size:11px;font-weight:700;color:#0f172a;background:linear-gradient(90deg,#c4b5fd,#7c3aed);white-space:nowrap}
      .stats-simple-fill--joma{background:linear-gradient(90deg,#93c5fd,#2563eb)}
      .stats-org-proc{margin:4px 0 0;padding-left:1.2em;line-height:1.35;color:#334155;font-size:12px}
      .stats-org-proc li{margin:2px 0}
      #orgStatsTable .stats-org-proc-cell{vertical-align:top;min-width:180px}
    `;
    document.head.appendChild(s);
  }

  function ensureHeaderFilters(tableId, stateKey) {
    const table = $(tableId);
    if (!table) return;
    const headRow = table.querySelector("thead tr");
    if (!headRow || headRow.dataset.filtersReady === "1") return;
    Array.from(headRow.children).forEach((th, idx) => {
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
      const box = document.createElement("div");
      box.className = "th-filter-box";
      const sel = document.createElement("select");
      sel.dataset.colIndex = String(idx);
      const e = document.createElement("option");
      e.value = "";
      e.textContent = "Visas vērtības";
      sel.appendChild(e);
      sel.addEventListener("change", () => {
        filterState[stateKey][String(idx)] = sel.value;
        btn.classList.toggle("active", norm(sel.value) !== "");
        applyFilters(tableId, stateKey);
        if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
      });
      btn.addEventListener("click", () => box.classList.toggle("open"));
      box.appendChild(sel);
      wrap.appendChild(label);
      wrap.appendChild(btn);
      th.appendChild(wrap);
      th.appendChild(box);
    });
    headRow.dataset.filtersReady = "1";
  }

  function refreshFilterOptions(tableId, stateKey) {
    const table = $(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    table.querySelectorAll(".th-filter-box select[data-col-index]").forEach((sel) => {
      const col = Number(sel.dataset.colIndex);
      const selected = filterState[stateKey][String(col)] || "";
      const vals = new Set();
      Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
        const v = String(tr.children[col]?.textContent || "").trim();
        if (v) vals.add(v);
      });
      sel.innerHTML = "";
      const e = document.createElement("option");
      e.value = "";
      e.textContent = "Visas vērtības";
      sel.appendChild(e);
      Array.from(vals).sort((a, b) => a.localeCompare(b, "lv")).forEach((v) => {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
      });
      sel.value = selected;
      const btn = sel.closest("th")?.querySelector(".th-filter-btn");
      if (btn) btn.classList.toggle("active", norm(selected) !== "");
    });
  }

  function applyFilters(tableId, stateKey) {
    const table = $(tableId);
    if (!table) return;
    const tbody = table.querySelector("tbody");
    if (!tbody) return;
    Array.from(tbody.querySelectorAll("tr")).forEach((tr) => {
      const tds = Array.from(tr.children);
      let show = true;
      for (const col in filterState[stateKey]) {
        const term = filterState[stateKey][col];
        if (!contains(tds[Number(col)]?.textContent || "", term)) {
          show = false;
          break;
        }
      }
      tr.style.display = show ? "" : "none";
    });
  }

  function makeToggleTitle(h3, open) {
    if (!h3) return;
    h3.style.cursor = "pointer";
    h3.style.userSelect = "none";
    h3.textContent = `${open ? "▼" : "►"} ${h3.dataset.baseTitle || h3.textContent.replace(/^[▼►]\s*/, "")}`;
  }

  function ensurePanelStructure() {
    const reportsWrap = $("reportsBodyWrap");
    const orgCard = $("orgStatsCard");
    if (!reportsWrap || !orgCard) return null;

    const orgTitle = orgCard.querySelector("h3");
    if (orgTitle) orgTitle.dataset.baseTitle = "Izpildītāju statistika";

    let orgBody = $("orgStatsBody");
    if (!orgBody) {
      orgBody = document.createElement("div");
      orgBody.id = "orgStatsBody";
      orgBody.className = "hidden";
      const hint = $("orgStatsHint");
      if (hint) orgBody.appendChild(hint);
      orgCard.appendChild(orgBody);
    }

    if (orgTitle && !orgTitle.dataset.toggleBound) {
      orgTitle.addEventListener("click", () => {
        orgOpen = !orgOpen;
        orgBody.classList.toggle("hidden", !orgOpen);
        makeToggleTitle(orgTitle, orgOpen);
      });
      orgTitle.dataset.toggleBound = "1";
    }
    makeToggleTitle(orgTitle, orgOpen);
    orgBody.classList.toggle("hidden", !orgOpen);

    let processCard = $("processOutputStatsCard");
    if (!processCard) {
      processCard = document.createElement("div");
      processCard.id = "processOutputStatsCard";
      processCard.style.cssText = "margin-top:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;";
      processCard.innerHTML =
        '<h3 id="processOutputStatsTitle" style="margin:0 0 8px;font-size:16px;color:#0f172a;cursor:pointer;user-select:none">Galaprodukti procesos</h3>' +
        '<div id="processOutputStatsBody" class="hidden"></div>';
      reportsWrap.appendChild(processCard);
    }
    const processTitle = $("processOutputStatsTitle");
    const processBody = $("processOutputStatsBody");
    if (processTitle) processTitle.dataset.baseTitle = "Galaprodukti procesos";
    if (processTitle && !processTitle.dataset.toggleBound) {
      processTitle.addEventListener("click", () => {
        processOpen = !processOpen;
        processBody.classList.toggle("hidden", !processOpen);
        makeToggleTitle(processTitle, processOpen);
      });
      processTitle.dataset.toggleBound = "1";
    }
    makeToggleTitle(processTitle, processOpen);
    processBody.classList.toggle("hidden", !processOpen);

    let jomaCard = $("jomaStatsCard");
    if (!jomaCard) {
      jomaCard = document.createElement("div");
      jomaCard.id = "jomaStatsCard";
      jomaCard.style.cssText = "margin-top:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:14px;";
      jomaCard.innerHTML =
        '<h3 id="jomaStatsTitle" style="margin:0 0 8px;font-size:16px;color:#0f172a;cursor:pointer;user-select:none">Jomu statistika</h3>' +
        '<div id="jomaStatsBody" class="hidden"></div>';
      reportsWrap.appendChild(jomaCard);
    }
    const jomaTitle = $("jomaStatsTitle");
    const jomaBody = $("jomaStatsBody");
    if (jomaTitle) jomaTitle.dataset.baseTitle = "Jomu statistika";
    if (jomaTitle && !jomaTitle.dataset.toggleBound) {
      jomaTitle.addEventListener("click", () => {
        jomaOpen = !jomaOpen;
        jomaBody.classList.toggle("hidden", !jomaOpen);
        makeToggleTitle(jomaTitle, jomaOpen);
      });
      jomaTitle.dataset.toggleBound = "1";
    }
    makeToggleTitle(jomaTitle, jomaOpen);
    jomaBody.classList.toggle("hidden", !jomaOpen);

    return { orgBody, processBody, jomaBody };
  }

  function removeStatsTableTotals(host) {
    if (!host) return;
    host.querySelectorAll(".stats-table-total").forEach((n) => n.remove());
  }

  function removeOrgStatsCharts(host) {
    if (!host) return;
    host.querySelectorAll(".stats-org-bar-wrap").forEach((n) => n.remove());
  }

  /** Tās pašas pārvalžu kā Izpildītāji skats: [,;\\n] + vienreizējīgi tokeni */
  function executorTokensFromMergedRow(m) {
    const raw = String((m && m.executorPatstaviga) || "").trim();
    const seen = new Set();
    const out = [];
    raw
      .split(/[,;\n]+/)
      .map((x) => String(x || "").replace(/\.+$/g, "").trim())
      .filter(Boolean)
      .forEach((u) => {
        const low = norm(u);
        if (!low || seen.has(low)) return;
        seen.add(low);
        out.push(u.trim());
      });
    return out;
  }

  function ensureUnitAgg(map, unitLabel) {
    if (!map.has(unitLabel)) {
      map.set(unitLabel, {
        processKeys: new Set(),
        processLines: [],
        gpSet: new Set(),
        jomaSet: new Set(),
        services: new Set(),
        pamat: 0,
        atbalsta: 0,
        vadibas: 0,
        gpTotal: 0,
      });
    }
    return map.get(unitLabel);
  }

  function splitMultiValues(v) {
    return String(v || "")
      .split(/[,;\n]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function renderOrgBarPanels(host, pairsProcesi, pairsGp, pairsServices, unitMap) {
    const wrap = document.createElement("div");
    wrap.className = "stats-org-bar-wrap";
    wrap.setAttribute("role", "presentation");

    function openDetail(setRef, key, detailBox) {
      setRef.clear();
      setRef.add(key);
      detailBox.classList.remove("hidden");
    }

    function makeDetailBox(typeKey) {
      const box = document.createElement("div");
      box.className = "stats-org-detail hidden";
      const title = document.createElement("div");
      title.className = "stats-org-detail-title";
      const label = document.createElement("span");
      const close = document.createElement("button");
      close.type = "button";
      close.className = "stats-org-detail-close";
      close.textContent = "Aizvērt";
      close.onclick = () => {
        const openSet = orgDetailOpenState[typeKey];
        if (openSet && box.dataset.unitKey) openSet.delete(box.dataset.unitKey);
        box.classList.add("hidden");
      };
      title.appendChild(label);
      title.appendChild(close);
      const list = document.createElement("ul");
      list.className = "stats-org-detail-list";
      box.appendChild(title);
      box.appendChild(list);
      box.__labelEl = label;
      box.__listEl = list;
      return box;
    }

    function fillPanel(panel, pairs, klass, subtitle, helpTitle, detailTypeKey, detailListGetter, customRowRenderer) {
      const enableDetails = !!detailTypeKey && typeof detailListGetter === "function";
      const enableHelp = !!String(helpTitle || "").trim();
      const head = document.createElement("div");
      head.className = "stats-org-bar-head";
      const h = document.createElement("h4");
      h.textContent = subtitle;
      head.appendChild(h);
      let help = null;
      if (enableHelp) {
        help = document.createElement("button");
        help.type = "button";
        help.className = "stats-org-help-btn";
        help.textContent = "i";
        help.title = helpTitle;
        head.appendChild(help);
      }
      panel.appendChild(head);

      const detail = enableDetails ? makeDetailBox(detailTypeKey) : null;
      if (detail) panel.appendChild(detail);

      if (help) {
        help.onclick = () => {
          alert(helpTitle);
        };
      }

      const max = pairs.reduce((m, z) => Math.max(m, z.count), 0) || 1;
      pairs.forEach(({ label, count }) => {
        const pct = max > 0 ? (count / max) * 100 : 0;
        const row = document.createElement("div");
        row.className = "stats-org-bar-row";
        const labEl = document.createElement("span");
        labEl.className = "stats-org-bar-label";
        labEl.textContent = label;
        labEl.title = label;
        const track = customRowRenderer
          ? customRowRenderer({ label, count, pct, unitData: unitMap.get(label) })
          : (() => {
            const t = document.createElement("div");
            t.className = "stats-org-bar-track";
            const fill = document.createElement("div");
            fill.className = klass;
            fill.style.width = pct + "%";
            fill.style.minWidth = "0";
            fill.textContent = String(count);
            t.appendChild(fill);
            return t;
          })();
        if (enableDetails) {
          row.style.cursor = "pointer";
          row.title = helpTitle;
          row.onclick = () => {
            const unitData = unitMap.get(label);
            if (!unitData) return;
            detail.dataset.unitKey = label;
            detail.__labelEl.textContent = label;
            detail.__listEl.innerHTML = "";
            const items = detailListGetter(unitData);
            if (!items.length) {
              const li = document.createElement("li");
              li.textContent = "(nav datu)";
              detail.__listEl.appendChild(li);
            } else {
              items.forEach((txt) => {
                const li = document.createElement("li");
                li.textContent = txt;
                detail.__listEl.appendChild(li);
              });
            }
            openDetail(orgDetailOpenState[detailTypeKey], label, detail);
          };
        }
        if (enableDetails && orgDetailOpenState[detailTypeKey].has(label)) {
          const unitData = unitMap.get(label);
          if (!unitData) return;
          detail.dataset.unitKey = label;
          detail.__labelEl.textContent = label;
          detail.__listEl.innerHTML = "";
          const items = detailListGetter(unitData);
          if (!items.length) {
            const li = document.createElement("li");
            li.textContent = "(nav datu)";
            detail.__listEl.appendChild(li);
          } else {
            items.forEach((txt) => {
              const li = document.createElement("li");
              li.textContent = txt;
              detail.__listEl.appendChild(li);
            });
          }
          detail.classList.remove("hidden");
        }
        row.appendChild(labEl);
        row.appendChild(track);
        panel.appendChild(row);
      });
    }

    const p1 = document.createElement("div");
    p1.className = "stats-org-bar-panel";
    fillPanel(
      p1,
      pairsProcesi,
      "stats-org-bar-fill",
      "Pārvaldēm piekritīgie procesi, skaits",
      "Atverot, tiks parādīti procesi",
      "process",
      (unitData) => unitData.processLines.slice().sort((a, b) => a.localeCompare(b, "lv"))
    );
    const p2 = document.createElement("div");
    p2.className = "stats-org-bar-panel";
    fillPanel(
      p2,
      pairsGp,
      "stats-org-bar-fill stats-org-bar-fill--gp",
      "Pārvaldēm piekritīgie unikālie galaprodukti, skaits",
      "Atverot, tiks parādīti galaprodukti",
      "gp",
      (unitData) => Array.from(unitData.gpSet).sort((a, b) => a.localeCompare(b, "lv"))
    );
    const p3 = document.createElement("div");
    p3.className = "stats-org-bar-panel";
    const groupMax = { pamat: 0, atbalsta: 0, vadibas: 0 };
    unitMap.forEach((u) => {
      groupMax.pamat = Math.max(groupMax.pamat, Number(u.pamat || 0));
      groupMax.atbalsta = Math.max(groupMax.atbalsta, Number(u.atbalsta || 0));
      groupMax.vadibas = Math.max(groupMax.vadibas, Number(u.vadibas || 0));
    });
    fillPanel(
      p3,
      pairsProcesi,
      "",
      "Pārvalžu sadalījums pa procesu grupām",
      "",
      "",
      null,
      ({ unitData }) => {
        const track = document.createElement("div");
        track.className = "stats-org-group-bars";
        const segs = [
          { k: "pamat", cls: "stats-org-bar-fill--pamat", v: Number(unitData.pamat || 0), max: groupMax.pamat || 1 },
          { k: "atbalsta", cls: "stats-org-bar-fill--atbalsta", v: Number(unitData.atbalsta || 0), max: groupMax.atbalsta || 1 },
          { k: "vadibas", cls: "stats-org-bar-fill--vadibas", v: Number(unitData.vadibas || 0), max: groupMax.vadibas || 1 },
        ];
        segs.forEach((seg) => {
          const line = document.createElement("div");
          line.className = "stats-org-group-line";
          const fill = document.createElement("div");
          fill.className = `stats-org-group-line-fill ${seg.cls}`;
          const pct = seg.max > 0 ? (seg.v / seg.max) * 100 : 0;
          fill.style.width = `${seg.v > 0 ? Math.max(8, pct) : 0}%`;
          fill.textContent = String(seg.v);
          line.appendChild(fill);
          track.appendChild(line);
        });
        return track;
      }
    );
    const lg = document.createElement("div");
    lg.className = "stats-org-group-legend";
    lg.innerHTML =
      '<span><i style="background:#60a5fa"></i>Pamatdarbības</span><span><i style="background:#34d399"></i>Atbalsta</span><span><i style="background:#f59e0b"></i>Vadības</span>';
    p3.appendChild(lg);
    const p4 = document.createElement("div");
    p4.className = "stats-org-bar-panel";
    fillPanel(
      p4,
      pairsServices,
      "stats-org-bar-fill stats-org-bar-fill--services",
      "Pārvalžu sadalījums pēc pakalpojumu skaita",
      "Atverot, tiks parādīti pakalpojumi",
      "services",
      (unitData) => Array.from(unitData.services).sort((a, b) => a.localeCompare(b, "lv"))
    );

    wrap.appendChild(p1);
    wrap.appendChild(p2);
    wrap.appendChild(p3);
    wrap.appendChild(p4);
    host.insertBefore(wrap, host.firstChild);
  }

  function renderOrgTable(orgBody, mergedProcessRows, catalogRows) {
    if (!orgBody) return;
    removeOrgStatsCharts(orgBody);
    removeStatsTableTotals(orgBody);
    const merged = Array.isArray(mergedProcessRows) ? mergedProcessRows : [];
    const byUnit = new Map();

    merged.forEach((r) => {
      const gpN = countGalaproduktiOnMergedRow(r);
      let units = executorTokensFromMergedRow(r);
      if (!units.length) units = ["(nav norādītas pārvaldes)"];
      const dk = mergedProcessDedupeKey(r);
      const g = normalizeGroup(r.group);

      units.forEach((unit) => {
        const agg = ensureUnitAgg(byUnit, unit);
        const isNew = !agg.processKeys.has(dk);
        if (isNew) {
          agg.processKeys.add(dk);
          const pn = String((r && r.processNo) || "").trim();
          const pnLabel = pn || "(bez procesa Nr.)";
          const pName = String((r && r.process) || "").trim();
          agg.processLines.push(pName ? `${pnLabel}: ${pName}` : pnLabel);
          if (g === "pamat") agg.pamat += 1;
          else if (g === "atbalsta") agg.atbalsta += 1;
          else if (g === "vadibas") agg.vadibas += 1;
          agg.gpTotal += gpN;
          if (Array.isArray(r.gpItems) && r.gpItems.length) {
            r.gpItems
              .map((g) => String((g && g.name) || "").trim())
              .filter(Boolean)
              .forEach((g) => agg.gpSet.add(g));
          } else {
            String((r && r.productsText) || (r && r.products) || "")
              .split(/[;\n]+/)
              .map((x) => String(x || "").trim())
              .filter(Boolean)
              .forEach((g) => agg.gpSet.add(g));
          }
          {
            const seenJomaInProc = new Set();
            gpLinesForJomaStats(r).forEach((gp) => {
              const label = String((gp && gp.jomaText) || "").trim();
              const key = normalizeJomaKey(label);
              if (!key || seenJomaInProc.has(key)) return;
              seenJomaInProc.add(key);
              agg.jomaSet.add(label);
            });
          }
          String((r && r.services) || "")
            .trim()
            .split(/[\n;]+/)
            .map((x) => String(x || "").trim())
            .filter(Boolean)
            .forEach((s) => agg.services.add(s));
        }
      });
    });

    // Unikālie GP pa pārvaldēm no GP kataloga (nevis no procesu reģistra apvienotajām rindām).
    const cat = Array.isArray(catalogRows) ? catalogRows : [];
    cat.forEach((c) => {
      const gpName = String((c && c.type) || "").trim();
      if (!gpName) return;
      const units = splitMultiValues((c && c.unit) || "");
      const scopedUnits = units.length ? units : ["(nav norādītas pārvaldes)"];
      scopedUnits.forEach((unit) => {
        const agg = ensureUnitAgg(byUnit, unit);
        agg.gpSet.add(gpName);
      });
    });

    const unitKeysSorted = Array.from(byUnit.keys()).sort((a, b) => a.localeCompare(b, "lv"));

    const pairsProcesi = unitKeysSorted.map((u) => ({ label: u, count: byUnit.get(u).processKeys.size }));
    const pairsGp = unitKeysSorted.map((u) => ({ label: u, count: byUnit.get(u).gpSet.size }));
    const pairsServices = unitKeysSorted.map((u) => ({ label: u, count: byUnit.get(u).services.size }));
    renderOrgBarPanels(orgBody, pairsProcesi, pairsGp, pairsServices, byUnit);

    const hint = $("orgStatsHint");
    if (hint) {
      hint.textContent =
        "Procesu skaiti/grupu sadalījums tiek rēķināts no apvienotajām Procesu reģistra rindām, bet unikālie galaprodukti pa pārvaldēm — no GP kataloga.";
    }

    const sumPamat = unitKeysSorted.reduce((s, u) => s + byUnit.get(u).pamat, 0);
    const sumAtbalsta = unitKeysSorted.reduce((s, u) => s + byUnit.get(u).atbalsta, 0);
    const sumVadibas = unitKeysSorted.reduce((s, u) => s + byUnit.get(u).vadibas, 0);
    const sumPak = unitKeysSorted.reduce((s, u) => s + byUnit.get(u).services.size, 0);
    const sumGpUniq = unitKeysSorted.reduce((s, u) => s + byUnit.get(u).gpSet.size, 0);

    const tot = document.createElement("p");
    tot.className = "stats-table-total";
    tot.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:600;color:#0f172a;";
    tot.textContent =
      `Kopskaits — izpildītāju (pārvalžu) rindas: ${byUnit.size}; unikālie galaprodukti (summa pa pārvaldēm): ${sumGpUniq}; pamatdarbības: ${sumPamat}; atbalsta: ${sumAtbalsta}; vadības: ${sumVadibas}; pakalpojumu nosaukumu atšķirīgas vērtības (summa): ${sumPak}. Summas var pārsniegt vienreizējā procesu skaitu, ja viens process ir vairākās pārvaldēs.`;
    orgBody.appendChild(tot);
  }

  function getStatsProcessRows() {
    if (typeof window.getMergedProcessRegisterRows === "function") {
      const m = window.getMergedProcessRegisterRows();
      if (Array.isArray(m) && m.length) return m;
    }
    return typeof window.getProcessRows === "function" ? window.getProcessRows() : [];
  }

  function countGalaproduktiInProcess(r) {
    const raw = String((r && r.products) || "").trim();
    if (!raw) return 0;
    return raw
      .split(/[;\n]+/)
      .map((x) => String(x || "").trim())
      .filter(Boolean).length;
  }

  /** GP skaits tāpat kā procesu tabulas loģiskajam procesam (gpItems / productsText), nevis katras DB rindas «products» lauks atsevišķi. */
  function countGalaproduktiOnMergedRow(r) {
    if (!r) return 0;
    if (Array.isArray(r.gpItems) && r.gpItems.length) {
      const named = r.gpItems.filter((g) => String((g && g.name) || "").trim()).length;
      if (named > 0) return named;
    }
    const pt = String((r && r.productsText) || "").trim();
    if (pt) {
      return pt
        .split(/[;\n]+/)
        .map((x) => String(x || "").trim())
        .filter(Boolean).length;
    }
    return countGalaproduktiInProcess(r);
  }

  function normProcessStatsKey(name) {
    return String(name || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function mergedProcessDedupeKey(r) {
    const n = String((r && r.processNo) || "").trim();
    const p = String((r && r.process) || "").trim();
    return `${norm(n)}|${normProcessStatsKey(p)}`;
  }

  /** Pārskats «Galaprodukti procesos» — apvienotas procesu reģistra rindas; viena rinda uz procesa nosaukumu, skaits = GP šim procesam. */
  function renderProcessOutputTable(processBody) {
    if (!processBody) return;
    removeStatsTableTotals(processBody);
    const merged = getStatsProcessRows();
    const byName = new Map();
    merged.forEach((r) => {
      const displayName = String((r && r.process) || "").trim() || "—";
      const k = normProcessStatsKey(displayName);
      const n = countGalaproduktiOnMergedRow(r);
      if (!byName.has(k)) {
        byName.set(k, { processName: displayName, gpCount: 0 });
      }
      byName.get(k).gpCount += n;
    });
    const rows = Array.from(byName.values());

    const old = $("processOutputStatsTable");
    if (old && old.parentElement) old.parentElement.removeChild(old);
    const wrap = document.createElement("div");
    wrap.id = "processOutputStatsTable";
    wrap.className = "stats-simple-bars";
    const sorted = rows.sort((a, b) => b.gpCount - a.gpCount || a.processName.localeCompare(b.processName, "lv"));
    const max = sorted.reduce((m, x) => Math.max(m, x.gpCount), 0) || 1;
    sorted.forEach((x) => {
      const row = document.createElement("div");
      row.className = "stats-simple-row";
      const label = document.createElement("span");
      label.className = "stats-simple-label";
      label.title = x.processName;
      label.textContent = x.processName;
      const track = document.createElement("div");
      track.className = "stats-simple-track";
      const fill = document.createElement("div");
      fill.className = "stats-simple-fill";
      fill.style.width = `${max > 0 ? (x.gpCount / max) * 100 : 0}%`;
      fill.textContent = String(x.gpCount);
      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      wrap.appendChild(row);
    });
    processBody.appendChild(wrap);
    const totalGp = rows.reduce((s, x) => s + x.gpCount, 0);
    const tot = document.createElement("p");
    tot.className = "stats-table-total";
    tot.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:600;color:#0f172a;";
    tot.textContent = `Kopskaits — procesi (ieraksti tabulā): ${rows.length}; galaprodukti (visiem procesiem kopā): ${totalGp}.`;
    processBody.appendChild(tot);
  }

  function gpLinesForJomaStats(r) {
    return Array.isArray(r.gpItems) && r.gpItems.length
      ? r.gpItems
      : [{ jomaText: String((r && r.darbibasJoma) || "") }];
  }

  function processTouchesJomaLabel(r, jomaLabel) {
    return gpLinesForJomaStats(r).some((gp) => String((gp && gp.jomaText) || "").trim() === jomaLabel);
  }

  function normalizeJomaKey(label) {
    return String(label || "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** Jomu statistika: unikālo jomu skaits katrai pārvaldei. */
  function renderJomaStatsTable(jomaBody) {
    if (!jomaBody) return;
    removeStatsTableTotals(jomaBody);
    const merged = getStatsProcessRows();
    const byUnitJoma = new Map();
    merged.forEach((r) => {
      let units = executorTokensFromMergedRow(r);
      if (!units.length) units = ["(nav norādītas pārvaldes)"];
      const jomasThisProc = new Map();
      gpLinesForJomaStats(r).forEach((gp) => {
        const label = String((gp && gp.jomaText) || "").trim();
        const key = normalizeJomaKey(label);
        if (!key) return;
        if (!jomasThisProc.has(key)) jomasThisProc.set(key, label);
      });
      units.forEach((unit) => {
        if (!byUnitJoma.has(unit)) byUnitJoma.set(unit, new Set());
        const set = byUnitJoma.get(unit);
        jomasThisProc.forEach((label) => set.add(label));
      });
    });

    const byJoma = new Map();
    Array.from(byUnitJoma.keys())
      .sort((a, b) => a.localeCompare(b, "lv"))
      .forEach((unit) => {
        byJoma.set(unit, byUnitJoma.get(unit).size);
      });

    const old = $("jomaStatsTable");
    if (old && old.parentElement) old.parentElement.removeChild(old);
    const wrap = document.createElement("div");
    wrap.id = "jomaStatsTable";
    wrap.className = "stats-simple-bars";
    const jomaKeys = Array.from(byJoma.keys());
    const max = jomaKeys.reduce((m, j) => Math.max(m, byJoma.get(j) || 0), 0) || 1;
    jomaKeys.forEach((joma) => {
      const n = byJoma.get(joma) || 0;
      const row = document.createElement("div");
      row.className = "stats-simple-row";
      const label = document.createElement("span");
      label.className = "stats-simple-label";
      label.title = joma;
      label.textContent = joma;
      const track = document.createElement("div");
      track.className = "stats-simple-track";
      const fill = document.createElement("div");
      fill.className = "stats-simple-fill stats-simple-fill--joma";
      fill.style.width = `${max > 0 ? (n / max) * 100 : 0}%`;
      fill.textContent = String(n);
      track.appendChild(fill);
      row.appendChild(label);
      row.appendChild(track);
      wrap.appendChild(row);
    });
    jomaBody.appendChild(wrap);
    const totalProcesi = merged.length;
    const tot = document.createElement("p");
    tot.className = "stats-table-total";
    tot.style.cssText = "margin:8px 0 0;font-size:13px;font-weight:600;color:#0f172a;";
    tot.textContent = `Kopskaits — procesi (loģiskie): ${totalProcesi}; pārvaldes ar jomu datiem: ${byJoma.size}.`;
    jomaBody.appendChild(tot);
  }

  function renderOrgStats() {
    const refs = ensurePanelStructure();
    if (!refs) return;
    const mergedRows = getStatsProcessRows();
    const catalogRows = typeof window.getCatalogRows === "function" ? window.getCatalogRows() : [];
    renderOrgTable(refs.orgBody, mergedRows, catalogRows);
    renderProcessOutputTable(refs.processBody);
    renderJomaStatsTable(refs.jomaBody);
    if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
  }

  function hasActiveStatsFilters() {
    return Object.values(filterState.org || {}).some((v) => norm(v) !== "") ||
      Object.values(filterState.proc || {}).some((v) => norm(v) !== "") ||
      Object.values(filterState.joma || {}).some((v) => norm(v) !== "");
  }

  function clearStatsFilters() {
    filterState.org = {};
    filterState.proc = {};
    filterState.joma = {};
    document.querySelectorAll(
      "#orgStatsTable .th-filter-box select[data-col-index], #processOutputStatsTable .th-filter-box select[data-col-index], #jomaStatsTable .th-filter-box select[data-col-index]"
    ).forEach((s) => {
      s.value = "";
    });
    document.querySelectorAll(
      "#orgStatsTable .th-filter-btn.active, #processOutputStatsTable .th-filter-btn.active, #jomaStatsTable .th-filter-btn.active"
    ).forEach((b) => {
      b.classList.remove("active");
    });
    applyFilters("orgStatsTable", "org");
    applyFilters("processOutputStatsTable", "proc");
    applyFilters("jomaStatsTable", "joma");
    if (typeof window.refreshClearFilterButtonActive === "function") window.refreshClearFilterButtonActive();
  }

  window.renderOrgStats = renderOrgStats;
  window.hasActiveStatsFilters = hasActiveStatsFilters;
  window.clearStatsFilters = clearStatsFilters;

  function boot() {
    ensureFilterStyles();
    renderOrgStats();
    window.addEventListener("app:db-sync", renderOrgStats);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
