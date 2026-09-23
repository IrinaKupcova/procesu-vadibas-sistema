/**
 * Lietotāju lomas — pamata tiesības (bez servera piešķiršanas; noklusējums: Administrators).
 */
(function () {
  "use strict";

  const DEFAULT_ROLE = "admin";

  const ROLE_LABELS = {
    admin: "Administrators",
    viewer: "Skatītājs",
    gp_responsible: "Atbildīgais par galaprodukta informāciju",
  };

  /** Vecās vērtības no localStorage / URL. */
  function normalizeRole(raw) {
    const v = String(raw || "").trim();
    if (!v) return "";
    if (v === "admin_edit" || v === "administrator" || v === "administrators") return "admin";
    if (v === "admin_view") return "viewer";
    if (v === "skatitajs" || v === "skatītājs") return "viewer";
    if (ROLE_LABELS[v]) return v;
    return v;
  }

  function roleLabel(roleKey) {
    const r = normalizeRole(roleKey);
    return ROLE_LABELS[r] || r || ROLE_LABELS[DEFAULT_ROLE];
  }

  /** Pilna labošana: procesi, NA, optimizācija, dzēšana, jauni ieraksti. */
  function canEditForRole(roleKey) {
    return normalizeRole(roleKey) === "admin";
  }

  /** GP kartiņa / kataloga saturs (papildu informācija u.t.t.) — GP atbildīgais + administrators. */
  function canEditGpForRole(roleKey) {
    const r = normalizeRole(roleKey);
    return r === "admin" || r === "gp_responsible";
  }

  function canDeleteForRole(roleKey) {
    return canEditForRole(roleKey);
  }

  function migrateRoleMap(map) {
    const out = {};
    let changed = false;
    Object.keys(map || {}).forEach((u) => {
      const next = normalizeRole(map[u]) || DEFAULT_ROLE;
      if (map[u] !== next) changed = true;
      out[u] = next;
    });
    return { map: out, changed };
  }

  window.PVRoles = {
    DEFAULT_ROLE,
    ROLE_LABELS,
    normalizeRole,
    roleLabel,
    canEditForRole,
    canEditGpForRole,
    canDeleteForRole,
    migrateRoleMap,
  };
})();
