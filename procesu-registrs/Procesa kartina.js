/* Procesa / GP kartiņu papildinājumi: pielikumi pie «Papildu informācija». */
(function () {
  "use strict";

  const stores = {
    process: [],
    catalog: [],
  };

  function normAttachments(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({
        name: String((x && x.name) || "").trim() || "fails",
        path: String((x && x.path) || "").trim(),
        url: String((x && x.url) || "").trim(),
        uploadedAt: String((x && x.uploadedAt) || "").trim(),
      }))
      .filter((x) => x.url || x.path);
  }

  function setAttachments(scope, arr) {
    stores[scope] = normAttachments(arr);
    render(scope);
  }

  function getAttachments(scope) {
    return normAttachments(stores[scope]);
  }

  function removeAt(scope, index) {
    const a = stores[scope];
    if (!Array.isArray(a) || index < 0 || index >= a.length) return;
    a.splice(index, 1);
    render(scope);
  }

  function render(scope) {
    const listEl = document.getElementById(scope === "process" ? "eAttachmentsList" : "cAttachmentsList");
    if (!listEl) return;
    const items = stores[scope];
    listEl.innerHTML = "";
    items.forEach((rec, idx) => {
      const row = document.createElement("div");
      row.className = "kartina-attachment-row";
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:6px;font-size:13px;flex-wrap:wrap";
      const link = document.createElement("a");
      link.href = rec.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = rec.name || "Pielikums";
      if (!rec.url) link.classList.add("hint");
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "secondary";
      rm.style.cssText = "font-size:12px;padding:2px 8px";
      rm.textContent = "Noņemt";
      rm.onclick = () => removeAt(scope, idx);
      row.appendChild(link);
      row.appendChild(rm);
      listEl.appendChild(row);
    });
  }

  async function onFilePick(scope, fileInput) {
    const files = fileInput && fileInput.files ? fileInput.files : null;
    if (!files || !files.length) return;
    const api = window.DB;
    if (!api || typeof api.uploadCardAttachmentFiles !== "function") {
      alert("DB: uploadCardAttachmentFiles nav pieejams.");
      return;
    }
    const sub =
      scope === "catalog"
        ? "gp_" +
          String((document.getElementById("cType") && document.getElementById("cType").value) || "")
            .normalize("NFKC")
            .slice(0, 40)
        : "proc_" +
          String((document.getElementById("eProcNo") && document.getElementById("eProcNo").value) || "")
            .normalize("NFKC")
            .slice(0, 40);
    try {
      const uploaded = await api.uploadCardAttachmentFiles(files, sub || scope);
      stores[scope] = normAttachments(stores[scope].concat(uploaded));
      render(scope);
    } catch (e) {
      const msg = api.mapDbError ? api.mapDbError(e) : String(e && e.message ? e.message : e);
      alert("Augšupielāde: " + msg);
    }
    fileInput.value = "";
  }

  function wire(scope) {
    const fid = scope === "process" ? "eAttachmentsFile" : "cAttachmentsFile";
    const inp = document.getElementById(fid);
    if (inp && !inp.dataset.kartinaBound) {
      inp.addEventListener("change", () => onFilePick(scope, inp));
      inp.dataset.kartinaBound = "1";
    }
    render(scope);
  }

  function elVal(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
  }

  /** Noņem «Pievienot jaunu GP» — jaunus GP veido tikai GP sadaļā. */
  function removeProcessAddGpButton() {
    const btn = document.getElementById("eAddGpBtn");
    if (btn) btn.remove();
  }

  /** Procesa kartiņā — tikai grupas nosaukums (bez P/A/M prefiksa). */
  function normalizeProcessGroupSelectLabels() {
    const sel = document.getElementById("eGroup");
    if (!sel) return;
    Array.from(sel.options).forEach((opt) => {
      const name = String(opt.value || "").trim();
      if (name) {
        opt.textContent = name;
        return;
      }
      opt.textContent = String(opt.textContent || "")
        .replace(/^[A-Za-zĀ-ž]\s*[—\-–:]\s*/u, "")
        .trim();
    });
  }

  function wireProcessGroupLabels() {
    normalizeProcessGroupSelectLabels();
    const card = document.getElementById("editorCard");
    if (!card || card.dataset.groupLabelsWired) return;
    card.dataset.groupLabelsWired = "1";
    const obs = new MutationObserver(() => {
      if (!card.classList.contains("hidden")) normalizeProcessGroupSelectLabels();
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
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

  function injectProcessCardStyles() {
    if (document.getElementById("procesaKartinaPatchStyles")) return;
    const st = document.createElement("style");
    st.id = "procesaKartinaPatchStyles";
    st.textContent =
      "#editorCard .editor-gp-grid.editor-gp-grid--no-process{grid-template-columns:minmax(140px,1.4fr) minmax(160px,1fr) auto}" +
      "#editorCard .process-na-readonly-item{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:8px;font-size:13px}" +
      "#editorCard .process-na-readonly-name{font-weight:600;color:#0f172a}" +
      "#editorCard .process-inline-detail-host{margin-top:12px;padding:0}" +
      "#editorCard .process-inline-detail-host #normActEditorCard{margin:0;border-radius:10px;border:2px solid #6366f1;box-shadow:0 4px 14px rgba(79,70,229,.15)}" +
      "#editorCard .process-inline-detail-host #naEditorTitle{color:#312e81;font-weight:800}" +
      ".kartina-inline-host{margin:12px 0 0;padding:0}" +
      ".kartina-inline-host:empty{display:none}" +
      ".kartina-inline-host .kartina-inline-panel{margin:0!important;border:2px solid #6366f1;border-radius:10px;box-shadow:0 4px 14px rgba(79,70,229,.12);padding:12px 14px;background:#fff}" +
      ".kartina-inline-host .kartina-inline-panel .toolbar{margin-bottom:8px}" +
      ".kartina-inline-host .kartina-inline-panel .section-title{font-size:15px}" +
      "#catalogEditorCard .kartina-inline-host--na{margin-top:12px}" +
      "#catalogEditorCard .kartina-inline-host--na #normActEditorCard{margin:0}" +
      ".process-card-nav-jump.kartina-inline-active{background:#c7d2fe;color:#1e1b4b}";
    document.head.appendChild(st);
  }

  const INLINE_NAV_IDS = new Set(["plusmasShemasCard", "metricsCard", "optimizacijaCard"]);
  const cardHomes = new Map();
  let activeCardInline = { scope: null, sectionId: null };

  function kartinaScopeFromEl(el) {
    if (!el) return null;
    if (el.closest("#editorCard")) return "process";
    if (el.closest("#catalogEditorCard")) return "catalog";
    return null;
  }

  function inlineHostId(scope) {
    return scope === "process" ? "eCardInlineHost" : "cCardInlineHost";
  }

  function rememberCardHome(card) {
    if (!card || !card.id || cardHomes.has(card.id)) return;
    cardHomes.set(card.id, { parent: card.parentNode, next: card.nextSibling });
  }

  function undockCard(cardId) {
    const card = document.getElementById(cardId);
    const home = cardHomes.get(cardId);
    if (!card || !home || !home.parent) return;
    card.classList.add("hidden");
    card.classList.remove("kartina-inline-panel");
    if (home.next && home.next.parentNode === home.parent) {
      home.parent.insertBefore(card, home.next);
    } else {
      home.parent.appendChild(card);
    }
  }

  function dockCardToHost(cardId, host) {
    const card = document.getElementById(cardId);
    if (!card || !host) return false;
    rememberCardHome(card);
    card.classList.remove("hidden");
    card.classList.remove("nav-page-hidden");
    card.classList.add("kartina-inline-panel");
    host.appendChild(card);
    return true;
  }

  function clearInlineJumpActive(scope) {
    const root = scope === "process" ? "#editorCard" : "#catalogEditorCard";
    document.querySelectorAll(`${root} .process-card-nav-jump.kartina-inline-active`).forEach((b) => {
      b.classList.remove("kartina-inline-active");
    });
  }

  function closeCardInlineScope(scope) {
    if (activeCardInline.scope === scope && activeCardInline.sectionId) {
      undockCard(activeCardInline.sectionId);
    }
    const host = document.getElementById(inlineHostId(scope));
    if (host) host.innerHTML = "";
    if (activeCardInline.scope === scope) {
      activeCardInline = { scope: null, sectionId: null };
    }
    clearInlineJumpActive(scope);
  }

  function refreshInlineSection(sectionId) {
    if (sectionId === "optimizacijaCard" && window.Optimizacija && typeof window.Optimizacija.render === "function") {
      void window.Optimizacija.render();
    }
  }

  function handleCardNavJump(btn) {
    const scope = kartinaScopeFromEl(btn);
    if (!scope) return false;
    const sectionId = String(btn.getAttribute("data-scroll-target") || "").trim();
    if (!INLINE_NAV_IDS.has(sectionId)) return false;

    if (activeCardInline.scope === scope && activeCardInline.sectionId === sectionId) {
      closeCardInlineScope(scope);
      return true;
    }

    closeCardInlineScope(scope);
    if (scope === "process" && window.__naInlineInProcessCard) {
      closeNaInlineInProcessCard();
    }
    if (scope === "catalog" && window.__naInlineInCatalogCard) {
      closeNaInlineInCatalogCard();
    }

    const host = document.getElementById(inlineHostId(scope));
    if (!host || !dockCardToHost(sectionId, host)) return false;

    activeCardInline = { scope, sectionId };
    btn.classList.add("kartina-inline-active");
    refreshInlineSection(sectionId);
    host.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return true;
  }

  let naCatalogEditorHomeParent = null;
  let naCatalogEditorHomeNext = null;

  function dockNaEditorToCatalogCard() {
    const card = document.getElementById("normActEditorCard");
    const host = document.getElementById("cNaInlineHost");
    if (!card || !host) return;
    if (!naCatalogEditorHomeParent) {
      naCatalogEditorHomeParent = card.parentNode;
      naCatalogEditorHomeNext = card.nextSibling;
    }
    closeCardInlineScope("catalog");
    host.appendChild(card);
    card.classList.remove("hidden");
    card.classList.remove("nav-page-hidden");
    card.classList.add("kartina-inline-panel");
  }

  function undockNaEditorFromCatalogCard() {
    const card = document.getElementById("normActEditorCard");
    if (!card || !naCatalogEditorHomeParent) return;
    card.classList.add("hidden");
    card.classList.remove("kartina-inline-panel");
    if (naCatalogEditorHomeNext && naCatalogEditorHomeNext.parentNode === naCatalogEditorHomeParent) {
      naCatalogEditorHomeParent.insertBefore(card, naCatalogEditorHomeNext);
    } else {
      naCatalogEditorHomeParent.appendChild(card);
    }
    const host = document.getElementById("cNaInlineHost");
    if (host) host.innerHTML = "";
  }

  function closeNaInlineInCatalogCard() {
    if (!window.__naInlineInCatalogCard) return;
    window.__naInlineInCatalogCard = false;
    undockNaEditorFromCatalogCard();
    document.getElementById("normActsCard")?.classList.add("hidden");
    document.getElementById("catalogEditorCard")?.classList.remove("hidden");
    if (window.NormAkti && typeof window.NormAkti.renderCatalogLinks === "function") {
      window.NormAkti.renderCatalogLinks();
    }
  }

  function markCatalogNaContext() {
    window.__naInlineInCatalogCard = true;
  }

  function wireCatalogNaInlineCloseIntercept() {
    const closeBtn = document.getElementById("naCloseBtn");
    if (!closeBtn || closeBtn.dataset.catalogInlineClose) return;
    closeBtn.dataset.catalogInlineClose = "1";
    closeBtn.addEventListener(
      "click",
      (e) => {
        if (!window.__naInlineInCatalogCard) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (window.NormAkti && typeof window.NormAkti.closeEditor === "function") {
          window.__naInlineInCatalogCard = false;
          undockNaEditorFromCatalogCard();
          window.NormAkti.closeEditor();
        } else {
          closeNaInlineInCatalogCard();
        }
      },
      true
    );
  }

  function patchNormAktiOpenEditorForInline() {
    if (!window.NormAkti || typeof window.NormAkti.openEditor !== "function") return false;
    if (window.NormAkti.openEditor.__kartinaInlinePatch) return true;
    const orig = window.NormAkti.openEditor;
    window.NormAkti.openEditor = function (id, opts) {
      const out = orig.apply(this, arguments);
      if (window.__naInlineInProcessCard) {
        dockNaEditorToProcessCard();
      } else if (window.__naInlineInCatalogCard) {
        dockNaEditorToCatalogCard();
        document.getElementById("catalogEditorCard")?.classList.remove("hidden");
      }
      return out;
    };
    window.NormAkti.openEditor.__kartinaInlinePatch = true;
    return true;
  }

  function observeEditorCardInlineCleanup(cardId, scope) {
    const card = document.getElementById(cardId);
    if (!card || card.dataset.kartinaInlineObs) return;
    card.dataset.kartinaInlineObs = "1";
    const obs = new MutationObserver(() => {
      if (!card.classList.contains("hidden")) return;
      closeCardInlineScope(scope);
      if (scope === "process" && window.__naInlineInProcessCard) {
        window.__naInlineInProcessCard = false;
        undockNaEditorFromProcessCard();
      }
      if (scope === "catalog" && window.__naInlineInCatalogCard) {
        window.__naInlineInCatalogCard = false;
        undockNaEditorFromCatalogCard();
      }
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  function installKartinaInlineUi() {
    injectProcessCardStyles();
    wireCatalogNaInlineCloseIntercept();
    patchNormAktiOpenEditorForInline();
    observeEditorCardInlineCleanup("editorCard", "process");
    observeEditorCardInlineCleanup("catalogEditorCard", "catalog");
  }

  window.KartinaInline = {
    handleNavJump: handleCardNavJump,
    markCatalogNaContext,
    closeCardInlineScope,
    undockCatalogNaEditor: undockNaEditorFromCatalogCard,
  };

  let naEditorHomeParent = null;
  let naEditorHomeNext = null;

  function ensureNaInlineHost() {
    let host = document.getElementById("eNaInlineHost");
    if (host) return host;
    const wrap = document.getElementById("eNaEditorWrap");
    if (!wrap) return null;
    host = document.createElement("div");
    host.id = "eNaInlineHost";
    host.className = "process-inline-detail-host";
    wrap.appendChild(host);
    return host;
  }

  function dockNaEditorToProcessCard() {
    const card = document.getElementById("normActEditorCard");
    const host = ensureNaInlineHost();
    if (!card || !host) return;
    if (!naEditorHomeParent) {
      naEditorHomeParent = card.parentNode;
      naEditorHomeNext = card.nextSibling;
    }
    host.appendChild(card);
    card.classList.remove("hidden");
    card.classList.remove("nav-page-hidden");
  }

  function undockNaEditorFromProcessCard() {
    const card = document.getElementById("normActEditorCard");
    if (!card || !naEditorHomeParent) return;
    card.classList.add("hidden");
    if (naEditorHomeNext && naEditorHomeNext.parentNode === naEditorHomeParent) {
      naEditorHomeParent.insertBefore(card, naEditorHomeNext);
    } else {
      naEditorHomeParent.appendChild(card);
    }
    const host = document.getElementById("eNaInlineHost");
    if (host) host.innerHTML = "";
  }

  function closeNaInlineInProcessCard() {
    if (!window.__naInlineInProcessCard) return;
    window.__naInlineInProcessCard = false;
    const card = document.getElementById("normActEditorCard");
    if (card) card.classList.add("hidden");
    undockNaEditorFromProcessCard();
    document.getElementById("normActsCard")?.classList.add("hidden");
    const ec = document.getElementById("editorCard");
    if (ec) ec.classList.remove("hidden");
    const procNo = elVal("eProcNo");
    renderProcessNaReadOnly(procNo, resolveProcessRowForCard(procNo));
  }

  function wireNaInlineCloseIntercept() {
    const closeBtn = document.getElementById("naCloseBtn");
    if (!closeBtn || closeBtn.dataset.processInlineClose) return;
    closeBtn.dataset.processInlineClose = "1";
    closeBtn.addEventListener(
      "click",
      (e) => {
        if (!window.__naInlineInProcessCard) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        closeNaInlineInProcessCard();
      },
      true
    );
  }

  function watchNaEditorHiddenForInline() {
    const card = document.getElementById("normActEditorCard");
    if (!card || card.dataset.inlineHiddenWatch) return;
    card.dataset.inlineHiddenWatch = "1";
    const obs = new MutationObserver(() => {
      if (!window.__naInlineInProcessCard) return;
      if (card.classList.contains("hidden")) {
        closeNaInlineInProcessCard();
      }
    });
    obs.observe(card, { attributes: true, attributeFilter: ["class"] });
  }

  /** No GP režģa noņem kolonnu «Process» (konteksts jau ir procesa kartiņā). */
  function stripGpProcessColumn() {
    const mount = document.getElementById("eGpActions");
    if (!mount) return;
    mount.querySelectorAll(".editor-gp-grid-hdr, .editor-gp-row").forEach((row) => {
      const first = row.firstElementChild;
      if (first) first.remove();
    });
    mount.querySelectorAll(".editor-gp-grid").forEach((g) => {
      g.classList.add("editor-gp-grid--no-process");
    });
  }

  function hideProcessExecutorDalaField() {
    const input = document.getElementById("eExecutorDala");
    const wrap = input && input.closest(".form-group");
    if (wrap) wrap.style.display = "none";
  }

  function naActTitleShort(act) {
    const name = String((act && act.nosaukums) || "").trim();
    if (name) return name;
    const parts = [];
    if (act && act.veids) parts.push(act.veids);
    if (act && act.numurs) parts.push("Nr. " + act.numurs);
    return parts.join(" ") || "—";
  }

  function actLinkedToCurrentProcess(act, procNo, procName) {
    if (!act) return false;
    const pNo = String(procNo || "").trim();
    const pName = String(procName || "").trim();
    if (pNo && processNoKey(act.processNo) === processNoKey(pNo)) return true;
    if (pName && normKey(act.process) === normKey(pName)) return true;
    const refs = act.gpRefs;
    if (Array.isArray(refs)) {
      return refs.some((r) => {
        if (pNo && processNoKey(r.processNo) === processNoKey(pNo)) return true;
        if (pName && normKey(r.process) === normKey(pName)) return true;
        return false;
      });
    }
    return false;
  }

  function openNaInlineFromProcessCard(actId) {
    const sid = String(actId || "").trim();
    if (!sid) return;
    closeCardInlineScope("process");
    window.__naInlineInProcessCard = true;
    document.getElementById("normActsCard")?.classList.add("hidden");
    dockNaEditorToProcessCard();
    const ec = document.getElementById("editorCard");
    if (ec) ec.classList.remove("hidden");
    if (window.NormAkti && typeof NormAkti.openEditor === "function") {
      NormAkti.openEditor(sid, { skipCapture: true });
    }
    const host = document.getElementById("eNaInlineHost");
    if (host && typeof host.scrollIntoView === "function") {
      host.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  /** 4. bloks: tikai NA nosaukums + saite uz NA kartiņu (bez pievienošanas/noņemšanas). */
  function renderProcessNaReadOnly(procNo, processRow) {
    const mount = document.getElementById("eNaActions");
    if (!mount) return;
    const addBtn = document.getElementById("eAddNaBtn");
    if (addBtn) {
      addBtn.style.display = "none";
      addBtn.disabled = true;
    }
    const attachWrap = document.getElementById("eNaAttachWrap");
    if (attachWrap) {
      attachWrap.style.display = "none";
      attachWrap.innerHTML = "";
    }
    mount.innerHTML = "";
    mount.classList.add("na-linked-list");
    let acts = [];
    if (window.NormAkti && typeof NormAkti.loadActs === "function") {
      acts = NormAkti.loadActs();
    }
    const pNo = String(procNo != null ? procNo : elVal("eProcNo")).trim();
    const pName = String(
      (processRow && processRow.process) || elVal("eProcess")
    ).trim();
    const linked = acts.filter((a) => actLinkedToCurrentProcess(a, pNo, pName));
    if (!linked.length) {
      const empty = document.createElement("div");
      empty.className = "hint";
      empty.textContent = "Nav piesaistītu normatīvo aktu. Rediģējiet sadaļā «Procesus reglamentējoši normatīvie akti».";
      mount.appendChild(empty);
      return;
    }
    linked.sort((a, b) =>
      naActTitleShort(a).localeCompare(naActTitleShort(b), "lv", { sensitivity: "base" })
    );
    linked.forEach((act) => {
      const line = document.createElement("div");
      line.className = "process-na-readonly-item";
      const name = document.createElement("span");
      name.className = "process-na-readonly-name";
      name.textContent = naActTitleShort(act);
      const link = document.createElement("button");
      link.type = "button";
      link.className = "secondary";
      link.style.fontSize = "12px";
      link.textContent = "Skatīt normatīvā akta detalizētāko informāciju";
      link.title = "Atvērt normatīvā akta kartiņu zem procesa kartiņas";
      link.onclick = () => openNaInlineFromProcessCard(act.id);
      line.appendChild(name);
      line.appendChild(link);
      mount.appendChild(line);
    });
  }

  function afterProcessCardPanelRefresh(procNo, processRow) {
    stripGpProcessColumn();
    hideProcessExecutorDalaField();
    renderProcessNaReadOnly(procNo, processRow);
  }

  function resolveProcessRowForCard(procNo) {
    const p = String(procNo || "").trim();
    const procName = elVal("eProcess");
    let row = null;
    if (typeof window.getMergedProcessRegisterRows === "function") {
      row =
        (window.getMergedProcessRegisterRows() || []).find(
          (x) => String((x && x.processNo) || "").trim() === p
        ) || null;
    }
    if (!row && procName) row = { process: procName, processNo: p };
    return row;
  }

  function patchRefreshProcessCardGpPanel() {
    const orig = window.refreshProcessCardGpPanel;
    if (!orig || orig.__procesaKartinaPatch) return;
    window.refreshProcessCardGpPanel = function () {
      orig.apply(this, arguments);
      const procNo = elVal("eProcNo");
      afterProcessCardPanelRefresh(procNo, resolveProcessRowForCard(procNo));
    };
    window.refreshProcessCardGpPanel.__procesaKartinaPatch = true;
  }

  function patchNormAktiProcessLinks() {
    if (!window.NormAkti || typeof NormAkti.renderProcessLinks !== "function") return false;
    if (NormAkti.renderProcessLinks.__procesaKartinaPatch) return true;
    const orig = NormAkti.renderProcessLinks;
    NormAkti.renderProcessLinks = function (procNo, processRow) {
      renderProcessNaReadOnly(procNo, processRow);
    };
    NormAkti.renderProcessLinks.__procesaKartinaPatch = true;
    return true;
  }

  function installProcessCardEnhancements() {
    injectProcessCardStyles();
    installKartinaInlineUi();
    removeProcessAddGpButton();
    hideProcessExecutorDalaField();
    ensureNaInlineHost();
    wireNaInlineCloseIntercept();
    watchNaEditorHiddenForInline();
    patchRefreshProcessCardGpPanel();
    patchNormAktiProcessLinks();
    const card = document.getElementById("editorCard");
    if (card && !card.dataset.naReadonlyObs) {
      card.dataset.naReadonlyObs = "1";
      const obs = new MutationObserver(() => {
        if (card.classList.contains("hidden")) {
          if (window.__naInlineInProcessCard) closeNaInlineInProcessCard();
          return;
        }
        const procNo = elVal("eProcNo");
        renderProcessNaReadOnly(procNo, resolveProcessRowForCard(procNo));
      });
      obs.observe(card, { attributes: true, attributeFilter: ["class"] });
    }
  }

  window.ProcesaKartina = {
    setAttachments,
    getAttachments,
    wire,
    refreshProcessNaReadOnly: renderProcessNaReadOnly,
  };

  function refreshProcessCardFromGp() {
    if (typeof window.refreshProcessCardGpPanel === "function") {
      window.refreshProcessCardGpPanel();
    } else {
      afterProcessCardPanelRefresh(elVal("eProcNo"), resolveProcessRowForCard(elVal("eProcNo")));
    }
  }

  function tryInstallEnhancements() {
    installProcessCardEnhancements();
    return !!(window.refreshProcessCardGpPanel && window.refreshProcessCardGpPanel.__procesaKartinaPatch);
  }

  document.addEventListener("DOMContentLoaded", () => {
    wire("process");
    wire("catalog");
    wireProcessGroupLabels();
    removeProcessAddGpButton();
    installKartinaInlineUi();
    tryInstallEnhancements();
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (tryInstallEnhancements() || tries > 80) clearInterval(t);
    }, 100);
    window.addEventListener("load", tryInstallEnhancements);
    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      const card = document.getElementById("editorCard");
      if (!card || card.classList.contains("hidden")) return;
      if (kind === "all" || kind === "catalog" || kind === "process" || kind === "normAkti") {
        refreshProcessCardFromGp();
      }
    });
  });
})();
