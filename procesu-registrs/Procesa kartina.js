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

  window.ProcesaKartina = {
    setAttachments,
    getAttachments,
    wire,
  };

  document.addEventListener("DOMContentLoaded", () => {
    wire("process");
    wire("catalog");
  });
})();
