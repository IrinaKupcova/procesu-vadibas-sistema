/* Procesus reglamentējoši normatīvie akti (NA) — uzskaites bloks (Supabase + localStorage rezerve). */
(function () {
  "use strict";

  const NA_TITLE = "Procesus reglamentējoši normatīvie akti (NA)";
  const STORAGE_ACTS = "pv_norm_akti_v1";
  const STORAGE_VEIDI = "pv_norm_akti_veidi_v1";
  const STORAGE_INST = "pv_norm_akti_inst_v1";
  const MIGRATED_FLAG = "pv_norm_akti_db_migrated_v1";

  const DEFAULT_VEIDI = [
    "Likums",
    "MK noteikumi",
    "ES regula",
    "VID iekšējais normatīvais akts",
    "Cits",
  ];
  const DEFAULT_INST = ["FM", "MK", "VID", "ES"];
  const DEFAULT_STATUSI = ["aktuāls", "spēku zaudējis", "daļēji spēkā", "projekts"];

  const ADD_NEW = "__add_new__";

  let editingId = null;
  let actsCache = [];
  let customVeidiCache = [];
  let customInstCache = [];
  let loadPromise = null;
  /** Atgriešanās konteksts pēc NA redaktora aizvēršanas: process | catalog | joma | list */
  let returnContext = null;

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

  function normalizeActUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return "https://" + u;
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
        if (String(r.gpTypeNo || "").trim().toUpperCase() !== String(f.gpTypeNo).trim().toUpperCase()) {
          return false;
        }
      }
      if (f.gp && normKey(r.gp) !== normKey(f.gp)) return false;
      return true;
    });
  }

  function canEdit() {
    const rs = $("roleSelect");
    return rs && rs.value === "admin_edit";
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

  function loadCustomInstLocal() {
    const arr = loadJson(STORAGE_INST, []);
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

  function allInstitucijas() {
    const seen = new Set();
    const out = [];
    DEFAULT_INST.concat(customInstCache).forEach((v) => {
      const s = String(v || "").trim();
      if (!s || seen.has(s.toUpperCase())) return;
      seen.add(s.toUpperCase());
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

  async function addCustomInst(name) {
    const s = String(name || "").trim();
    if (!s || allInstitucijas().some((x) => x.toUpperCase() === s.toUpperCase())) return;
    customInstCache.push(s);
    saveJson(STORAGE_INST, customInstCache);
    const api = window.DB;
    if (api && typeof api.upsertNormActKlasifikators === "function") {
      try {
        await api.upsertNormActKlasifikators("institucija", s);
      } catch (e) {
        console.warn("NormAkti institucija DB:", e);
      }
    }
  }

  async function loadKlasifikatoriFromDb() {
    const api = window.DB;
    if (!api || typeof api.loadNormActKlasifikatori !== "function") {
      customVeidiCache = loadCustomVeidiLocal();
      customInstCache = loadCustomInstLocal();
      return;
    }
    try {
      const k = await api.loadNormActKlasifikatori();
      customVeidiCache = Array.isArray(k.veidi) ? k.veidi.slice() : [];
      customInstCache = Array.isArray(k.institucijas) ? k.institucijas.slice() : [];
      saveJson(STORAGE_VEIDI, customVeidiCache);
      saveJson(STORAGE_INST, customInstCache);
    } catch (e) {
      console.warn("NormAkti klasifikatori DB:", e);
      customVeidiCache = loadCustomVeidiLocal();
      customInstCache = loadCustomInstLocal();
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

  function normalizeActRow(r) {
    const x = r || {};
    let veids = normalizeVeids(x.veids);
    let institucija = String(x.institucija || "").trim();
    if (veids === ADD_NEW) veids = "";
    if (institucija === ADD_NEW) institucija = "";
    return {
      id: String(x.id || ""),
      nosaukums: String(x.nosaukums || "").trim(),
      veids: veids,
      numurs: String(x.numurs || "").trim(),
      pantsPunkts: String(x.pantsPunkts || x.pants_punkts || "").trim(),
      institucija: institucija,
      links: String(x.links || "").trim(),
      statuss: String(x.statuss || "").trim(),
      joma: String(x.joma || "").trim(),
      processNo: String(x.processNo || "").trim(),
      process: String(x.process || "").trim(),
      gpTypeNo: String(x.gpTypeNo || "").trim(),
      gp: String(x.gp || "").trim(),
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
    refreshEditorSelects(
      el.id === "naVeids" ? prev : ($("naVeids") && $("naVeids").value) || "",
      el.id === "naInstitucija" ? prev : ($("naInstitucija") && $("naInstitucija").value) || "",
      $("naProcess") ? $("naProcess").value : "",
      $("naGp") ? $("naGp").value : "",
      $("naStatuss") ? $("naStatuss").value : "aktuāls"
    );
    if (el.id === "naVeids") $("naVeids").value = prev;
    if (el.id === "naInstitucija") $("naInstitucija").value = prev;
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

  function refreshEditorSelects(veids, institucija, processKey, gpKey, statuss) {
    fillSelect($("naVeids"), allVeidi(), veids, true);
    fillSelect($("naInstitucija"), allInstitucijas(), institucija, true);
    fillSelect($("naStatuss"), DEFAULT_STATUSI, statuss || "aktuāls", false);

    const jomaEl = $("naJoma");
    if (jomaEl) {
      const jomas = collectJomaOptions();
      fillSelect(jomaEl, jomas, jomaEl.value, false);
    }

    const procEl = $("naProcess");
    if (procEl) {
      procEl.innerHTML = "";
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "— Nav —";
      procEl.appendChild(empty);
      collectProcessOptions().forEach((p) => {
        const o = document.createElement("option");
        o.value = p.processNo + "\u0001" + p.process;
        o.textContent = p.label;
        procEl.appendChild(o);
      });
      if (processKey) procEl.value = processKey;
    }

    refreshGpSelect(gpKey);
  }

  function refreshGpSelect(gpKey) {
    const gpEl = $("naGp");
    const procEl = $("naProcess");
    if (!gpEl) return;
    const pk = procEl ? String(procEl.value || "") : "";
    const processNo = pk.split("\u0001")[0] || "";
    gpEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Nav —";
    gpEl.appendChild(empty);
    collectGpOptions(processNo).forEach((g) => {
      const o = document.createElement("option");
      o.value = g.typeNo + "\u0001" + g.type;
      o.textContent = g.label;
      gpEl.appendChild(o);
    });
    if (gpKey) gpEl.value = gpKey;
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
        r.institucija,
        r.statuss,
        r.joma,
        r.process,
        r.processNo,
        r.gp,
        r.gpTypeNo,
        r.links,
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
      td.colSpan = 11;
      td.className = "hint";
      td.textContent = "Nav ierakstu. Pievienojiet jaunu NA.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    const editMode = canEdit();
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const linkCell = r.links
        ? `<a href="${escapeHtml(normalizeActUrl(r.links))}" target="_blank" rel="noopener noreferrer">Saite</a>`
        : "";
      const procLabel = r.processNo && r.process ? r.processNo + " — " + r.process : r.process || r.processNo || "";
      const gpLabel = r.gpTypeNo && r.gp ? r.gpTypeNo + " — " + r.gp : r.gp || r.gpTypeNo || "";
      tr.innerHTML =
        `<td>${escapeHtml(r.veids)}</td>` +
        `<td>${escapeHtml(r.nosaukums)}</td>` +
        `<td>${escapeHtml(r.numurs)}</td>` +
        `<td>${escapeHtml(r.pantsPunkts)}</td>` +
        `<td>${escapeHtml(r.institucija)}</td>` +
        `<td>${escapeHtml(r.statuss)}</td>` +
        `<td>${escapeHtml(r.joma)}</td>` +
        `<td>${escapeHtml(procLabel)}</td>` +
        `<td>${escapeHtml(gpLabel)}</td>` +
        `<td>${linkCell}</td>`;
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
    const procVal = $("naProcess") ? String($("naProcess").value || "") : "";
    const gpVal = $("naGp") ? String($("naGp").value || "") : "";
    const parts = procVal.split("\u0001");
    const gpParts = gpVal.split("\u0001");
    return normalizeActRow({
      nosaukums: $("naNosaukums") && $("naNosaukums").value,
      pantsPunkts: $("naPantsPunkts") && $("naPantsPunkts").value,
      veids: $("naVeids") && $("naVeids").value,
      numurs: $("naNumurs") && $("naNumurs").value,
      institucija: $("naInstitucija") && $("naInstitucija").value,
      links: $("naLinks") && $("naLinks").value,
      statuss: $("naStatuss") && $("naStatuss").value,
      joma: $("naJoma") && $("naJoma").value,
      processNo: parts[0] || "",
      process: parts[1] || "",
      gpTypeNo: gpParts[0] || "",
      gp: gpParts[1] || "",
    });
  }

  function fillForm(row) {
    const r = normalizeActRow(row);
    if ($("naNosaukums")) $("naNosaukums").value = r.nosaukums || "";
    if ($("naPantsPunkts")) $("naPantsPunkts").value = r.pantsPunkts || "";
    if ($("naNumurs")) $("naNumurs").value = r.numurs || "";
    if ($("naLinks")) $("naLinks").value = r.links || "";
    const procKey = r.processNo || r.process ? (r.processNo || "") + "\u0001" + (r.process || "") : "";
    const gpKey = r.gpTypeNo || r.gp ? (r.gpTypeNo || "") + "\u0001" + (r.gp || "") : "";
    refreshEditorSelects(r.veids || "", r.institucija || "", procKey, gpKey, r.statuss || "aktuāls");
    if ($("naJoma")) $("naJoma").value = r.joma || "";
  }

  function setEditorDisabled(disabled) {
    const form = $("normActEditorForm");
    if (!form) return;
    form.querySelectorAll("input,select,textarea,button").forEach((el) => {
      if (el.id === "naCloseBtn") return;
      el.disabled = !!disabled;
    });
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) submitBtn.classList.toggle("hidden", disabled);
    if ($("naDeleteBtn")) $("naDeleteBtn").classList.toggle("hidden", disabled || !editingId);
  }

  function showNaEditorCard() {
    const card = $("normActEditorCard");
    if (!card) return;
    card.classList.remove("hidden");
    card.classList.remove("nav-page-hidden");
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

  function actPickLabel(act) {
    const parts = [];
    if (act.veids) parts.push(act.veids);
    if (act.nosaukums) parts.push(act.nosaukums);
    if (act.numurs) parts.push("Nr. " + act.numurs);
    if (act.pantsPunkts) parts.push("(" + act.pantsPunkts + ")");
    return parts.length ? parts.join(" ") : "—";
  }

  function actLinkedToProcess(act, pNo, pName) {
    if (pNo && processNoKey(act.processNo) === processNoKey(pNo)) return true;
    if (pName && normKey(act.process) === normKey(pName)) return true;
    return false;
  }

  function actLinkedToGp(act, ctx) {
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
      await persistActUpdate(act.id, normalizeActRow(Object.assign({}, rowData, cfg.getLinkPatch())));
    } else {
      await persistActUpdate(act.id, cfg.getUnlinkData(rowData));
    }
    try {
      await loadFromDb(true);
    } catch (_) {}
    statusMsg(shouldLink ? "NA saistīts." : "NA noņemts no kartiņas.", "ok");
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
      const labelText = actPickLabel(act);
      const actUrl = normalizeActUrl(act.links);
      if (actUrl) {
        const link = document.createElement("a");
        link.href = actUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = labelText;
        link.style.color = "#1d4ed8";
        link.style.textDecoration = "underline";
        line.appendChild(link);
      } else {
        const span = document.createElement("span");
        span.textContent = labelText;
        line.appendChild(span);
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = openActLabel(editMode);
      btn.onclick = () => {
        captureReturnFromEmbedded();
        openEditor(act.id, { skipCapture: true });
      };
      line.appendChild(btn);
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
            window.alert("Neizdevās noņemt NA: " + (err.message || err));
            rm.disabled = false;
          }
        };
        line.appendChild(rm);
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

    if (addBtn) {
      addBtn.textContent = "Pievienot NA";
      addBtn.classList.remove("hidden");
      addBtn.style.display = editMode ? "" : "none";
      addBtn.disabled = !canLink;
      addBtn.title = canLink ? "" : cfg.blockedMsg || "";
      addBtn.onclick = () => {
        if (!canEdit()) return;
        if (cfg.canLink && !cfg.canLink()) {
          window.alert(cfg.blockedMsg || "Norādiet kartiņas datus, lai varētu saistīt NA.");
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
    hint.textContent = "Atzīmējiet NA, ko saistīt ar šo kartiņu (jaunu NA pievieno NA sadaļā):";
    pickMount.appendChild(hint);

    if (!all.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Nav reģistrētu NA — vispirms pievienojiet NA sadaļā.";
      pickMount.appendChild(empty);
      return;
    }

    if (!canLink && editMode) {
      const warn = document.createElement("div");
      warn.className = "hint";
      warn.textContent = cfg.blockedMsg || "Norādiet kartiņas datus, lai varētu saistīt NA.";
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
      const actUrl = normalizeActUrl(act.links);
      const labelText = actPickLabel(act);
      if (actUrl) {
        const a = document.createElement("a");
        a.href = actUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = labelText;
        a.style.color = "#1d4ed8";
        a.onclick = (e) => e.stopPropagation();
        text.appendChild(a);
      } else {
        text.textContent = labelText;
      }

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
      if (act.statuss) parts.push("[" + act.statuss + "]");
      const labelText = parts.filter(Boolean).join(" ") || "—";
      const actUrl = normalizeActUrl(act.links);
      if (actUrl) {
        const link = document.createElement("a");
        link.href = actUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = labelText;
        link.title = "Atvērt aktu: " + actUrl;
        link.style.color = "#1d4ed8";
        link.style.textDecoration = "underline";
        line.appendChild(link);
      } else {
        const span = document.createElement("span");
        span.textContent = labelText;
        line.appendChild(span);
      }
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
      getLinkPatch: () => ({ processNo: pNo, process: pName }),
      getUnlinkData: (act) =>
        normalizeActRow(
          Object.assign({}, act, actLinkedToProcess(act, pNo, pName) ? { processNo: "", process: "" } : {})
        ),
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
      getLinkPatch: () => ({
        processNo: procNo,
        process,
        gpTypeNo,
        gp,
        joma,
      }),
      getUnlinkData: (act) => {
        if (!actLinkedToGp(act, ctx)) return normalizeActRow(act);
        return normalizeActRow(Object.assign({}, act, { gpTypeNo: "", gp: "" }));
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
        $("naEditorTitle").textContent = "Jauns NA (galaprodukts)";
      } else if (ctx && ctx.process) {
        $("naEditorTitle").textContent = "Jauns NA (process)";
      } else if (ctx && ctx.joma) {
        $("naEditorTitle").textContent = "Jauns NA (joma)";
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
    fillForm(row);
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
    if (await handleSelectAddNew($("naInstitucija"), addCustomInst)) return;
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
            ? "Saglabāts lokāli (NA tabula DB vēl nav — palaidiet migrāciju Supabase SQL Editor)."
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
    if (!window.confirm("Vai dzēst šo normatīvā akta ierakstu?")) return;
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
    if ($("normActEditorForm")) $("normActEditorForm").onsubmit = saveForm;
    if ($("naSearchInput")) {
      $("naSearchInput").addEventListener("input", renderTable);
    }
    if ($("naVeids")) {
      $("naVeids").addEventListener("change", () => { handleSelectAddNew($("naVeids"), addCustomVeids); });
    }
    if ($("naInstitucija")) {
      $("naInstitucija").addEventListener("change", () =>
        handleSelectAddNew($("naInstitucija"), addCustomInst)
      );
    }
    if ($("naProcess")) {
      $("naProcess").addEventListener("change", () => {
        refreshGpSelect("");
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
