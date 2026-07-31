/**
 * Procesu un galaproduktu numerācija:
 * Pamatdarbība → P, Atbalsts → A, Pārvaldība → M;
 * process: P-1, A-2, M-1…; GP: P-1-1, A-2-3…
 */
(function () {
  "use strict";

  const GROUP_PREFIX = {
    "pamatdarbība": "P",
    "atbalsts": "A",
    "pārvaldība": "M",
  };

  function normGroupKey(g) {
    const t = String(g || "").trim().toLowerCase();
    if (t.includes("pamatdarb")) return "pamatdarbība";
    if (t.includes("atbal")) return "atbalsts";
    if (t.includes("vad") || t.includes("pārvald")) return "pārvaldība";
    return t;
  }

  function groupPrefix(group) {
    return GROUP_PREFIX[normGroupKey(group)] || "P";
  }

  function normalizePrefixLetter(ch) {
    const p = String(ch || "").toUpperCase();
    if (p === "V") return "M";
    return p;
  }

  function parseProcessNo(val) {
    const s = String(val || "").trim();
    let m = s.match(/^([PAMV])\s*-\s*(\d+)$/i);
    if (m) {
      return { prefix: normalizePrefixLetter(m[1]), num: parseInt(m[2], 10) };
    }
    m = s.match(/^([PAMV])\s*(\d+)$/i);
    if (!m) return null;
    return { prefix: normalizePrefixLetter(m[1]), num: parseInt(m[2], 10) };
  }

  function formatProcessNo(prefix, num) {
    return `${normalizePrefixLetter(prefix || "P")}-${num}`;
  }

  function normalizeProcessNo(val) {
    const p = parseProcessNo(val);
    if (!p) return String(val || "").trim();
    return formatProcessNo(p.prefix, p.num);
  }

  function processNoKey(val) {
    return normalizeProcessNo(val).toUpperCase();
  }

  function processRows() {
    return typeof window.getProcessRows === "function" ? window.getProcessRows() || [] : [];
  }

  function catalogRows() {
    return typeof window.getCatalogRows === "function" ? window.getCatalogRows() || [] : [];
  }

  function collectUsedProcessNumbers(prefix, excludeProcessNo) {
    const pfx = String(prefix || "P").toUpperCase();
    const used = new Set();
    const exKey = ex ? processNoKey(ex) : "";
    const add = (val) => {
      const p = parseProcessNo(val);
      if (!p || p.prefix !== pfx) return;
      const key = processNoKey(formatProcessNo(p.prefix, p.num));
      if (exKey && key === exKey) return;
      used.add(p.num);
    };
    processRows().forEach((r) => add(r && r.processNo));
    catalogRows().forEach((r) => add(r && r.procNo));
    return used;
  }

  function nextAvailableProcessNo(group, excludeProcessNo) {
    const prefix = groupPrefix(group);
    const used = collectUsedProcessNumbers(prefix, excludeProcessNo);
    let n = 1;
    while (used.has(n)) n += 1;
    return formatProcessNo(prefix, n);
  }

  function listAvailableProcessNos(group, excludeProcessNo, limit) {
    const prefix = groupPrefix(group);
    const used = collectUsedProcessNumbers(prefix, excludeProcessNo);
    const out = [];
    const max = Math.max(1, limit || 12);
    for (let n = 1; out.length < max; n += 1) {
      if (!used.has(n)) out.push(formatProcessNo(prefix, n));
    }
    return out;
  }

  function formatGpTypeNo(procNo, sub) {
    const p = parseProcessNo(procNo);
    if (!p) return `${String(procNo || "").trim()}-${sub}`;
    return `${p.prefix}-${p.num}-${sub}`;
  }

  /** P1-1 → P-1-1; jau pareizs formāts paliek nemainīts. */
  function normalizeGpTypeNo(val, procNo) {
    const s = String(val || "").trim();
    if (!s) return "";
    const pn = String(procNo || "").trim();
    if (pn) {
      const parsed = parseGpTypeNo(s, pn);
      if (parsed) return formatGpTypeNo(pn, parsed.sub);
    }
    const compact = s.match(/^([PAMV])(\d+)-(\d+)$/i);
    if (compact) {
      return `${normalizePrefixLetter(compact[1])}-${parseInt(compact[2], 10)}-${parseInt(compact[3], 10)}`;
    }
    const dashed = s.match(/^([PAMV])-(\d+)-(\d+)$/i);
    if (dashed) {
      return `${normalizePrefixLetter(dashed[1])}-${parseInt(dashed[2], 10)}-${parseInt(dashed[3], 10)}`;
    }
    return s;
  }

  function normalizeCatalogRow(row) {
    if (!row) return row;
    const procNo = normalizeProcessNo(row.procNo);
    const typeNo = normalizeGpTypeNo(row.typeNo, procNo);
    const curProc = String(row.procNo || "").trim();
    const curType = String(row.typeNo || "").trim();
    if (procNo === curProc && typeNo === curType) return row;
    return Object.assign({}, row, { procNo, typeNo });
  }

  function normalizeProcessRow(row) {
    if (!row) return row;
    const processNo = normalizeProcessNo(row.processNo);
    if (processNo === String(row.processNo || "").trim()) return row;
    return Object.assign({}, row, { processNo });
  }

  function normalizeProcessRows(rows) {
    return (rows || []).map((r) => normalizeProcessRow(r));
  }

  function normalizeCatalogRows(rows) {
    return (rows || []).map((r) => normalizeCatalogRow(r));
  }

  function parseGpTypeNo(val, procNo) {
    const s = String(val || "").trim();
    const pn = String(procNo || "").trim();
    if (!pn || !s) return null;
    const proc = parseProcessNo(pn);
    if (proc) {
      const newFmt = s.match(new RegExp(`^${proc.prefix}-(\\d+)-(\\d+)$`, "i"));
      if (newFmt && parseInt(newFmt[1], 10) === proc.num) {
        return { procNo: pn, sub: parseInt(newFmt[2], 10) };
      }
    }
    const esc = pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const legacy = s.match(new RegExp(`^${esc}-(\\d+)$`, "i"));
    if (!legacy) return null;
    return { procNo: pn, sub: parseInt(legacy[1], 10) };
  }

  function gpSubExcluded(val, procNo, excludeTypeNo) {
    const ex = String(excludeTypeNo || "").trim();
    if (!ex) return false;
    if (String(val || "").trim().toUpperCase() === ex.toUpperCase()) return true;
    const parsed = parseGpTypeNo(val, procNo);
    const exParsed = parseGpTypeNo(ex, procNo);
    return !!(parsed && exParsed && parsed.sub === exParsed.sub);
  }

  function collectUsedGpSubnumbers(procNo, excludeTypeNo) {
    const pn = String(procNo || "").trim();
    const used = new Set();
    if (!pn) return used;
    const ex = String(excludeTypeNo || "").trim();
    const add = (val) => {
      const p = parseGpTypeNo(val, pn);
      if (!p) return;
      if (gpSubExcluded(val, pn, ex)) return;
      used.add(p.sub);
    };
    catalogRows().forEach((r) => {
      if (processNoKey((r && r.procNo) || "") !== processNoKey(pn)) return;
      add(r && r.typeNo);
    });
    processRows().forEach((r) => {
      if (processNoKey((r && r.processNo) || "") !== processNoKey(pn)) return;
      const raw = (r && r.raw) || {};
      const tn =
        raw["Procesa_galaprodukta_Nr."]
        || raw["Procesa_galaprodukta_Nr"]
        || raw["procesa_galaprodukta_nr"]
        || raw["Procesa_galaprodukta_nr"]
        || "";
      String(tn)
        .split(/[;\n,]+/)
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .forEach(add);
    });
    return used;
  }

  function nextAvailableGpTypeNo(procNo, excludeTypeNo) {
    const pn = String(procNo || "").trim();
    if (!pn) return "";
    const used = collectUsedGpSubnumbers(pn, excludeTypeNo);
    let n = 1;
    while (used.has(n)) n += 1;
    return formatGpTypeNo(pn, n);
  }

  function listAvailableGpTypeNos(procNo, excludeTypeNo, limit) {
    const pn = String(procNo || "").trim();
    if (!pn) return [];
    const used = collectUsedGpSubnumbers(pn, excludeTypeNo);
    const out = [];
    const max = Math.max(1, limit || 12);
    for (let n = 1; out.length < max; n += 1) {
      if (!used.has(n)) out.push(formatGpTypeNo(pn, n));
    }
    return out;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function canEditForms() {
    try {
      if (typeof window.canEdit === "function") return window.canEdit();
      const roleSelect = $("roleSelect");
      return roleSelect && roleSelect.value === "admin_edit";
    } catch (_) {
      return false;
    }
  }

  function readProcNoInput() {
    const raw = String(($("eProcNo") && $("eProcNo").value) || "").trim();
    return raw.toLowerCase() === "nav obligāts" ? "" : raw;
  }

  function readCatalogProcNoInput() {
    const raw = String(($("cProcNo") && $("cProcNo").value) || "").trim();
    return raw.toLowerCase() === "nav obligāts" ? "" : raw;
  }

  function refreshProcessNoSuggestions(group, excludeProcessNo) {
    const dl = $("eProcNoSuggestList");
    if (!dl) return;
    dl.innerHTML = "";
    listAvailableProcessNos(group, excludeProcessNo, 15).forEach((no) => {
      const opt = document.createElement("option");
      opt.value = no;
      dl.appendChild(opt);
    });
  }

  function refreshGpTypeNoSuggestions(procNo, excludeTypeNo) {
    const dl = $("cTypeNoSuggestList");
    if (!dl) return;
    dl.innerHTML = "";
    listAvailableGpTypeNos(procNo, excludeTypeNo, 15).forEach((no) => {
      const opt = document.createElement("option");
      opt.value = no;
      dl.appendChild(opt);
    });
  }

  function excludeProcessNoForForm(isNew, row) {
    if (isNew) return "";
    return String((row && row.processNo) || "").trim();
  }

  function excludeGpTypeNoForForm(isNew, row) {
    if (isNew) return "";
    return String((row && row.typeNo) || "").trim();
  }

  function applyProcessNumberSuggestion(opts) {
    if (!canEditForms()) return;
    const o = opts || {};
    const groupEl = $("eGroup");
    const procEl = $("eProcNo");
    if (!groupEl || !procEl) return;
    const group = groupEl.value;
    const isNew = !!o.isNew;
    const exclude = o.exclude != null ? o.exclude : excludeProcessNoForForm(isNew, o.row);
    const cur = readProcNoInput();
    const force = !!o.force;
    const parsed = parseProcessNo(cur);
    const wantPrefix = groupPrefix(group);
    const shouldReplace =
      force
      || isNew
      || !cur
      || cur.toLowerCase() === "nav obligāts"
      || (parsed && parsed.prefix !== wantPrefix);
    if (!shouldReplace) {
      refreshProcessNoSuggestions(group, exclude);
      return;
    }
    procEl.value = normalizeProcessNo(nextAvailableProcessNo(group, exclude));
    refreshProcessNoSuggestions(group, exclude);
  }

  function applyGpNumberSuggestion(opts) {
    if (!canEditForms()) return;
    const o = opts || {};
    const typeEl = $("cTypeNo");
    if (!typeEl) return;
    const procNo = String(o.procNo != null ? o.procNo : readCatalogProcNoInput()).trim();
    if (!procNo) return;
    const isNew = !!o.isNew;
    const exclude = o.exclude != null ? o.exclude : excludeGpTypeNoForForm(isNew, o.row);
    const cur = String(typeEl.value || "").trim();
    const force = !!o.force;
    const shouldReplace =
      force
      || isNew
      || !cur
      || cur.toLowerCase() === "nav obligāts"
      || !parseGpTypeNo(cur, procNo);
    if (!shouldReplace) {
      refreshGpTypeNoSuggestions(procNo, exclude);
      return;
    }
    typeEl.value = nextAvailableGpTypeNo(procNo, exclude);
    typeEl.value = normalizeGpTypeNo(typeEl.value, procNo);
    refreshGpTypeNoSuggestions(procNo, exclude);
  }

  function afterFillProcessForm(ctx) {
    const c = ctx || {};
    applyProcessNumberSuggestion({
      isNew: !!c.isNew,
      row: c.row || null,
      force: !!c.isNew,
    });
    const procEl = $("eProcNo");
    if (procEl && procEl.value) procEl.value = normalizeProcessNo(procEl.value);
  }

  function afterFillCatalogForm(ctx) {
    const c = ctx || {};
    const procNo = c.row ? String(c.row.procNo || "").trim() : readCatalogProcNoInput();
    applyGpNumberSuggestion({
      isNew: !!c.isNew,
      row: c.row || null,
      procNo,
      force: !!c.isNew && !!procNo,
    });
  }

  function afterCatalogProcessLinked() {
    const procNo = readCatalogProcNoInput();
    const editRow =
      typeof window.getEditingCatalogRow === "function" ? window.getEditingCatalogRow() : null;
    const isNew = !editRow;
    const prevProc = editRow ? String(editRow.procNo || "").trim() : "";
    const processChanged =
      !!procNo
      && !!prevProc
      && processNoKey(procNo) !== processNoKey(prevProc);
    applyGpNumberSuggestion({
      isNew,
      row: editRow,
      procNo,
      force: isNew || processChanged,
    });
  }

  function onProcessGroupChange() {
    const editRow =
      typeof window.getEditingProcessRow === "function" ? window.getEditingProcessRow() : null;
    const oldGroup = editRow ? editRow.group : "";
    const newGroup = $("eGroup") ? $("eGroup").value : "";
    const oldPrefix = oldGroup ? groupPrefix(oldGroup) : "";
    const newPrefix = groupPrefix(newGroup);
    if (editRow && oldPrefix && oldPrefix === newPrefix) {
      applyProcessNumberSuggestion({ isNew: false, row: editRow });
      return;
    }
    applyProcessNumberSuggestion({ force: true, isNew: !editRow, row: editRow });
  }

  let wired = false;
  function wireOnce() {
    if (wired) return;
    wired = true;
    const groupEl = $("eGroup");
    if (groupEl) groupEl.addEventListener("change", onProcessGroupChange);
  }

  function boot() {
    wireOnce();
  }

  window.Numeracija = {
    groupPrefix,
    parseProcessNo,
    formatProcessNo,
    normalizeProcessNo,
    processNoKey,
    nextAvailableProcessNo,
    nextAvailableGpTypeNo,
    listAvailableProcessNos,
    listAvailableGpTypeNos,
    normalizeGpTypeNo,
    normalizeCatalogRow,
    normalizeCatalogRows,
    normalizeProcessRow,
    normalizeProcessRows,
    afterFillProcessForm,
    afterFillCatalogForm,
    afterCatalogProcessLinked,
    applyProcessNumberSuggestion,
    applyGpNumberSuggestion,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
