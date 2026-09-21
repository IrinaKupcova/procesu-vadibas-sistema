/* Jomu kartiņa — Supabase (procesu_jomas) + localStorage rezerves kopija. */
(function () {
  "use strict";

  const STORAGE_KEY = "pv_joma_kartinas_v1";

  const $ = (id) => document.getElementById(id);

  let cache = {};
  let editingJomaKey = null;
  let editingJomaOriginalName = null;
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

  async function renameJomaInNormActs(oldName, newName) {
    const oldK = normKey(oldName);
    const newLabel = String(newName || "").trim();
    if (!oldK || !newLabel || oldK === normKey(newLabel)) return;
    const api = window.DB;
    let acts = [];
    if (window.NormAkti && typeof NormAkti.loadActs === "function") {
      acts = NormAkti.loadActs().filter((a) => normKey(a.joma) === oldK);
    }
    if (!acts.length) return;
    for (const act of acts) {
      const updated = Object.assign({}, act, { joma: newLabel });
      if (api && typeof api.updateNormAct === "function") {
        try {
          await api.updateNormAct(act.id, updated);
        } catch (e) {
          console.warn("Joma rename NA:", e);
        }
      }
    }
    if (window.NormAkti && typeof NormAkti.loadFromDb === "function") {
      try {
        await NormAkti.loadFromDb(true);
      } catch (_) {}
    }
  }

  function jomaNameIsTaken(name, exceptKey) {
    const k = normKey(name);
    if (!k || k === exceptKey) return false;
    if (cache[k]) return true;
    const local = loadLocalAll();
    if (local[k]) return true;
    if (window.Joma && typeof window.Joma.collectAllJomas === "function") {
      return (window.Joma.collectAllJomas() || []).some((j) => normKey(j) === k);
    }
    return false;
  }

  async function saveCardWithRename(oldName, newName, data) {
    const oldLabel = String(oldName || "").trim();
    const newLabel = String(newName || "").trim();
    const oldKey = normKey(oldLabel);
    const newKey = normKey(newLabel);
    if (!newLabel) throw new Error("Jomas nosaukums nav norādīts.");
    if (jomaNameIsTaken(newLabel, oldKey)) {
      throw new Error("Joma ar šādu nosaukumu jau pastāv.");
    }

    if (oldKey && newKey !== oldKey) {
      const prev = cache[oldKey] || recordFromParts(oldLabel, getCard(oldLabel), "");
      delete cache[oldKey];
      const local = loadLocalAll();
      if (local[oldKey]) {
        delete local[oldKey];
        saveLocalAll(local);
      }
      if (window.Joma && typeof window.Joma.removeCustomJoma === "function") {
        window.Joma.removeCustomJoma(oldLabel);
      }
      const api = window.DB;
      if (api && typeof api.deleteJomaCard === "function") {
        await api.deleteJomaCard(oldLabel);
      }
      await renameJomaInNormActs(oldLabel, newLabel);
    }

    await saveCard(newLabel, data);
    if (window.Joma && typeof window.Joma.addCustomJoma === "function") {
      window.Joma.addCustomJoma(newLabel);
    }
    editingJomaOriginalName = newLabel;
    editingJomaKey = newKey;
    return newLabel;
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

  function wrapFormGroupsInSection(groups, sectionId, titleText) {
    const nodes = groups.filter(Boolean);
    if (!nodes.length) return;
    if (sectionId && document.getElementById(sectionId)) return;
    const first = nodes[0];
    const parent = first.parentNode;
    if (!parent) return;
    const section = document.createElement("div");
    section.className = "editor-section";
    if (sectionId) section.id = sectionId;
    const title = document.createElement("h3");
    title.className = "editor-section-title";
    title.textContent = titleText;
    section.appendChild(title);
    parent.insertBefore(section, first);
    nodes.forEach((node) => section.appendChild(node));
  }

  function setupJomaEditorLayout() {
    const form = $("jomaEditorForm");
    if (!form || form.__jomaLayoutDone) return;

    const funkcijasEl = $("jFunkcijas");
    if (funkcijasEl) {
      const group = funkcijasEl.closest(".form-group");
      if (group) group.remove();
    }

    wrapFormGroupsInSection(
      [$("jJomaName") && $("jJomaName").closest(".form-group"), $("jSkaidrojums") && $("jSkaidrojums").closest(".form-group")].filter(Boolean),
      "jomaMainSection",
      "1. Pamatinformācija"
    );

    const naActions = $("jNaActions");
    const addNaBtn = $("jAddNaBtn");
    if (naActions && !document.getElementById("jNaEditorWrap")) {
      const oldGroup = naActions.closest(".form-group");
      if (oldGroup) {
        const section = document.createElement("div");
        section.className = "editor-section";
        section.id = "jNaEditorWrap";
        const title = document.createElement("h3");
        title.className = "editor-section-title";
        title.textContent = "2. Procesus reglamentējoši normatīvie akti (NA)";
        section.appendChild(title);
        naActions.className = "na-linked-list";
        section.appendChild(naActions);
        if (addNaBtn) {
          addNaBtn.className = "secondary";
          addNaBtn.style.marginTop = "8px";
          section.appendChild(addNaBtn);
        }
        oldGroup.replaceWith(section);
      }
    }

    form.__jomaLayoutDone = true;

    const nameInput = $("jJomaName");
    if (nameInput && !nameInput.__jomaNameWired) {
      nameInput.__jomaNameWired = true;
      nameInput.removeAttribute("readonly");
      nameInput.removeAttribute("tabindex");
      nameInput.style.background = "";
      nameInput.addEventListener("input", () => {
        const n = String(nameInput.value || "").trim();
        const title = $("jomaEditorTitle");
        if (!title) return;
        title.innerHTML = n
          ? `<span style="color:#1d4ed8;font-weight:700">${n.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span> — Jomas kartiņa`
          : "Jomas kartiņa";
      });
    }
  }

  function setFormDisabled(disabled) {
    const form = $("jomaEditorForm");
    if (!form) return;
    form.querySelectorAll("input,select,textarea,button[type='submit']").forEach((el) => {
      if (el.id === "jomaCloseBtn") return;
      if (!disabled && (el.id === "jSkaidrojums" || el.id === "jJomaName")) {
        el.readOnly = false;
        el.disabled = false;
        return;
      }
      if (disabled && (el.id === "jSkaidrojums" || el.id === "jJomaName")) {
        el.disabled = false;
        el.readOnly = true;
        if (el.id === "jJomaName") el.style.background = "#f8fafc";
        return;
      }
      el.disabled = !!disabled;
    });
    if ($("jAddNaBtn")) $("jAddNaBtn").disabled = !!disabled;
  }

  function fillForm(jomaLabel) {
    const name = String(jomaLabel || "").trim();
    const rec = getCard(name);
    editingJomaOriginalName = name;
    editingJomaKey = normKey(name);
    if ($("jOriginalJomaKey")) $("jOriginalJomaKey").value = editingJomaKey;
    if ($("jJomaName")) $("jJomaName").value = name;
    if ($("jSkaidrojums")) $("jSkaidrojums").value = rec.skaidrojums;
    if ($("jomaEditorTitle")) {
      $("jomaEditorTitle").innerHTML = name
        ? `<span style="color:#1d4ed8;font-weight:700">${name}</span> — Jomas kartiņa`
        : "Jomas kartiņa";
    }
    setFormDisabled(!isAdminEdit());
    const delBtn = $("jomaDeleteBtn");
    if (delBtn) delBtn.classList.toggle("hidden", !(name && isAdminEdit()));
    if (window.NormAkti && typeof NormAkti.renderJomaLinks === "function") {
      NormAkti.renderJomaLinks(name);
    }
  }

  async function deleteCurrentJoma() {
    if (!isAdminEdit()) {
      alert("Dzēšana pieejama tikai admin (labot).");
      return;
    }
    const name = String(($("jJomaName") && $("jJomaName").value) || "").trim();
    if (!name) return;
    if (!window.confirm(`Dzēst jomas kartiņu "${name}"? Šo darbību nevar atsaukt.`)) return;
    const delBtn = $("jomaDeleteBtn");
    if (delBtn) delBtn.disabled = true;
    try {
      const key = normKey(name);
      if (key) delete cache[key];
      cacheToLocal();
      if (window.DB && typeof window.DB.deleteJomaCard === "function") {
        await window.DB.deleteJomaCard(name);
      }
      if (window.Joma && typeof window.Joma.removeCustomJoma === "function") {
        window.Joma.removeCustomJoma(name);
      }
      closeEditor();
    } catch (err) {
      const mapper =
        window.DB && typeof window.DB.mapDbError === "function"
          ? window.DB.mapDbError
          : (x) => ((x && x.message) ? x.message : String(x));
      alert("DB kļūda: " + mapper(err));
    } finally {
      if (delBtn) delBtn.disabled = false;
    }
  }

  function formVals() {
    return {
      skaidrojums: String(($("jSkaidrojums") && $("jSkaidrojums").value) || ""),
      funkcijas: "",
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
    if (typeof window.pvHistoryTryBack === "function" && window.pvHistoryTryBack("joma")) return;
    editingJomaKey = null;
    editingJomaOriginalName = null;
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
    if (typeof window.pvHistoryPush === "function") window.pvHistoryPush("processJomasCard", "joma");
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
      if (!name) {
        alert("Ievadiet jomas nosaukumu.");
        return;
      }
      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) submitBtn.disabled = true;
      try {
        await saveCardWithRename(editingJomaOriginalName, name, formVals());
        closeEditor();
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        const mapper =
          window.DB && typeof window.DB.mapDbError === "function"
            ? window.DB.mapDbError
            : (x) => ((x && x.message) ? x.message : String(x));
        alert(msg.startsWith("Joma") ? msg : "DB kļūda: " + mapper(err));
      } finally {
        if (submitBtn) submitBtn.disabled = !isAdminEdit();
      }
    });
    const closeBtn = $("jomaCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeEditor);
    const delBtn = $("jomaDeleteBtn");
    if (delBtn && !delBtn.__jomaKartinaWired) {
      delBtn.__jomaKartinaWired = true;
      delBtn.addEventListener("click", deleteCurrentJoma);
    }
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
    deleteCard: deleteCurrentJoma,
    fillForm,
  };
  window.openJomaEditor = openEditor;

  function boot() {
    cache = loadLocalAll();
    setupJomaEditorLayout();
    wireOnce();
    wireSyncListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
