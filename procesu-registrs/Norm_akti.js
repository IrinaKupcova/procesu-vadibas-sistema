/* Procesus reglamentējoši normatīvie akti — uzskaites bloks (Supabase + localStorage rezerve). */
(function () {
  "use strict";

  const NA_TITLE = "Procesus reglamentējoši normatīvie akti";
  const STORAGE_ACTS = "pv_norm_akti_v1";
  const STORAGE_VEIDI = "pv_norm_akti_veidi_v1";
  const MIGRATED_FLAG = "pv_norm_akti_db_migrated_v1";

  const DEFAULT_VEIDI = [
    "Likums",
    "MK noteikumi",
    "ES regula",
    "VID iekšējais normatīvais akts",
    "Cits",
  ];
  const ADD_NEW = "__add_new__";

  let editingId = null;
  let actsCache = [];
  let customVeidiCache = [];
  let loadPromise = null;
  /** Atgriešanās konteksts pēc NA redaktora aizvēršanas: process | catalog | joma | list */
  let returnContext = null;
  /** Joma no ieraksta/konteksta (lauks kartiņā nav redzams). */
  let editorDraftJoma = "";

  const $ = (id) => document.getElementById(id);

  function elVal(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function normKey(v) {
    return String(v || "").trim().toLowerCase();
  }

  function processNoKey(v) {
    if (window.Numeracija && typeof Numeracija.processNoKey === "function") {
      return Numeracija.processNoKey(v);
    }
    return normKey(v);
  }

  function collectProcessNosForJoma(jomaName) {
    const jk = normKey(jomaName);
    if (!jk) return new Set();
    const procNos = new Set();
    let rows = [];
    if (typeof window.getCatalogRows === "function") rows = window.getCatalogRows() || [];
    rows.forEach((r) => {
      if (normKey(r.darbibasJoma) !== jk) return;
      const pn = processNoKey(r.procNo);
      if (pn) procNos.add(pn);
    });
    return procNos;
  }

  function openActLabel(canEditMode) {
    return canEditMode ? "Skatīt/Labot" : "Skatīt";
  }

  function normalizePenemsanasDatums(v) {
    const s = String(v || "").trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      return m[3] + "-" + mm + "-" + dd;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  }

  function formatPenemsanasDatumsDisplay(v) {
    const iso = normalizePenemsanasDatums(v);
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
    const p = iso.split("-");
    return p[2] + "." + p[1] + "." + p[0];
  }

  function actsMatching(filter) {
    const f = filter || {};
    return loadActs().filter((r) => {
      if (f.joma && normKey(r.joma) !== normKey(f.joma)) return false;
      if (f.processNo) {
        const a = processNoKey(r.processNo);
        const b = processNoKey(f.processNo);
        if (a && b) {
          if (a !== b) return false;
        } else if (f.process && normKey(r.process) !== normKey(f.process)) {
          return false;
        }
      } else if (f.process && normKey(r.process) !== normKey(f.process)) {
        return false;
      }
      if (f.gpTypeNo) {
        const want = String(f.gpTypeNo).trim().toUpperCase();
        const top = String(r.gpTypeNo || "").trim().toUpperCase() === want;
        const inRefs = parseGpRefsFromRaw(r).some(
          (ref) => String(ref.gpTypeNo || "").trim().toUpperCase() === want
        );
        if (!top && !inRefs) return false;
      }
      if (f.gp) {
        const top = normKey(r.gp) === normKey(f.gp);
        const inRefs = parseGpRefsFromRaw(r).some((ref) => normKey(ref.gp) === normKey(f.gp));
        if (!top && !inRefs) return false;
      }
      return true;
    });
  }

  function canEdit() {
    if (typeof window.canEdit === "function") return window.canEdit();
    const rs = $("roleSelect");
    return rs && (rs.value === "admin" || rs.value === "admin_edit");
  }

  function statusMsg(text, kind) {
    if (typeof window.status === "function") window.status(text, kind || "info");
  }

  function loadJson(key, fallback) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      return raw != null ? raw : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function saveJson(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  function loadActsLocal() {
    const arr = loadJson(STORAGE_ACTS, []);
    return Array.isArray(arr) ? arr.slice() : [];
  }

  function loadActs() {
    return actsCache.slice();
  }

  function loadCustomVeidiLocal() {
    const arr = loadJson(STORAGE_VEIDI, []);
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  }

  function allVeidi() {
    const seen = new Set();
    const out = [];
    DEFAULT_VEIDI.concat(customVeidiCache).forEach((v) => {
      const s = String(v || "").trim();
      if (!s || seen.has(s.toLowerCase())) return;
      seen.add(s.toLowerCase());
      out.push(s);
    });
    return out.sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));
  }

  async function addCustomVeids(name) {
    const s = String(name || "").trim();
    if (!s || allVeidi().some((x) => x.toLowerCase() === s.toLowerCase())) return;
    customVeidiCache.push(s);
    saveJson(STORAGE_VEIDI, customVeidiCache);
    const api = window.DB;
    if (api && typeof api.upsertNormActKlasifikators === "function") {
      try {
        await api.upsertNormActKlasifikators("veids", s);
      } catch (e) {
        console.warn("NormAkti veids DB:", e);
      }
    }
  }

  async function loadKlasifikatoriFromDb() {
    const api = window.DB;
    if (!api || typeof api.loadNormActKlasifikatori !== "function") {
      customVeidiCache = loadCustomVeidiLocal();
      return;
    }
    try {
      const k = await api.loadNormActKlasifikatori();
      customVeidiCache = Array.isArray(k.veidi) ? k.veidi.slice() : [];
      saveJson(STORAGE_VEIDI, customVeidiCache);
    } catch (e) {
      console.warn("NormAkti klasifikatori DB:", e);
      customVeidiCache = loadCustomVeidiLocal();
    }
  }

  async function migrateLocalToDbIfNeeded() {
    if (localStorage.getItem(MIGRATED_FLAG) === "1") return;
    const api = window.DB;
    if (!api || typeof api.insertNormAct !== "function") return;
    const local = loadActsLocal();
    if (!local.length) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      return;
    }
    if (actsCache.length) {
      localStorage.setItem(MIGRATED_FLAG, "1");
      return;
    }
    for (const row of local) {
      try {
        await api.insertNormAct(normalizeActRow(row));
      } catch (e) {
        console.warn("NormAkti migrate row:", e);
      }
    }
    actsCache = await api.loadNormActs();
    localStorage.setItem(MIGRATED_FLAG, "1");
    saveJson(STORAGE_ACTS, []);
  }

  function normalizeVeids(v) {
    const s = String(v || "").trim();
    const k = s.toLowerCase();
    if (k === "likums") return "Likums";
    if (k === "cits") return "Cits";
    return s;
  }

  function parseGpRefItem(raw) {
    const r = raw || {};
    return {
      processNo: String(r.processNo || "").trim(),
      process: String(r.process || "").trim(),
      gpTypeNo: String(r.gpTypeNo || "").trim(),
      gp: String(r.gp || "").trim(),
      pantsPunkts: String(r.pantsPunkts || r.pants_punkts || "").trim(),
    };
  }

  function parseGpRefsFromRaw(x) {
    const src = x || {};
    if (Array.isArray(src.gpRefs) && src.gpRefs.length) {
      return src.gpRefs.map(parseGpRefItem).filter((r) => r.gpTypeNo || r.gp || r.processNo || r.process);
    }
    const json = String(src.gpRefsJson || src.gp_refs_json || "").trim();
    if (json) {
      try {
        const arr = JSON.parse(json);
        if (Array.isArray(arr)) {
          return arr.map(parseGpRefItem).filter((r) => r.gpTypeNo || r.gp || r.processNo || r.process);
        }
      } catch (_) {}
    }
    const gpTypeNo = String(src.gpTypeNo || "").trim();
    const gp = String(src.gp || "").trim();
    if (gpTypeNo || gp) {
      return [
        parseGpRefItem({
          processNo: src.processNo,
          process: src.process,
          gpTypeNo,
          gp,
          pantsPunkts: src.pantsPunkts || src.pants_punkts,
        }),
      ];
    }
    return [];
  }

  function gpRefMatchesCtx(ref, ctx) {
    const procNo = String((ctx && ctx.procNo) || (ctx && ctx.processNo) || "").trim();
    const gpTypeNo = String((ctx && ctx.gpTypeNo) || "").trim();
    const gp = String((ctx && ctx.gp) || "").trim();
    const r = parseGpRefItem(ref);
    if (gpTypeNo && r.gpTypeNo.toUpperCase() === gpTypeNo.toUpperCase()) {
      if (!procNo || processNoKey(r.processNo) === processNoKey(procNo)) return true;
    }
    if (gp && normKey(r.gp) === normKey(gp)) {
      if (!procNo || processNoKey(r.processNo) === processNoKey(procNo)) return true;
    }
    return false;
  }

  function processRefMatches(ref, pNo, pName) {
    const r = parseGpRefItem(ref);
    if (pNo && processNoKey(r.processNo) === processNoKey(pNo)) return true;
    if (pName && normKey(r.process) === normKey(pName)) return true;
    return false;
  }

  function findGpRefForCtx(act, ctx) {
    return parseGpRefsFromRaw(act).find((r) => gpRefMatchesCtx(r, ctx)) || null;
  }

  function gpRefsForProcess(act, pNo, pName) {
    const refs = parseGpRefsFromRaw(act);
    if (!pNo && !pName) return refs;
    return refs.filter((r) => processRefMatches(r, pNo, pName));
  }

  function applyGpRefsToAct(act, refs) {
    const clean = (refs || []).map(parseGpRefItem).filter((r) => r.gpTypeNo || r.gp || r.processNo || r.process);
    const first = clean[0] || {};
    const base = act || {};
    const merged = Object.assign({}, base, {
      processNo: first.processNo || String(base.processNo || "").trim(),
      process: first.process || String(base.process || "").trim(),
      gpTypeNo: first.gpTypeNo || "",
      gp: first.gp || "",
      gpRefs: clean,
      gpRefsJson: clean.length ? JSON.stringify(clean) : "",
    });
    return normalizeActRow(merged);
  }

  function gpRefSummaryLabel(ref) {
    const r = parseGpRefItem(ref);
    const gpLbl = r.gpTypeNo && r.gp ? r.gpTypeNo + " — " + r.gp : r.gp || r.gpTypeNo || "";
    if (r.pantsPunkts && gpLbl) return gpLbl + " (" + r.pantsPunkts + ")";
    if (r.pantsPunkts) return r.pantsPunkts;
    return gpLbl;
  }

  function normalizeActRow(r) {
    const x = r || {};
    let veids = normalizeVeids(x.veids);
    if (veids === ADD_NEW) veids = "";
    const gpRefs = parseGpRefsFromRaw(x);
    const gpRefsJson =
      gpRefs.length > 0
        ? JSON.stringify(gpRefs)
        : String(x.gpRefsJson || x.gp_refs_json || "").trim();
    const first = gpRefs[0] || {};
    return {
      id: String(x.id || ""),
      nosaukums: String(x.nosaukums || "").trim(),
      veids: veids,
      numurs: String(x.numurs || "").trim(),
      pantsPunkts: String(x.pantsPunkts || x.pants_punkts || "").trim(),
      penemsanasDatums: normalizePenemsanasDatums(
        x.penemsanasDatums || x.penemsanas_datums || ""
      ),
      joma: String(x.joma || "").trim(),
      processNo: String(first.processNo || x.processNo || "").trim(),
      process: String(first.process || x.process || "").trim(),
      gpTypeNo: String(first.gpTypeNo || x.gpTypeNo || "").trim(),
      gp: String(first.gp || x.gp || "").trim(),
      gpRefs: gpRefs,
      gpRefsJson: gpRefsJson,
    };
  }

  async function loadFromDb(force) {
    if (loadPromise && !force) return loadPromise;
    loadPromise = (async () => {
      const api = window.DB;
      if (!api || typeof api.loadNormActs !== "function") {
        actsCache = loadActsLocal().map(normalizeActRow);
        await loadKlasifikatoriFromDb();
        return actsCache;
      }
      try {
        actsCache = (await api.loadNormActs()).map(normalizeActRow);
        await loadKlasifikatoriFromDb();
        await migrateLocalToDbIfNeeded();
        return actsCache;
      } catch (e) {
        console.warn("NormAkti DB load:", e);
        actsCache = loadActsLocal().map(normalizeActRow);
        await loadKlasifikatoriFromDb();
        statusMsg("Normatīvo aktu DB ielāde: " + (e.message || e), "error");
        return actsCache;
      } finally {
        loadPromise = null;
      }
    })();
    return loadPromise;
  }

  function fillSelect(el, options, selected, withAddNew) {
    if (!el) return;
    el.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Nav —";
    el.appendChild(empty);
    (options || []).forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      el.appendChild(o);
    });
    if (withAddNew && canEdit()) {
      const add = document.createElement("option");
      add.value = ADD_NEW;
      add.textContent = "+ Pievienot jaunu…";
      el.appendChild(add);
    }
    el.value = selected || "";
  }

  async function handleSelectAddNew(el, addFn) {
    if (!el || el.value !== ADD_NEW) return false;
    const name = window.prompt("Ievadiet jaunu vērtību:");
    if (!name || !String(name).trim()) {
      el.value = "";
      return true;
    }
    await addFn(String(name).trim());
    const prev = String(name).trim();
    refreshEditorSelects(el.id === "naVeids" ? prev : ($("naVeids") && $("naVeids").value) || "");
    if (el.id === "naVeids") $("naVeids").value = prev;
    return true;
  }

  function collectJomaOptions() {
    if (window.Joma && typeof Joma.collectAllJomas === "function") {
      return Joma.collectAllJomas().slice().sort((a, b) =>
        String(a).localeCompare(String(b), "lv", { sensitivity: "base" })
      );
    }
    return [];
  }

  function collectProcessOptions() {
    let rows = [];
    if (typeof window.getMergedProcessRegisterRows === "function") {
      rows = window.getMergedProcessRegisterRows() || [];
    } else if (typeof window.getProcessRows === "function") {
      rows = window.getProcessRows() || [];
    }
    const seen = new Set();
    const out = [];
    rows.forEach((r) => {
      const no = String((r && r.processNo) || "").trim();
      const name = String((r && r.process) || "").trim();
      if (!no && !name) return;
      const key = no + "\u0001" + name;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ processNo: no, process: name, label: no && name ? no + " — " + name : no || name });
    });
    return out.sort((a, b) =>
      String(a.label).localeCompare(String(b.label), "lv", { sensitivity: "base" })
    );
  }

  function collectGpOptions(processNo) {
    const pn = String(processNo || "").trim();
    let rows = [];
    if (typeof window.getCatalogRows === "function") rows = window.getCatalogRows() || [];
    const seen = new Set();
    const out = [];
    rows.forEach((r) => {
      const proc = String((r && r.procNo) || "").trim();
      if (pn && proc && proc.toUpperCase() !== pn.toUpperCase()) return;
      const typeNo = String((r && r.typeNo) || "").trim();
      const type = String((r && r.type) || "").trim();
      if (!typeNo && !type) return;
      const key = typeNo + "\u0001" + type;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        typeNo,
        type,
        label: typeNo && type ? typeNo + " — " + type : typeNo || type,
      });
    });
    return out.sort((a, b) =>
      String(a.label).localeCompare(String(b.label), "lv", { sensitivity: "base" })
    );
  }

  function hideNaJomaFieldInEditor() {
    const el = $("naJoma");
    if (!el) return;
    const wrap = el.closest(".form-group");
    if (wrap) wrap.style.display = "none";
    el.disabled = true;
    el.tabIndex = -1;
    el.setAttribute("aria-hidden", "true");
  }

  function jomaValueForSave() {
    if (editingId) {
      const row = findActById(editingId);
      if (row) return String(row.joma || "").trim();
    }
    return String(editorDraftJoma || "").trim();
  }

  function refreshEditorSelects(veids) {
    fillSelect($("naVeids"), allVeidi(), veids, true);
  }

  function fillProcessSelectEl(sel, selectedKey) {
    if (!sel) return;
    sel.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Nav —";
    sel.appendChild(empty);
    collectProcessOptions().forEach((p) => {
      const o = document.createElement("option");
      o.value = p.processNo + "\u0001" + p.process;
      o.textContent = p.label;
      sel.appendChild(o);
    });
    if (selectedKey) sel.value = selectedKey;
  }

  function fillGpSelectEl(sel, processKey, selectedGpKey) {
    if (!sel) return;
    const processNo = String(processKey || "").split("\u0001")[0] || "";
    sel.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Nav —";
    sel.appendChild(empty);
    collectGpOptions(processNo).forEach((g) => {
      const o = document.createElement("option");
      o.value = g.typeNo + "\u0001" + g.type;
      o.textContent = g.label;
      sel.appendChild(o);
    });
    if (selectedGpKey) sel.value = selectedGpKey;
  }

  function wireNaLinkRow(rowEl) {
    const procSel = rowEl.querySelector(".na-link-row-process");
    const gpSel = rowEl.querySelector(".na-link-row-gp");
    if (procSel && gpSel) {
      procSel.addEventListener("change", () => fillGpSelectEl(gpSel, procSel.value, ""));
    }
    const rmBtn = rowEl.querySelector(".na-link-row-remove");
    if (rmBtn) {
      rmBtn.addEventListener("click", () => {
        if (!canEdit()) return;
        rowEl.remove();
        const body = $("naLinkRowsBody");
        if (body && !body.querySelector(".na-link-row")) addNaLinkRow(null);
      });
    }
  }

  function addNaLinkRow(ref) {
    const body = $("naLinkRowsBody");
    if (!body) return;
    const r = parseGpRefItem(ref);
    const procKey = r.processNo || r.process ? (r.processNo || "") + "\u0001" + (r.process || "") : "";
    const gpKey = r.gpTypeNo || r.gp ? (r.gpTypeNo || "") + "\u0001" + (r.gp || "") : "";
    const rowEl = document.createElement("div");
    rowEl.className = "na-link-row";
    rowEl.innerHTML =
      '<div class="form-row">' +
      '<div class="form-group form-group--wide"><label>Process</label><select class="na-link-row-process"></select></div>' +
      '<div class="form-group form-group--wide"><label>Galaprodukts (GP)</label><select class="na-link-row-gp"></select></div>' +
      '<div class="form-group form-group--wide"><label>Informācija par pantu, punktu, sadaļu u.t.t.</label>' +
      '<input class="na-link-row-pants" placeholder="piem., 12. pants, 3. punkts" /></div>' +
      '<div class="form-group" style="flex:0 1 auto;min-width:96px">' +
      '<label aria-hidden="true">&nbsp;</label>' +
      '<button type="button" class="secondary na-link-row-remove">Dzēst rindu</button></div>' +
      "</div>";
    body.appendChild(rowEl);
    const procSel = rowEl.querySelector(".na-link-row-process");
    const gpSel = rowEl.querySelector(".na-link-row-gp");
    const pantsIn = rowEl.querySelector(".na-link-row-pants");
    fillProcessSelectEl(procSel, procKey);
    fillGpSelectEl(gpSel, procKey, gpKey);
    if (pantsIn) pantsIn.value = r.pantsPunkts || "";
    wireNaLinkRow(rowEl);
    if (!canEdit()) {
      rowEl.querySelectorAll("input,select,button").forEach((el) => {
        el.disabled = true;
      });
    }
  }

  function renderNaLinkRows(refs) {
    const body = $("naLinkRowsBody");
    if (!body) return;
    body.innerHTML = "";
    const list = (refs && refs.length ? refs : []).map(parseGpRefItem);
    if (!list.length) {
      addNaLinkRow(null);
      return;
    }
    list.forEach((r) => addNaLinkRow(r));
  }

  function readNaLinkRowsFromTable() {
    const body = $("naLinkRowsBody");
    if (!body) return [];
    const out = [];
    body.querySelectorAll(".na-link-row").forEach((tr) => {
      const procSel = tr.querySelector(".na-link-row-process");
      const gpSel = tr.querySelector(".na-link-row-gp");
      const pantsIn = tr.querySelector(".na-link-row-pants");
      const procVal = procSel ? String(procSel.value || "") : "";
      const gpVal = gpSel ? String(gpSel.value || "") : "";
      const parts = procVal.split("\u0001");
      const gpParts = gpVal.split("\u0001");
      const pants = pantsIn ? String(pantsIn.value || "").trim() : "";
      if (!parts[0] && !parts[1] && !gpParts[0] && !gpParts[1] && !pants) return;
      out.push(
        parseGpRefItem({
          processNo: parts[0] || "",
          process: parts[1] || "",
          gpTypeNo: gpParts[0] || "",
          gp: gpParts[1] || "",
          pantsPunkts: pants,
        })
      );
    });
    return out;
  }

  function setNaLinkRowsEditorDisabled(disabled) {
    const addBtn = $("naLinkRowsAddBtn");
    if (addBtn) addBtn.disabled = !!disabled;
    const body = $("naLinkRowsBody");
    if (body) {
      body.querySelectorAll("input,select,button").forEach((el) => {
        el.disabled = !!disabled;
      });
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function filterActs(rows) {
    const q = String(($("naSearchInput") && $("naSearchInput").value) || "")
      .trim()
      .toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.nosaukums,
        r.veids,
        r.numurs,
        r.pantsPunkts,
        r.penemsanasDatums,
        r.joma,
        r.process,
        r.processNo,
        r.gp,
        r.gpTypeNo,
        (r.gpRefs || []).map((ref) => [ref.gp, ref.gpTypeNo, ref.pantsPunkts, ref.process].join(" ")).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  function renderTable() {
    const tbody = $("naTable") && $("naTable").querySelector("tbody");
    if (!tbody) return;
    const rows = filterActs(loadActs()).sort((a, b) =>
      String(a.nosaukums || "").localeCompare(String(b.nosaukums || ""), "lv", { sensitivity: "base" })
    );
    tbody.innerHTML = "";
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.className = "hint";
      td.textContent = "Nav ierakstu. Pievienojiet jaunu normatīvo aktu.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    const editMode = canEdit();
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const procLabel = r.processNo && r.process ? r.processNo + " — " + r.process : r.process || r.processNo || "";
      const gpParts = (r.gpRefs || []).map(gpRefSummaryLabel).filter(Boolean);
      const gpLabel =
        gpParts.length > 0
          ? gpParts.join("; ")
          : r.gpTypeNo && r.gp
            ? r.gpTypeNo + " — " + r.gp
            : r.gp || r.gpTypeNo || "";
      tr.innerHTML =
        `<td>${escapeHtml(r.veids)}</td>` +
        `<td>${escapeHtml(r.nosaukums)}</td>` +
        `<td>${escapeHtml(r.numurs)}</td>` +
        `<td>${escapeHtml(
          (r.gpRefs || []).map((x) => x.pantsPunkts).filter(Boolean).join("; ") || r.pantsPunkts
        )}</td>` +
        `<td>${escapeHtml(formatPenemsanasDatumsDisplay(r.penemsanasDatums))}</td>` +
        `<td>${escapeHtml(r.joma)}</td>` +
        `<td>${escapeHtml(procLabel)}</td>` +
        `<td>${escapeHtml(gpLabel)}</td>`;
      const tdAct = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = openActLabel(editMode);
      btn.onclick = () => openEditor(r.id);
      tdAct.appendChild(btn);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    const countEl = $("naCountHint");
    if (countEl) countEl.textContent = "Kopā: " + rows.length + " akti";
  }

  function readForm() {
    const gpRefs = readNaLinkRowsFromTable();
    const base = normalizeActRow({
      id: editingId || "",
      nosaukums: $("naNosaukums") && $("naNosaukums").value,
      pantsPunkts: "",
      veids: $("naVeids") && $("naVeids").value,
      numurs: $("naNumurs") && $("naNumurs").value,
      penemsanasDatums: $("naPenemsanasDatums") && $("naPenemsanasDatums").value,
      joma: jomaValueForSave(),
    });
    return applyGpRefsToAct(base, gpRefs);
  }

  function fillForm(row) {
    const r = normalizeActRow(row);
    editorDraftJoma = String(r.joma || "").trim();
    if ($("naNosaukums")) $("naNosaukums").value = r.nosaukums || "";
    if ($("naNumurs")) $("naNumurs").value = r.numurs || "";
    if ($("naPenemsanasDatums")) {
      $("naPenemsanasDatums").value = normalizePenemsanasDatums(r.penemsanasDatums) || "";
    }
    refreshEditorSelects(r.veids || "");
    renderNaLinkRows(r.gpRefs);
    hideNaJomaFieldInEditor();
  }

  function clearBasicsFields() {
    if (!canEdit()) return;
    if ($("naVeids")) $("naVeids").value = "";
    if ($("naNosaukums")) $("naNosaukums").value = "";
    if ($("naNumurs")) $("naNumurs").value = "";
    if ($("naPenemsanasDatums")) $("naPenemsanasDatums").value = "";
  }

  function setEditorDisabled(disabled) {
    const form = $("normActEditorForm");
    if (!form) return;
    const keepEnabled = new Set(["naCloseBtn"]);
    form.querySelectorAll("input,select,textarea,button").forEach((el) => {
      if (keepEnabled.has(el.id)) return;
      el.disabled = !!disabled;
    });
    const submitBtn = $("naSaveBtn") || form.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.classList.toggle("hidden", disabled);
    if ($("naClearBasicsBtn")) {
      $("naClearBasicsBtn").classList.toggle("hidden", disabled);
      $("naClearBasicsBtn").disabled = !!disabled;
    }
    if ($("naDeleteBtn")) {
      const showDelete = !disabled && !!editingId && canEdit();
      $("naDeleteBtn").classList.toggle("hidden", !showDelete);
      $("naDeleteBtn").disabled = !showDelete;
    }
    setNaLinkRowsEditorDisabled(disabled);
  }

  function showNaEditorCard() {
    const card = $("normActEditorCard");
    if (!card) return;
    card.classList.remove("hidden");
    card.classList.remove("nav-page-hidden");
    hideNaJomaFieldInEditor();
  }

  function hideNaEditorCard() {
    const card = $("normActEditorCard");
    if (card) card.classList.add("hidden");
  }

  function findActById(id) {
    const sid = String(id || "").trim();
    if (!sid) return null;
    return loadActs().find((x) => String(x.id) === sid) || null;
  }

  function captureReturnFromEmbedded() {
    if ($("editorCard") && !$("editorCard").classList.contains("hidden")) {
      $("editorCard").classList.add("hidden");
      returnContext = { type: "process" };
      return;
    }
    if ($("catalogEditorCard") && !$("catalogEditorCard").classList.contains("hidden")) {
      if (window.KartinaInline && typeof window.KartinaInline.markCatalogNaContext === "function") {
        window.KartinaInline.markCatalogNaContext();
        returnContext = { type: "catalog" };
        return;
      }
      $("catalogEditorCard").classList.add("hidden");
      returnContext = { type: "catalog" };
      return;
    }
    if ($("jomaEditorCard") && !$("jomaEditorCard").classList.contains("hidden")) {
      $("jomaEditorCard").classList.add("hidden");
      returnContext = { type: "joma" };
      return;
    }
    returnContext = { type: "list" };
    if ($("normActsCard")) $("normActsCard").classList.add("hidden");
  }

  function restoreAfterClose() {
    editingId = null;
    hideNaEditorCard();
    const ctx = returnContext;
    returnContext = null;
    if (!ctx || ctx.type === "list") {
      const list = $("normActsCard");
      if (list) {
        list.classList.remove("hidden");
        list.classList.remove("nav-page-hidden");
      }
      render();
      return;
    }
    if (ctx.type === "process") {
      $("editorCard")?.classList.remove("hidden");
      renderProcessLinks(elVal("eProcNo"), { process: elVal("eProcess") });
    } else if (ctx.type === "catalog") {
      if (window.KartinaInline && typeof window.KartinaInline.undockCatalogNaEditor === "function") {
        window.KartinaInline.undockCatalogNaEditor();
      }
      window.__naInlineInCatalogCard = false;
      $("catalogEditorCard")?.classList.remove("hidden");
      renderCatalogLinks();
    } else if (ctx.type === "joma") {
      $("jomaEditorCard")?.classList.remove("hidden");
      renderJomaLinks(elVal("jJomaName"));
    }
  }

  function isNaDbUnavailable(err) {
    const msg = String((err && err.message) || err || "").toLowerCase();
    const code = err && err.code ? String(err.code) : "";
    return (
      code === "PGRST205" ||
      code === "42P01" ||
      msg.includes("could not find the table") ||
      msg.includes("schema cache") ||
      msg.includes("does not exist")
    );
  }

  function saveActsLocalFromForm(data) {
    const acts = loadActsLocal();
    const now = new Date().toISOString();
    if (editingId) {
      const idx = acts.findIndex((x) => String(x.id) === String(editingId));
      if (idx >= 0) acts[idx] = Object.assign({}, acts[idx], data, { updatedAt: now });
    } else {
      acts.push(Object.assign({ id: "na_" + Date.now(), createdAt: now, updatedAt: now }, data));
    }
    saveJson(STORAGE_ACTS, acts);
    actsCache = acts.map(normalizeActRow);
  }

  function actBaseTitle(act) {
    const parts = [];
    if (act.veids) parts.push(act.veids);
    if (act.nosaukums) parts.push(act.nosaukums);
    if (act.numurs) parts.push("Nr. " + act.numurs);
    if (act.penemsanasDatums) parts.push("(" + formatPenemsanasDatumsDisplay(act.penemsanasDatums) + ")");
    return parts.length ? parts.join(" ") : "—";
  }

  function actPickLabel(act) {
    const parts = [actBaseTitle(act)];
    const refs = parseGpRefsFromRaw(act);
    if (refs.length === 1 && refs[0].pantsPunkts) {
      parts.push("(" + refs[0].pantsPunkts + ")");
    } else if (!refs.length && act.pantsPunkts) {
      parts.push("(" + act.pantsPunkts + ")");
    }
    return parts.join(" ");
  }

  function actLinkedToProcess(act, pNo, pName) {
    if (pNo && processNoKey(act.processNo) === processNoKey(pNo)) return true;
    if (pName && normKey(act.process) === normKey(pName)) return true;
    if (gpRefsForProcess(act, pNo, pName).length) return true;
    return false;
  }

  function actLinkedToGp(act, ctx) {
    if (parseGpRefsFromRaw(act).some((r) => gpRefMatchesCtx(r, ctx))) return true;
    const procNo = String(ctx.procNo || "").trim();
    const gpTypeNo = String(ctx.gpTypeNo || "").trim();
    const gp = String(ctx.gp || "").trim();
    if (gpTypeNo && String(act.gpTypeNo || "").trim().toUpperCase() === gpTypeNo.toUpperCase()) {
      if (!procNo || processNoKey(act.processNo) === processNoKey(procNo)) return true;
    }
    if (gp && normKey(act.gp) === normKey(gp)) {
      if (!procNo || processNoKey(act.processNo) === processNoKey(procNo)) return true;
    }
    return false;
  }

  function actLinkedToJoma(act, joma, procNosInJoma) {
    if (!joma) return false;
    if (normKey(act.joma) === normKey(joma)) return true;
    if (act.processNo && procNosInJoma && procNosInJoma.has(processNoKey(act.processNo))) return true;
    return false;
  }

  function ensureAttachWrap(btnId, wrapId) {
    const btn = $(btnId);
    if (!btn) return null;
    let wrap = $(wrapId);
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = wrapId;
      wrap.className = "na-attach-wrap";
      wrap.style.marginTop = "8px";
      btn.parentNode.insertBefore(wrap, btn.nextSibling);
    }
    return wrap;
  }

  async function applyNaLinkChange(act, cfg, pickMount, shouldLink) {
    if (!canEdit() || (cfg.canLink && !cfg.canLink())) return false;
    const rowData = findActById(act.id) || act;
    if (shouldLink) {
      const patch =
        typeof cfg.getLinkPatch === "function" ? cfg.getLinkPatch(rowData) : cfg.getLinkPatch;
      let data;
      if (patch && Array.isArray(patch.gpRefs)) {
        data = normalizeActRow(Object.assign({}, rowData, patch));
      } else {
        data = normalizeActRow(Object.assign({}, rowData, patch || {}));
      }
      await persistActUpdate(act.id, data);
    } else {
      await persistActUpdate(act.id, cfg.getUnlinkData(rowData));
    }
    try {
      await loadFromDb(true);
    } catch (_) {}
    statusMsg(
      shouldLink
        ? cfg.linkOkMsg || "Normatīvais akts saistīts."
        : cfg.unlinkOkMsg || "Normatīvais akts noņemts no kartiņas.",
      "ok"
    );
    if (pickMount) pickMount.dataset.naPickOpen = pickMount.style.display !== "none" ? "1" : "0";
    if (typeof cfg.refresh === "function") cfg.refresh();
    return true;
  }

  function renderNaLinkedSummary(mountEl, acts, editMode, cfg, pickMount) {
    if (!mountEl) return;
    mountEl.innerHTML = "";
    mountEl.classList.add("na-linked-list");
    if (!acts.length) {
      const empty = document.createElement("div");
      empty.className = "na-empty-msg";
      empty.textContent = "Nav piesaistītu normatīvo aktu.";
      mountEl.appendChild(empty);
      return;
    }
    acts.forEach((act) => {
      const line = document.createElement("div");
      line.className = "na-linked-item";
      line.style.flexDirection = "column";
      line.style.alignItems = "flex-start";
      const head = document.createElement("div");
      head.style.display = "flex";
      head.style.flexWrap = "wrap";
      head.style.alignItems = "center";
      head.style.gap = "6px";
      const labelText = cfg && cfg.actTitle ? cfg.actTitle(act) : actPickLabel(act);
      const span = document.createElement("span");
      span.textContent = labelText;
      head.appendChild(span);
      const detailText = cfg && cfg.actDetail ? cfg.actDetail(act) : "";
      if (detailText) {
        const sub = document.createElement("div");
        sub.className = "hint";
        sub.style.margin = "2px 0 0 0";
        sub.textContent = detailText;
        line.appendChild(head);
        line.appendChild(sub);
      } else {
        line.appendChild(head);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = openActLabel(editMode);
      btn.onclick = () => {
        captureReturnFromEmbedded();
        openEditor(act.id, { skipCapture: true });
      };
      head.appendChild(btn);
      if (editMode && cfg) {
        const rm = document.createElement("button");
        rm.type = "button";
        rm.className = "secondary";
        rm.textContent = "Noņemt";
        rm.title = "Noņemt saiti ar šo kartiņu";
        rm.onclick = async () => {
          rm.disabled = true;
          try {
            await applyNaLinkChange(act, cfg, pickMount, false);
          } catch (err) {
            console.error("NormAkti unlink:", err);
            window.alert("Neizdevās noņemt normatīvo aktu: " + (err.message || err));
            rm.disabled = false;
          }
        };
        head.appendChild(rm);
      }
      mountEl.appendChild(line);
    });
  }

  function renderNaAttachUi(summaryMount, pickMount, addBtn, cfg) {
    if (!pickMount) return;
    const all = loadActs()
      .slice()
      .sort((a, b) => actPickLabel(a).localeCompare(actPickLabel(b), "lv", { sensitivity: "base" }));
    const linked = all.filter((a) => cfg.isLinked(a));
    const editMode = canEdit();
    const canLink = !cfg.canLink || cfg.canLink();

    renderNaLinkedSummary(summaryMount, linked, editMode, cfg, pickMount);

    const procCardNa = addBtn && addBtn.id === "eAddNaBtn";
    if (addBtn) {
      addBtn.textContent = "Pievienot normatīvo aktu";
      addBtn.classList.remove("hidden");
      addBtn.style.display = editMode ? "" : "none";
      addBtn.disabled = !canLink;
      addBtn.title = canLink ? "" : cfg.blockedMsg || "";
      addBtn.onclick = () => {
        if (!canEdit()) return;
        if (cfg.canLink && !cfg.canLink()) {
          window.alert(
            cfg.blockedMsg ||
              (procCardNa
                ? "Norādiet kartiņas datus, lai varētu saistīt normatīvo aktu."
                : "Norādiet kartiņas datus, lai varētu saistīt normatīvo aktu.")
          );
          return;
        }
        const open = pickMount.style.display === "none" || !pickMount.style.display;
        pickMount.dataset.naPickOpen = open ? "1" : "0";
        pickMount.style.display = open ? "block" : "none";
        addBtn.setAttribute("aria-expanded", open ? "true" : "false");
      };
    }

    const pickOpen = pickMount.dataset.naPickOpen === "1";
    pickMount.style.display = pickOpen ? "block" : "none";
    pickMount.innerHTML = "";
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.style.marginBottom = "6px";
    hint.textContent = procCardNa
      ? "Atzīmējiet normatīvos aktus, ko saistīt ar šo kartiņu (jaunu pievieno sadaļā «Procesus reglamentējoši normatīvie akti»):"
      : "Atzīmējiet normatīvos aktus, ko saistīt ar šo kartiņu (jaunu pievieno sadaļā «Procesus reglamentējoši normatīvie akti»):";
    pickMount.appendChild(hint);

    if (!all.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = procCardNa
        ? "Nav reģistrētu normatīvo aktu — vispirms pievienojiet sadaļā «Procesus reglamentējoši normatīvie akti»."
        : "Nav reģistrētu normatīvo aktu — vispirms pievienojiet sadaļā «Procesus reglamentējoši normatīvie akti».";
      pickMount.appendChild(empty);
      return;
    }

    if (!canLink && editMode) {
      const warn = document.createElement("div");
      warn.className = "hint";
      warn.textContent =
        cfg.blockedMsg ||
        (procCardNa
          ? "Norādiet kartiņas datus, lai varētu saistīt normatīvo aktu."
          : "Norādiet kartiņas datus, lai varētu saistīt normatīvo aktu.");
      pickMount.appendChild(warn);
    }

    const list = document.createElement("div");
    list.className = "na-check-list";
    list.style.maxHeight = "220px";
    list.style.overflowY = "auto";
    list.style.padding = "6px 8px";
    list.style.border = "1px solid #cbd5e1";
    list.style.borderRadius = "8px";
    list.style.background = "#fff";

    all.forEach((act) => {
      const row = document.createElement("label");
      row.style.display = "flex";
      row.style.alignItems = "flex-start";
      row.style.gap = "8px";
      row.style.marginBottom = "6px";
      row.style.cursor = editMode && canLink ? "pointer" : "default";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = cfg.isLinked(act);
      cb.disabled = !editMode || !canLink;
      cb.style.marginTop = "3px";
      cb.addEventListener("change", async () => {
        if (!canEdit() || (cfg.canLink && !cfg.canLink())) {
          cb.checked = !cb.checked;
          return;
        }
        cb.disabled = true;
        try {
          await applyNaLinkChange(act, cfg, pickMount, cb.checked);
        } catch (err) {
          console.error("NormAkti link toggle:", err);
          cb.checked = !cb.checked;
          window.alert("Neizdevās mainīt saiti: " + (err.message || err));
        } finally {
          cb.disabled = !canEdit() || !(cfg.canLink ? cfg.canLink() : true);
        }
      });

      const text = document.createElement("span");
      text.style.flex = "1";
      text.textContent = actPickLabel(act);

      row.appendChild(cb);
      row.appendChild(text);
      list.appendChild(row);
    });
    pickMount.appendChild(list);
  }

  function wireAttachBlocks() {
    ensureAttachWrap("eAddNaBtn", "eNaAttachWrap");
    ensureAttachWrap("cAddNaBtn", "cNaAttachWrap");
    ensureAttachWrap("jAddNaBtn", "jNaAttachWrap");
  }

  async function persistActUpdate(id, data) {
    const api = window.DB;
    const sid = String(id || "").trim();
    const localId = !sid || sid.startsWith("na_") || sid === "id";
    if (!localId && api && typeof api.updateNormAct === "function") {
      try {
        const res = await api.updateNormAct(sid, data);
        if (res != null) return res;
      } catch (e) {
        if (!isNaDbUnavailable(e)) throw e;
      }
    }
    const acts = loadActsLocal();
    const idx = acts.findIndex((x) => String(x.id) === sid);
    const now = new Date().toISOString();
    if (idx >= 0) {
      acts[idx] = Object.assign({}, acts[idx], data, { updatedAt: now });
    } else {
      acts.push(Object.assign({ id: sid || "na_" + Date.now(), createdAt: now, updatedAt: now }, data));
    }
    saveJson(STORAGE_ACTS, acts);
    actsCache = acts.map(normalizeActRow);
    return actsCache.find((x) => String(x.id) === sid) || null;
  }

  function refreshProcessLinksFromEditor() {
    renderProcessLinks(elVal("eProcNo"), { process: elVal("eProcess") });
  }

  function renderLinkedList(mountEl, acts) {
    if (!mountEl) return;
    mountEl.innerHTML = "";
    const editMode = canEdit();
    if (!acts.length) {
      mountEl.textContent = "Nav piesaistītu normatīvo aktu.";
      return;
    }
    acts.forEach((act) => {
      const line = document.createElement("div");
      line.style.marginBottom = "6px";
      line.style.display = "flex";
      line.style.flexWrap = "wrap";
      line.style.alignItems = "center";
      line.style.gap = "6px";
      const parts = [act.nosaukums];
      if (act.pantsPunkts) parts.push("(" + act.pantsPunkts + ")");
      if (act.numurs) parts.push("Nr. " + act.numurs);
      const labelText = parts.filter(Boolean).join(" ") || "—";
      const span = document.createElement("span");
      span.textContent = labelText;
      line.appendChild(span);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = openActLabel(editMode);
      btn.onclick = () => {
        captureReturnFromEmbedded();
        openEditor(act.id, { skipCapture: true });
      };
      line.appendChild(btn);
      mountEl.appendChild(line);
    });
  }

  function renderProcessLinks(procNo, processRow) {
    wireAttachBlocks();
    const pNo = String(procNo || "").trim();
    const pName = String((processRow && processRow.process) || elVal("eProcess")).trim();
    renderNaAttachUi($("eNaActions"), $("eNaAttachWrap"), $("eAddNaBtn"), {
      isLinked: (act) => actLinkedToProcess(act, pNo, pName),
      canLink: () => !!(pNo || pName),
      blockedMsg: "Norādiet procesa nosaukumu vai Nr.",
      linkOkMsg: "Normatīvais akts saistīts.",
      unlinkOkMsg: "Normatīvais akts noņemts no kartiņas.",
      actTitle: (act) => actBaseTitle(act),
      actDetail: (act) => {
        const refs = gpRefsForProcess(act, pNo, pName);
        if (refs.length) {
          return refs
            .map((r) => {
              const gpLbl = r.gpTypeNo && r.gp ? r.gpTypeNo + " — " + r.gp : r.gp || r.gpTypeNo || "GP";
              const pp = r.pantsPunkts || act.pantsPunkts;
              return pp ? gpLbl + ": " + pp : gpLbl;
            })
            .join(" · ");
        }
        if (act.pantsPunkts) return "Pants / punkts: " + act.pantsPunkts;
        return "";
      },
      getLinkPatch: () => ({ processNo: pNo, process: pName }),
      getUnlinkData: (act) => {
        let refs = parseGpRefsFromRaw(act).filter((r) => !processRefMatches(r, pNo, pName));
        let next = applyGpRefsToAct(act, refs);
        if (processNoKey(next.processNo) === processNoKey(pNo) || normKey(next.process) === normKey(pName)) {
          next = normalizeActRow(Object.assign({}, next, { processNo: "", process: "" }));
          next = applyGpRefsToAct(next, refs);
        }
        return next;
      },
      refresh: refreshProcessLinksFromEditor,
    });
  }

  function renderCatalogLinks() {
    wireAttachBlocks();
    const procNo = elVal("cProcNo");
    const process = elVal("cProcess");
    const gpTypeNo = elVal("cTypeNo");
    const gp = elVal("cType");
    const joma = elVal("cDarbibasJoma");
    const ctx = { procNo, gpTypeNo, gp };
    renderNaAttachUi($("cNaActions"), $("cNaAttachWrap"), $("cAddNaBtn"), {
      isLinked: (act) => actLinkedToGp(act, ctx),
      canLink: () => !!(gpTypeNo || gp || procNo || process),
      blockedMsg: "Norādiet galaprodukta nosaukumu vai Nr.",
      actTitle: (act) => actBaseTitle(act),
      actDetail: (act) => {
        const ref = findGpRefForCtx(act, ctx);
        const pp = (ref && ref.pantsPunkts) || act.pantsPunkts;
        if (pp) return "Attiecas: " + pp;
        return "Norādiet pantu/punktu normatīvā akta kartiņā (2. sadaļa).";
      },
      getLinkPatch: (act) => {
        const merged = Object.assign({}, act, { processNo: procNo, process, joma });
        let refs = parseGpRefsFromRaw(merged);
        const newRef = parseGpRefItem({ processNo: procNo, process, gpTypeNo, gp, pantsPunkts: "" });
        const idx = refs.findIndex((r) => gpRefMatchesCtx(r, ctx));
        if (idx >= 0) refs[idx] = Object.assign({}, refs[idx], newRef);
        else refs.push(newRef);
        return applyGpRefsToAct(merged, refs);
      },
      getUnlinkData: (act) => {
        if (!actLinkedToGp(act, ctx)) return normalizeActRow(act);
        const refs = parseGpRefsFromRaw(act).filter((r) => !gpRefMatchesCtx(r, ctx));
        return applyGpRefsToAct(act, refs);
      },
      refresh: refreshCatalogLinksFromEditor,
    });
  }

  function refreshCatalogLinksFromEditor() {
    renderCatalogLinks();
  }

  function renderJomaLinks(jomaName) {
    wireAttachBlocks();
    const joma = String(jomaName || "").trim();
    const procNosInJoma = collectProcessNosForJoma(joma);
    renderNaAttachUi($("jNaActions"), $("jNaAttachWrap"), $("jAddNaBtn"), {
      isLinked: (act) => actLinkedToJoma(act, joma, procNosInJoma),
      canLink: () => !!joma,
      blockedMsg: "Norādiet jomas nosaukumu.",
      getLinkPatch: () => ({ joma }),
      getUnlinkData: (act) => {
        if (!actLinkedToJoma(act, joma, procNosInJoma)) return normalizeActRow(act);
        const patch = {};
        if (normKey(act.joma) === normKey(joma)) patch.joma = "";
        if (act.processNo && procNosInJoma.has(processNoKey(act.processNo))) {
          patch.processNo = "";
          patch.process = "";
          patch.gpTypeNo = "";
          patch.gp = "";
        }
        return normalizeActRow(Object.assign({}, act, patch));
      },
      refresh: () => renderJomaLinks(elVal("jJomaName") || joma),
    });
  }

  function openEditorWithContext(ctx, id) {
    if (!id && !canEdit()) {
      window.alert("Pievienošana pieejama tikai administratoram (labot).");
      return;
    }
    captureReturnFromEmbedded();
    editingId = id || null;
    showNaEditorCard();
    const row = editingId ? findActById(editingId) : null;
    if ($("naEditorTitle")) {
      if (row) {
        $("naEditorTitle").textContent = "Normatīvā akta kartiņa — " + NA_TITLE;
      } else if (ctx && ctx.gp) {
        $("naEditorTitle").textContent = "Jauns normatīvais akts (galaprodukts)";
      } else if (ctx && ctx.process) {
        $("naEditorTitle").textContent = "Jauns normatīvais akts (process)";
      } else if (ctx && ctx.joma) {
        $("naEditorTitle").textContent = "Jauns normatīvais akts (joma)";
      } else {
        $("naEditorTitle").textContent = "Jauns normatīvais akts";
      }
    }
    fillForm(row || ctx || {});
    setEditorDisabled(!canEdit());
    const card = $("normActEditorCard");
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.pvHistoryPush) {
      let sec = "normActsCard";
      if (ctx && ctx.process) sec = "processListCard";
      else if (ctx && ctx.catalog) sec = "catalogListCard";
      else if (ctx && ctx.joma) sec = "processJomasCard";
      window.pvHistoryPush(sec, "normAct");
    }
  }

  function openEditor(id, opts) {
    opts = opts || {};
    if (!opts.skipCapture) captureReturnFromEmbedded();
    editingId = id || null;
    showNaEditorCard();
    const row = editingId ? findActById(editingId) : null;
    if ($("naEditorTitle")) {
      $("naEditorTitle").textContent = row
        ? "Normatīvā akta kartiņa — " + NA_TITLE
        : "Jauns normatīvais akts";
    }
    fillForm(row || {});
    setEditorDisabled(!canEdit());
    const card = $("normActEditorCard");
    if (card && card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" });
    if (window.pvHistoryPush) window.pvHistoryPush("normActsCard", "normAct");
  }

  function closeEditor() {
    if (window.pvHistoryTryBack && window.pvHistoryTryBack("normAct")) return;
    restoreAfterClose();
  }

  async function saveForm(e) {
    if (e) e.preventDefault();
    if (!canEdit()) return;
    if (await handleSelectAddNew($("naVeids"), addCustomVeids)) return;
    const data = readForm();
    if (!data.nosaukums) {
      window.alert("Ievadiet normatīvā akta nosaukumu.");
      return;
    }
    const api = window.DB;
    try {
      let savedToDb = false;
      if (api && typeof api.insertNormAct === "function") {
        try {
          let result = null;
          const localId =
            !editingId ||
            String(editingId).startsWith("na_") ||
            String(editingId).trim() === "id";
          if (editingId && !localId) {
            result = await api.updateNormAct(editingId, data);
          } else {
            result = await api.insertNormAct(data);
          }
          if (result != null) {
            await loadFromDb(true);
            savedToDb = true;
            statusMsg("Normatīvais akts saglabāts.", "ok");
          }
        } catch (dbErr) {
          if (!isNaDbUnavailable(dbErr)) throw dbErr;
        }
      }
      if (!savedToDb) {
        saveActsLocalFromForm(data);
        statusMsg(
          api && typeof api.insertNormAct === "function"
            ? "Saglabāts lokāli (normatīvo aktu tabula DB vēl nav — palaidiet migrāciju Supabase SQL Editor)."
            : "Saglabāts lokāli (DB nav pieejams).",
          "info"
        );
      }
      closeEditor();
    } catch (err) {
      console.error("NormAkti save:", err);
      statusMsg("Kļūda saglabājot: " + (err.message || err), "error");
      window.alert("Neizdevās saglabāt: " + (err.message || err));
    }
  }

  async function deleteAct() {
    if (!canEdit() || !editingId) return;
    if (!window.confirm("Vai dzēst šo normatīvā akta kartiņu no reģistra? Darbību nevar atsaukt.")) return;
    const api = window.DB;
    try {
      if (api && typeof api.deleteNormAct === "function") {
        await api.deleteNormAct(editingId);
        await loadFromDb(true);
        statusMsg("Normatīvais akts dzēsts.", "ok");
      } else {
        const acts = loadActsLocal().filter((x) => String(x.id) !== String(editingId));
        saveJson(STORAGE_ACTS, acts);
        actsCache = acts.map(normalizeActRow);
      }
      closeEditor();
    } catch (err) {
      console.error("NormAkti delete:", err);
      statusMsg("Kļūda dzēšot: " + (err.message || err), "error");
    }
  }

  function wireOnce() {
    if (wireOnce.done) return;
    wireOnce.done = true;
    hideNaJomaFieldInEditor();

    if ($("naNewBtn")) {
      $("naNewBtn").onclick = () => {
        if (!canEdit()) {
          window.alert("Pievienošana pieejama tikai administratoram (labot).");
          return;
        }
        openEditor(null);
      };
    }
    if ($("naCloseBtn")) $("naCloseBtn").onclick = closeEditor;
    if ($("naDeleteBtn")) $("naDeleteBtn").onclick = () => { deleteAct(); };
    if ($("naClearBasicsBtn")) {
      $("naClearBasicsBtn").addEventListener("click", () => {
        if (!canEdit()) return;
        if (
          window.confirm(
            "Notīrīt 1. sadaļas laukus (veids, nosaukums, numurs, pieņemšanas datums)?"
          )
        ) {
          clearBasicsFields();
        }
      });
    }
    if ($("normActEditorForm")) $("normActEditorForm").onsubmit = saveForm;
    if ($("naSearchInput")) {
      $("naSearchInput").addEventListener("input", renderTable);
    }
    if ($("naVeids")) {
      $("naVeids").addEventListener("change", () => { handleSelectAddNew($("naVeids"), addCustomVeids); });
    }
    if ($("naLinkRowsAddBtn")) {
      $("naLinkRowsAddBtn").addEventListener("click", () => {
        if (!canEdit()) return;
        addNaLinkRow(null);
      });
    }
    wireAttachBlocks();

    ["eProcess", "eProcNo"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("input", refreshProcessLinksFromEditor);
        el.addEventListener("change", refreshProcessLinksFromEditor);
      }
    });

    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      const source = ev && ev.detail ? ev.detail.source : "";
      if (source === "html") return;
      if (kind === "all" || kind === "normAkti") {
        const editorOpen = !!($("normActEditorCard") && !$("normActEditorCard").classList.contains("hidden"));
        if (!editorOpen) {
          loadFromDb(true).then(() => renderTable());
        }
      }
    });
  }

  async function render() {
    wireOnce();
    wireAttachBlocks();
    await loadFromDb(false);
    renderTable();
    const newBtn = $("naNewBtn");
    if (newBtn) newBtn.disabled = !canEdit();
  }

  function boot() {
    wireOnce();
    wireAttachBlocks();
  }

  window.NormAkti = {
    render,
    boot,
    loadActs,
    loadFromDb,
    openEditor,
    openEditorWithContext,
    renderProcessLinks,
    renderCatalogLinks,
    renderJomaLinks,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
