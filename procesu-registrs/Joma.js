/**
 * Joma — Procesa un GP kartiņās jomas izvēle no pilna jomu saraksta.
 * Pārveido #eDarbibasJoma un #cDarbibasJoma par <select> ar visām zināmām jomām.
 */
(function () {
  "use strict";

  const FIELD_IDS = ["eDarbibasJoma", "cDarbibasJoma"];
  const EMPTY_LABEL = "— Izvēlēties jomu —";
  const valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");

  function normKey(v) {
    return String(v || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*[,;.\-–—]+\s*$/g, "")
      .trim()
      .toLowerCase();
  }

  function splitJomaValues(raw) {
    return String(raw || "")
      .split(/[,;\n]+/)
      .map((s) => String(s || "").trim())
      .filter(Boolean);
  }

  function pickSingleJoma(raw) {
    const parts = splitJomaValues(raw);
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    const scored = parts.slice().sort((a, b) => {
      const wa = String(a).split(/\s+/).filter(Boolean).length;
      const wb = String(b).split(/\s+/).filter(Boolean).length;
      return wb * 1000 + String(b).length - (wa * 1000 + String(a).length);
    });
    return scored[0] || parts[0];
  }

  function collectAllJomas() {
    const seen = new Map();

    function add(label) {
      splitJomaValues(label).forEach((display) => {
        const key = normKey(display);
        if (!key) return;
        if (!seen.has(key) || String(display).length > String(seen.get(key)).length) {
          seen.set(key, display);
        }
      });
    }

    const rows = [];
    if (typeof window.getMergedProcessRegisterRows === "function") {
      rows.push.apply(rows, window.getMergedProcessRegisterRows() || []);
    }
    if (typeof window.getProcessRows === "function") {
      rows.push.apply(rows, window.getProcessRows() || []);
    }
    if (typeof window.getCatalogRows === "function") {
      rows.push.apply(rows, window.getCatalogRows() || []);
    }

    rows.forEach((row) => {
      if (!row || typeof row !== "object") return;
      add(row.darbibasJoma);
      if (row.jomaText) add(row.jomaText);
      if (Array.isArray(row.gpItems)) {
        row.gpItems.forEach((gp) => add(gp && gp.jomaText));
      }
    });

    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));
  }

  function ensureOption(select, label) {
    const val = String(label || "").trim();
    if (!val) return;
    const exists = Array.from(select.options).some((o) => o.value === val);
    if (exists) return;
    const opt = document.createElement("option");
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  }

  function rebuildOptions(select, currentValue) {
    if (!select || select.tagName !== "SELECT") return;
    const cur = pickSingleJoma(currentValue != null ? currentValue : select.value);
    const jomas = collectAllJomas();
    if (cur && !jomas.some((j) => j === cur)) jomas.unshift(cur);
    jomas.sort((a, b) => a.localeCompare(b, "lv", { sensitivity: "base" }));

    select.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = EMPTY_LABEL;
    select.appendChild(empty);
    jomas.forEach((j) => {
      const opt = document.createElement("option");
      opt.value = j;
      opt.textContent = j;
      select.appendChild(opt);
    });
    valueDesc.set.call(select, cur);
  }

  function wrapSelectValue(select) {
    if (!select || select.__jomaValueWrapped) return;
    select.__jomaValueWrapped = true;
    Object.defineProperty(select, "value", {
      configurable: true,
      enumerable: true,
      get() {
        return valueDesc.get.call(this);
      },
      set(v) {
        const picked = pickSingleJoma(v);
        if (picked) ensureOption(this, picked);
        valueDesc.set.call(this, picked);
      },
    });
  }

  function upgradeInputToSelect(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return null;
    if (el.tagName === "SELECT") {
      wrapSelectValue(el);
      return el;
    }
    const sel = document.createElement("select");
    sel.id = el.id;
    if (el.className) sel.className = el.className;
    if (el.name) sel.name = el.name;
    const ac = el.getAttribute("autocomplete");
    if (ac != null) sel.setAttribute("autocomplete", ac);
    sel.style.cssText = el.style.cssText;
    el.parentNode.replaceChild(sel, el);
    wrapSelectValue(sel);
    return sel;
  }

  function syncCatalogSelectDisabled() {
    const sel = document.getElementById("cDarbibasJoma");
    const ref = document.getElementById("cType");
    if (sel && sel.tagName === "SELECT" && ref) sel.disabled = !!ref.disabled;
  }

  function refreshAll(currentValues) {
    const vals = currentValues || {};
    FIELD_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName !== "SELECT") upgradeInputToSelect(id);
      const node = document.getElementById(id);
      if (!node || node.tagName !== "SELECT") return;
      const cur = vals[id] != null ? vals[id] : node.value;
      rebuildOptions(node, cur);
    });
    syncCatalogSelectDisabled();
  }

  function observeCard(cardId) {
    const card = document.getElementById(cardId);
    if (!card || card.__jomaObserved) return;
    card.__jomaObserved = true;
    const obs = new MutationObserver(() => {
      if (card.classList.contains("hidden")) return;
      // fillForm / fillCatalogForm pēc kartiņas atvēršanas — pagaidām, lai vērtība jau ir iestatīta.
      setTimeout(() => refreshAll(), 0);
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function hookRenderTable() {
    if (typeof window.renderTable !== "function" || window.renderTable.__jomaHooked) return;
    const orig = window.renderTable;
    const wrapped = function () {
      const out = orig.apply(this, arguments);
      refreshAll();
      return out;
    };
    wrapped.__jomaHooked = true;
    window.renderTable = wrapped;
  }

  function hookLoadCatalog() {
    if (typeof window.loadCatalog !== "function" || window.loadCatalog.__jomaHooked) return;
    const orig = window.loadCatalog;
    const wrapped = async function () {
      const out = await orig.apply(this, arguments);
      refreshAll();
      return out;
    };
    wrapped.__jomaHooked = true;
    window.loadCatalog = wrapped;
  }

  function observeCatalogFormDisable() {
    const form = document.getElementById("catalogEditorForm");
    if (!form || form.__jomaDisableObserved) return;
    form.__jomaDisableObserved = true;
    const obs = new MutationObserver(syncCatalogSelectDisabled);
    form.querySelectorAll("input,select,textarea,button").forEach((el) => {
      obs.observe(el, { attributes: true, attributeFilter: ["disabled"] });
    });
  }

  function boot() {
    FIELD_IDS.forEach((id) => upgradeInputToSelect(id));
    refreshAll();
    observeCard("editorCard");
    observeCard("catalogEditorCard");
    observeCatalogFormDisable();
    hookRenderTable();
    hookLoadCatalog();
    [300, 1000, 2500].forEach((ms) => {
      setTimeout(() => {
        hookRenderTable();
        hookLoadCatalog();
        refreshAll();
      }, ms);
    });
  }

  window.Joma = {
    collectAllJomas,
    refreshOptions: refreshAll,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
