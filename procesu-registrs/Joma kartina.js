/* Jomu kartiņa — Supabase (procesu_jomas) + localStorage rezerves kopija. */
(function () {
  "use strict";

  const STORAGE_KEY = "pv_joma_kartinas_v1";

  const $ = (id) => document.getElementById(id);

  let cache = {};
  let editingJomaKey = null;
  let reloadPromise = null;

  function normKey(v) {
    return String(v || "")
      .normalize("NFKC")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*[,;.\-–—]+\s*$/g, "")
      .trim()
      .toLowerCase();
  }

  function isEditorOpen() {
    const card = $("jomaEditorCard");
    return !!(card && !card.classList.contains("hidden"));
  }

  function loadLocalAll() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (_) {
      return {};
    }
  }

  function saveLocalAll(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    } catch (_) {}
  }

  function cacheToLocal() {
    saveLocalAll(cache);
  }

  function recordFromParts(displayName, data, updatedAt) {
    const d = data && typeof data === "object" ? data : {};
    const skaidrojums = String(d.skaidrojums != null ? d.skaidrojums : d.notes || "");
    const funkcijas = String(d.funkcijas != null ? d.funkcijas : "");
    return {
      notes: skaidrojums,
      skaidrojums,
      funkcijas,
      papildu: String(d.papildu || ""),
      displayName: String(displayName || "").trim(),
      updatedAt: String(updatedAt || ""),
    };
  }

  function recordHasText(rec) {
    if (!rec) return false;
    return !!(
      String(rec.skaidrojums || "").trim() ||
      String(rec.funkcijas || "").trim() ||
      String(rec.notes || "").trim()
    );
  }

  function mergeRecords(dbRec, localRec) {
    if (!dbRec && !localRec) return null;
    if (!dbRec) return localRec;
    if (!localRec) return dbRec;
    const dbTime = Date.parse(dbRec.updatedAt || "") || 0;
    const localTime = Date.parse(localRec.updatedAt || "") || 0;
    const pickField = (dbVal, localVal) => {
      const ds = String(dbVal || "").trim();
      const ls = String(localVal || "").trim();
      if (ls && !ds) return localVal;
      if (ds && !ls) return dbVal;
      if (ls && ds && localTime > dbTime) return localVal;
      return ds || ls;
    };
    const skaidrojums = pickField(dbRec.skaidrojums || dbRec.notes, localRec.skaidrojums || localRec.notes);
    const funkcijas = pickField(dbRec.funkcijas, localRec.funkcijas);
    return recordFromParts(
      dbRec.displayName || localRec.displayName,
      { skaidrojums, funkcijas, papildu: pickField(dbRec.papildu, localRec.papildu) },
      dbTime >= localTime ? dbRec.updatedAt : localRec.updatedAt
    );
  }

  function applyDbRows(rows) {
    (rows || []).forEach((row) => {
      const displayName = String((row && row.displayName) || "").trim();
      const key = normKey((row && row.key) || displayName);
      if (!key) return;
      const dbRec = recordFromParts(
        displayName,
        {
          skaidrojums: row && row.skaidrojums,
          funkcijas: row && row.funkcijas,
          notes: row && row.notes,
        },
        row && row.updatedAt
      );
      cache[key] = mergeRecords(dbRec, cache[key]);
    });
  }

  function mergeLocalIntoCache() {
    const local = loadLocalAll();
    Object.keys(local).forEach((key) => {
      const rec = local[key];
      if (!rec || typeof rec !== "object") return;
      const displayName = String(rec.displayName || "").trim();
      const k = normKey(key || displayName);
      if (!k) return;
      const localRec = recordFromParts(
        displayName || key,
        {
          skaidrojums: rec.skaidrojums,
          funkcijas: rec.funkcijas,
          notes: rec.notes,
          papildu: rec.papildu,
        },
        rec.updatedAt
      );
      cache[k] = mergeRecords(cache[k], localRec);
    });
  }

  function emptyCard() {
    return { notes: "", skaidrojums: "", funkcijas: "", papildu: "" };
  }

  function getCard(jomaLabel) {
    const key = normKey(jomaLabel);
    if (!key) return emptyCard();
    const rec = cache[key] || loadLocalAll()[key];
    if (!rec || typeof rec !== "object") return emptyCard();
    const skaidrojums = String(rec.skaidrojums || "") || String(rec.notes || "");
    const funkcijas = String(rec.funkcijas || "");
    return {
      notes: skaidrojums,
      skaidrojums,
      funkcijas,
      papildu: String(rec.papildu || ""),
    };
  }

  async function saveCard(jomaLabel, data) {
    const key = normKey(jomaLabel);
    const displayName = String(jomaLabel || "").trim();
    if (!key || !displayName) return false;

    const savedAt = new Date().toISOString();
    cache[key] = recordFromParts(displayName, data, savedAt);
    cacheToLocal();

    const api = window.DB;
    if (api && typeof api.upsertJomaCard === "function") {
      await api.upsertJomaCard(displayName, data || {});
    }
    return true;
  }

  function isAdminEdit() {
    try {
      if (typeof window.canEdit === "function" && window.canEdit()) return true;
    } catch (_) {}
    const rs = $("roleSelect");
    return rs && rs.value === "admin_edit";
  }

  function setFormDisabled(disabled) {
    const form = $("jomaEditorForm");
    if (!form) return;
    form.querySelectorAll("input,select,textarea,button[type='submit']").forEach((el) => {
      if (el.id === "jomaCloseBtn") return;
      if (!disabled && (el.id === "jSkaidrojums" || el.id === "jFunkcijas")) {
        el.readOnly = false;
        el.disabled = false;
        return;
      }
      if (disabled && (el.id === "jSkaidrojums" || el.id === "jFunkcijas")) {
        el.disabled = false;
        el.readOnly = true;
        return;
      }
      el.disabled = !!disabled;
    });
  }

  function fillForm(jomaLabel) {
    const name = String(jomaLabel || "").trim();
    const rec = getCard(name);
    editingJomaKey = normKey(name);
    if ($("jOriginalJomaKey")) $("jOriginalJomaKey").value = editingJomaKey;
    if ($("jJomaName")) $("jJomaName").value = name;
    if ($("jSkaidrojums")) $("jSkaidrojums").value = rec.skaidrojums;
    if ($("jFunkcijas")) $("jFunkcijas").value = rec.funkcijas;
    if ($("jomaEditorTitle")) {
      $("jomaEditorTitle").innerHTML = name
        ? `<span style="color:#1d4ed8;font-weight:700">${name}</span> — Jomas kartiņa`
        : "Jomas kartiņa";
    }
    setFormDisabled(!isAdminEdit());
  }

  function formVals() {
    return {
      skaidrojums: String(($("jSkaidrojums") && $("jSkaidrojums").value) || ""),
      funkcijas: String(($("jFunkcijas") && $("jFunkcijas").value) || ""),
    };
  }

  function listJomaLabels() {
    const seen = new Set();
    const out = [];
    Object.keys(cache).forEach((key) => {
      const rec = cache[key];
      const label = String((rec && rec.displayName) || "").trim();
      if (!label || seen.has(normKey(label))) return;
      seen.add(normKey(label));
      out.push(label);
    });
    return out;
  }

  function refreshJomasView() {
    if (typeof window.renderProcessJomasView === "function") window.renderProcessJomasView();
    if (window.Joma && typeof window.Joma.refreshOptions === "function") window.Joma.refreshOptions();
  }

  function closeEditor() {
    editingJomaKey = null;
    const card = $("jomaEditorCard");
    if (card) card.classList.add("hidden");
    if (typeof window.restoreEditorReturnContext === "function") {
      window.restoreEditorReturnContext("processJomasCard");
    } else if ($("processJomasCard")) {
      $("processJomasCard").classList.remove("hidden");
    }
    refreshJomasView();
  }

  function openEditor(jomaLabel) {
    const name = String(jomaLabel || "").trim();
    if (!name || name === "—") return;
    if (typeof window.captureEditorReturnContext === "function") {
      window.captureEditorReturnContext("processJomasCard");
    }
    ["processListCard", "processGroupsCard", "processJomasCard", "executorsCard", "catalogListCard"].forEach((id) => {
      const n = $(id);
      if (n) n.classList.add("hidden");
    });
    const card = $("jomaEditorCard");
    if (!card) return;
    card.classList.remove("hidden");
    fillForm(name);
    if (card.scrollIntoView) card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function openNewJoma() {
    const name = window.prompt("Ievadiet jaunas jomas nosaukumu:");
    const label = String(name || "").trim();
    if (!label) return;
    if (window.Joma && typeof window.Joma.addCustomJoma === "function") {
      window.Joma.addCustomJoma(label);
    }
    if (isAdminEdit() && window.DB && typeof window.DB.upsertJomaCard === "function") {
      try {
        await window.DB.upsertJomaCard(label, { skaidrojums: "", funkcijas: "" });
      } catch (err) {
        console.warn("Joma DB create warning:", err);
      }
    }
    openEditor(label);
  }

  async function reloadFromDb() {
    if (isEditorOpen()) return cache;
    if (reloadPromise) return reloadPromise;
    reloadPromise = (async () => {
      const api = window.DB;
      const prevCache = Object.assign({}, cache);

      if (api && typeof api.loadJomaCards === "function") {
        try {
          const rows = await api.loadJomaCards();
          cache = {};
          applyDbRows(rows);
          mergeLocalIntoCache();
          Object.keys(prevCache).forEach((key) => {
            if (!recordHasText(cache[key]) && recordHasText(prevCache[key])) {
              cache[key] = mergeRecords(cache[key], prevCache[key]);
            }
          });
          cacheToLocal();
        } catch (err) {
          console.warn("Joma DB load warning:", err);
          cache = loadLocalAll();
        }
      } else {
        cache = loadLocalAll();
      }

      refreshJomasView();
      return cache;
    })().finally(() => {
      reloadPromise = null;
    });
    return reloadPromise;
  }

  function wireOnce() {
    const form = $("jomaEditorForm");
    if (!form || form.__jomaKartinaWired) return;
    form.__jomaKartinaWired = true;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isAdminEdit()) {
        alert("Labošana pieejama tikai admin (labot).");
        return;
      }
      const name = String(($("jJomaName") && $("jJomaName").value) || "").trim();
      if (!name) return;
      if (window.Joma && typeof window.Joma.addCustomJoma === "function") {
        window.Joma.addCustomJoma(name);
      }
      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
      try {
        await saveCard(name, formVals());
        closeEditor();
      } catch (err) {
        const mapper =
          window.DB && typeof window.DB.mapDbError === "function"
            ? window.DB.mapDbError
            : (x) => ((x && x.message) ? x.message : String(x));
        alert("DB kļūda: " + mapper(err));
      } finally {
        if (submitBtn) submitBtn.disabled = !isAdminEdit();
      }
    });
    const closeBtn = $("jomaCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeEditor);
    const addBtn = $("pjAddJomaBtn");
    if (addBtn && !addBtn.__jomaKartinaWired) {
      addBtn.__jomaKartinaWired = true;
      addBtn.addEventListener("click", () => {
        openNewJoma();
      });
    }
    const rs = $("roleSelect");
    if (rs && !rs.__jomaKartinaRoleWired) {
      rs.__jomaKartinaRoleWired = true;
      rs.addEventListener("change", () => {
        if (isEditorOpen()) setFormDisabled(!isAdminEdit());
      });
    }
  }

  function wireSyncListener() {
    if (window.__jomaKartinaSyncWired) return;
    window.__jomaKartinaSyncWired = true;
    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      const source = ev && ev.detail ? ev.detail.source : "";
      if (source === "html" || isEditorOpen()) return;
      if (kind === "all" || kind === "joma") reloadFromDb();
    });
  }

  window.JomaKartina = {
    normKey,
    getCard,
    saveCard,
    listJomaLabels,
    reloadFromDb,
    open: openEditor,
    openNew: openNewJoma,
    close: closeEditor,
    fillForm,
  };
  window.openJomaEditor = openEditor;

  function boot() {
    cache = loadLocalAll();
    wireOnce();
    wireSyncListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
