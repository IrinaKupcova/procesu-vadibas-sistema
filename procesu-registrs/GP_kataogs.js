/**
 * Galaproduktu veidu kataloga paplašinātais skats (līdzīgi kā procesu reģistra līmeņi):
 * — «Pamatskats» — standarta kolonnas;
 * — «Paplašinātais skats» — papildu kolonna «Sensitīvitātes pakāpe» (korupcijas risku sasaiste).
 *
 * Sensitīvitātes vērtības glabājas localStorage (atslēga: Galaprodukta veida Nr.), ja DB kolonna
 * nav pieejama; ja DB atgriež lauku Sensitivitates_pakape, tas tiek izmantots, kad lokālais ir tukšs.
 */
(function () {
  "use strict";

  const STORAGE_VIEW = "pv_gp_catalog_view_v1";
  const STORAGE_SENS = "pv_gp_sensitivity_v1";

  function loadSensMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SENS) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveSensMap(m) {
    try {
      localStorage.setItem(STORAGE_SENS, JSON.stringify(m));
    } catch (_) {}
  }

  window.mergeCatalogSensitivity = function (row) {
    if (!row || typeof row !== "object") return row;
    const m = loadSensMap();
    const k = String(row.typeNo || row.id || "").trim();
    const fromDb = String(row.sensitivity || "").trim();
    const fromLoc = k ? String(m[k] || "").trim() : "";
    row.sensitivity = fromLoc || fromDb || "";
    return row;
  };

  window.persistCatalogSensitivity = function (typeNo, value) {
    const k = String(typeNo || "").trim();
    if (!k) return;
    const m = loadSensMap();
    const v = String(value || "").trim();
    if (v) m[k] = v;
    else delete m[k];
    saveSensMap(m);
  };

  window.removeCatalogSensitivity = function (typeNo) {
    const k = String(typeNo || "").trim();
    if (!k) return;
    const m = loadSensMap();
    delete m[k];
    saveSensMap(m);
  };

  window.applyGpCatalogView = function () {
    const table = document.getElementById("catalogTable");
    const sel = document.getElementById("gpCatalogViewSelect");
    if (!table) return;
    if (!sel) {
      table.classList.add("catalog-view--compact");
      table.classList.remove("catalog-view--expanded");
      return;
    }
    const expanded = sel.value === "expanded";
    table.classList.toggle("catalog-view--expanded", expanded);
    table.classList.toggle("catalog-view--compact", !expanded);
  };

  function ensureToolbar() {
    const card = document.getElementById("catalogListCard");
    if (!card || document.getElementById("gpCatalogViewToolbar")) return;
    const tb = card.querySelector(".toolbar .right");
    if (!tb) return;
    const wrap = document.createElement("div");
    wrap.id = "gpCatalogViewToolbar";
    wrap.style.cssText =
      "display:flex;align-items:center;gap:8px;margin-right:auto;flex-wrap:wrap";
    wrap.innerHTML =
      '<select id="gpCatalogViewSelect" style="font-weight:600;min-width:12rem" title="Pamatskats vai paplašinātais kataloga skats" aria-label="Kataloga skata veids">' +
      '<option value="compact">Pamatskats</option>' +
      '<option value="expanded">Paplašinātais skats</option>' +
      "</select>";
    tb.insertBefore(wrap, tb.firstChild);

    const sel = document.getElementById("gpCatalogViewSelect");
    try {
      sel.value = localStorage.getItem(STORAGE_VIEW) || "compact";
    } catch (_) {
      sel.value = "compact";
    }
    sel.addEventListener("change", () => {
      try {
        localStorage.setItem(STORAGE_VIEW, sel.value);
      } catch (_) {}
      window.applyGpCatalogView();
    });
    window.applyGpCatalogView();
  }

  function boot() {
    ensureToolbar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
