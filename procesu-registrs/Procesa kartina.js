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

  /** Caur procesa kartiņu pievieno jaunu GP: atver GP (kataloga) redaktoru,
   *  priekšaizpildot pašreizējā procesa kontekstu; GP nosaukums/Nr. paliek tukši. */
  function addNewGpFromProcessCard() {
    const procNo = elVal("eProcNo");
    const procName = elVal("eProcess");
    const group = elVal("eGroup");
    const unit = elVal("eExecutorPatstaviga");
    const dept = elVal("eExecutorDala");

    const ec = document.getElementById("editorCard");
    if (ec) ec.classList.add("hidden");

    if (typeof window.openCatalogEditor === "function") {
      window.openCatalogEditor(null);
    } else {
      const card = document.getElementById("catalogEditorCard");
      if (card) card.classList.remove("hidden");
    }

    // Priekšaizpildām nākamajā tikā (openCatalogEditor vispirms notīra formu).
    setTimeout(() => {
      const cProcNo = document.getElementById("cProcNo");
      const cProcess = document.getElementById("cProcess");
      const cType = document.getElementById("cType");
      const cTypeNo = document.getElementById("cTypeNo");
      const cTypeNoOrig = document.getElementById("cTypeNoOrig");

      let matched = false;
      if (typeof window.refreshCatalogProcessPicker === "function") {
        window.refreshCatalogProcessPicker(procNo, procName);
        const pick = document.getElementById("cProcessPick");
        if (pick && pick.value) {
          matched = true;
          pick.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }

      if (cProcNo) cProcNo.value = procNo;
      if (cProcess) cProcess.value = procName;
      if (!matched) {
        const cGroup = document.getElementById("cGroup");
        const cUnit = document.getElementById("cUnit");
        const cDept = document.getElementById("cDepartment");
        if (cGroup && group) cGroup.value = group;
        if (cUnit && unit) cUnit.value = unit;
        if (cDept && dept) cDept.value = dept;
      }

      // Jauns GP — nosaukums un Nr. tukši, lai lietotājs ievada.
      if (cType) cType.value = "";
      if (cTypeNo) cTypeNo.value = "";
      if (cTypeNoOrig) cTypeNoOrig.value = "";
      if (window.Numeracija && typeof Numeracija.applyGpNumberSuggestion === "function") {
        Numeracija.applyGpNumberSuggestion({ isNew: true, procNo, force: true });
      }
      if (window.ProcesaKartina && typeof ProcesaKartina.setAttachments === "function") {
        ProcesaKartina.setAttachments("catalog", []);
      }

      const title = document.getElementById("catalogEditorTitle");
      if (title) {
        title.innerHTML = procName
          ? `Jauns galaprodukts procesam: <span style="color:#1d4ed8;font-weight:700">${procName}</span>`
          : "Galaprodukta kartiņa (jauns)";
      }
      if (cType && typeof cType.focus === "function") cType.focus();
    }, 0);
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

  function wireProcessAddGp() {
    const wrap = document.getElementById("eGpEditorWrap");
    if (!wrap) return;
    if (document.getElementById("eAddGpBtn")) return;
    const panel = wrap.querySelector(".editor-gp-panel") || wrap;
    const actions = document.getElementById("eGpActions");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "eAddGpBtn";
    btn.className = "secondary";
    btn.textContent = "Pievienot jaunu galaproduktu";
    btn.style.marginTop = "8px";
    btn.addEventListener("click", addNewGpFromProcessCard);
    if (actions && actions.parentNode) actions.parentNode.insertBefore(btn, actions.nextSibling);
    else panel.appendChild(btn);
  }

  window.ProcesaKartina = {
    setAttachments,
    getAttachments,
    wire,
    addNewGpFromProcessCard,
  };

  function refreshProcessCardFromGp() {
    if (typeof window.refreshProcessCardGpPanel === "function") {
      window.refreshProcessCardGpPanel();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    wire("process");
    wire("catalog");
    wireProcessGroupLabels();
    wireProcessAddGp();
    window.addEventListener("app:db-sync", (ev) => {
      const kind = ev && ev.detail ? ev.detail.kind : "all";
      const card = document.getElementById("editorCard");
      if (!card || card.classList.contains("hidden")) return;
      if (kind === "all" || kind === "catalog" || kind === "process") {
        refreshProcessCardFromGp();
      }
    });
  });
})();
