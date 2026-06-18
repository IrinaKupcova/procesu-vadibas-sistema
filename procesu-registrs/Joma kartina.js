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

  function recordFromParts(key, displayName, notes, updatedAt) {
    return {
      notes: String(notes || ""),
      skaidrojums: "",
      funkcijas: "",
      papildu: "",
      displayName: String(displayName || "").trim(),
      updatedAt: String(updatedAt || ""),
    };
  }

  function applyDbRows(rows) {
    (rows || []).forEach((row) => {
      const displayName = String((row && row.displayName) || "").trim();
      const key = normKey((row && row.key) || displayName);
      if (!key) return;
      cache[key] = recordFromParts(
        key,
        displayName,
        row && row.notes,
        row && row.updatedAt
      );
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
      if (!cache[k]) {
        const notes =
          String(rec.notes || "") ||
          [rec.skaidrojums, rec.funkcijas, rec.papildu].filter(Boolean).join("\n\n");
        cache[k] = recordFromParts(k, displayName || key, notes, rec.updatedAt);
      }
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
    const notes =
      String(rec.notes || "") ||
      [rec.skaidrojums, rec.funkcijas, rec.papildu].filter(Boolean).join("\n\n");
    return {
      notes,
      skaidrojums: String(rec.skaidrojums || ""),
      funkcijas: String(rec.funkcijas || ""),
      papildu: String(rec.papildu || ""),
    };
  }

  async function saveCard(jomaLabel, data) {
    const key = normKey(jomaLabel);
    const displayName = String(jomaLabel || "").trim();
    if (!key || !displayName) return false;

    const rec = recordFromParts(key, displayName, data && data.notes, new Date().toISOString());
    cache[key] = rec;
    cacheToLocal();

    const api = window.DB;
    if (api && typeof api.upsertJomaCard === "function") {
      await api.upsertJomaCard(displayName, data || {});
    }
    return true;
  }

  function isAdminEdit() {
    const rs = $("roleSelect");
    return rs && rs.value === "admin_edit";
  }

  function setFormDisabled(disabled) {
    const form = $("jomaEditorForm");
    if (!form) return;
    form.querySelectorAll("input,select,textarea,button[type='submit']").forEach((el) => {
      if (el.id === "jomaCloseBtn") return;
      el.disabled = !!disabled;
    });
  }

  function fillForm(jomaLabel) {
    const name = String(jomaLabel || "").trim();
    const rec = getCard(name);
    editingJomaKey = normKey(name);
    if ($("jOriginalJomaKey")) $("jOriginalJomaKey").value = editingJomaKey;
    if ($("jJomaName")) $("jJomaName").value = name;
    if ($("jNotes")) $("jNotes").value = rec.notes;
    if ($("jomaEditorTitle")) {
      $("jomaEditorTitle").innerHTML = name
        ? `<span style="color:#1d4ed8;font-weight:700">${name}</span> — Jomas kartiņa`
        : "Jomas kartiņa";
    }
    setFormDisabled(!isAdminEdit());
  }

  function formVals() {
    return {
      notes: String(($("jNotes") && $("jNotes").value) || ""),
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
        await window.DB.upsertJomaCard(label, { notes: "" });
        await reloadFromDb();
      } catch (err) {
        console.warn("Joma DB create warning:", err);
      }
    }
    openEditor(label);
  }

  async function reloadFromDb() {
    if (reloadPromise) return reloadPromise;
    reloadPromise = (async () => {
      const api = window.DB;
      const openName = String(($("jJomaName") && $("jJomaName").value) || "").trim();
      const editorOpen = !!($("jomaEditorCard") && !$("jomaEditorCard").classList.contains("hidden"));

      if (api && typeof api.loadJomaCards === "function") {
        try {
          const rows = await api.loadJomaCards();
          cache = {};
          applyDbRows(rows);
          mergeLocalIntoCache();
          cacheToLocal();
        } catch (err) {
          console.warn("Joma DB load warning:", err);
          cache = loadLocalAll();
        }
      } else {
        cache = loadLocalAll();
      }

      if (editorOpen && openName) fillForm(openName);
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
  }

  function wireSyncListener() {
    if (window.__jomaKartinaSyncWired) return;
    window.__jomaKartinaSyncWired = true;
    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      const source = ev && ev.detail ? ev.detail.source : "";
      if (source === "html") return;
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
