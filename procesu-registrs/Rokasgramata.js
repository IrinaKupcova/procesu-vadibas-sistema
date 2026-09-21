/* Rokasgrāmata — pielikumi (saglabāt, e-pasts, dzēst). */
(function () {
  "use strict";

  const LS_USER = "pv_rokasgramata_pielikumi_v1";
  const LS_HIDDEN = "pv_rokasgramata_hidden_v1";

  const BUILTIN = [
    {
      id: "tehniska_specifikacija",
      name: "Procesu reģistrs — tehniskā specifikācija (Word)",
      url: "docs/Procesu_registrs_tehniska_specifikacija.docx",
      downloadName: "Procesu_registrs_tehniska_specifikacija.docx",
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      builtin: true,
    },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {}
  }

  function getUserAttachments() {
    const arr = readJson(LS_USER, []);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x, i) => ({
        id: String((x && x.id) || "user_" + i),
        name: String((x && x.name) || "Pielikums").trim() || "Pielikums",
        url: String((x && x.url) || "").trim(),
        path: String((x && x.path) || "").trim(),
        downloadName: String((x && x.downloadName) || (x && x.name) || "pielikums").trim(),
        uploadedAt: String((x && x.uploadedAt) || "").trim(),
        builtin: false,
      }))
      .filter((x) => x.url);
  }

  function setUserAttachments(arr) {
    writeJson(LS_USER, arr);
  }

  function getHiddenIds() {
    const arr = readJson(LS_HIDDEN, []);
    return Array.isArray(arr) ? arr.map(String) : [];
  }

  function setHiddenIds(arr) {
    writeJson(LS_HIDDEN, arr);
  }

  function getVisibleAttachments() {
    const hidden = new Set(getHiddenIds());
    const builtin = BUILTIN.filter((b) => !hidden.has(b.id));
    return builtin.concat(getUserAttachments());
  }

  function resolveUrl(rel) {
    try {
      return new URL(String(rel || ""), location.href).href;
    } catch (_) {
      return String(rel || "");
    }
  }

  function openMailtoUrl(mailto) {
    const a = document.createElement("a");
    a.href = mailto;
    a.style.position = "fixed";
    a.style.left = "-9999px";
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch (_) {}
      }, 0);
    }
  }

  async function downloadAttachment(item) {
    const url = resolveUrl(item.url);
    const fileName = item.downloadName || item.name || "pielikums";
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      let blob = await res.blob();
      if (item.mime && (!blob.type || blob.type === "application/octet-stream")) {
        blob = new Blob([blob], { type: item.mime });
      }
      const obj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = obj;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(obj);
        try {
          document.body.removeChild(a);
        } catch (_) {}
      }, 0);
    } catch (_) {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      try {
        document.body.removeChild(a);
      } catch (e2) {}
    }
  }

  function emailAttachment(item) {
    const absUrl = resolveUrl(item.url);
    const subject = encodeURIComponent(item.name || "Rokasgrāmatas pielikums");
    const body = encodeURIComponent(
      "Sveiki,\n\nNosūtu saiti uz dokumentu «" +
        (item.name || "pielikums") +
        "»:\n\n" +
        absUrl +
        "\n\n(Atveriet saiti pārlūkā un saglabājiet Word dokumentu .docx.)\n"
    );
    openMailtoUrl("mailto:?subject=" + subject + "&body=" + body);
  }

  function deleteAttachment(item) {
    const label = item.name || "pielikumu";
    if (!confirm("Noņemt «" + label + "» no saraksta?")) return;
    if (item.builtin) {
      const hidden = getHiddenIds();
      if (!hidden.includes(item.id)) {
        hidden.push(item.id);
        setHiddenIds(hidden);
      }
    } else {
      setUserAttachments(getUserAttachments().filter((x) => x.id !== item.id));
    }
    render();
  }

  function actionBtn(text, onclick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "secondary";
    b.textContent = text;
    b.addEventListener("click", onclick);
    return b;
  }

  function render() {
    const listEl = $("manualAttachmentsList");
    if (!listEl) return;
    const items = getVisibleAttachments();
    listEl.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Nav pielikumu. Administrators var pievienot jaunus.";
      listEl.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "manual-attachment-row";

      const name = document.createElement("div");
      name.className = "attachment-name";
      const link = document.createElement("a");
      link.href = item.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.name;
      name.appendChild(link);

      const actions = document.createElement("div");
      actions.className = "attachment-actions";
      actions.appendChild(
        actionBtn("Saglabāt", () => {
          downloadAttachment(item);
        })
      );
      actions.appendChild(
        actionBtn("Nosūtīt e-pastā", () => {
          emailAttachment(item);
        })
      );
      actions.appendChild(
        actionBtn("Dzēst", () => {
          deleteAttachment(item);
        })
      );

      row.appendChild(name);
      row.appendChild(actions);
      listEl.appendChild(row);
    });
  }

  function refreshAdminUi() {
    const admin = $("manualAttachmentsAdmin");
    if (!admin) return;
    const can =
      typeof window.canEdit === "function" ? window.canEdit() : false;
    admin.classList.toggle("hidden", !can);
  }

  async function onFilePick(fileInput) {
    const files = fileInput && fileInput.files ? fileInput.files : null;
    if (!files || !files.length) return;
    const api = window.DB;
    if (!api || typeof api.uploadCardAttachmentFiles !== "function") {
      alert("DB: uploadCardAttachmentFiles nav pieejams.");
      return;
    }
    try {
      const uploaded = await api.uploadCardAttachmentFiles(files, "rokasgramata");
      const user = getUserAttachments();
      uploaded.forEach((rec, i) => {
        user.push({
          id: "user_" + Date.now() + "_" + i,
          name: rec.name,
          url: rec.url,
          path: rec.path,
          downloadName: rec.name,
          uploadedAt: rec.uploadedAt,
        });
      });
      setUserAttachments(user);
      render();
    } catch (e) {
      const msg = api.mapDbError ? api.mapDbError(e) : String(e && e.message ? e.message : e);
      alert("Augšupielāde: " + msg);
    }
    fileInput.value = "";
  }

  function wire() {
    const inp = $("manualAttachmentFile");
    if (inp && !inp.dataset.rokasgramataBound) {
      inp.addEventListener("change", () => onFilePick(inp));
      inp.dataset.rokasgramataBound = "1";
    }
    const addBtn = $("manualAddAttachmentBtn");
    if (addBtn && !addBtn.dataset.rokasgramataBound) {
      addBtn.addEventListener("click", () => {
        if (typeof window.canEdit === "function" && !window.canEdit()) {
          alert("Pielikumu pievienošana pieejama tikai administratoram (labot).");
          return;
        }
        if (inp) inp.click();
      });
      addBtn.dataset.rokasgramataBound = "1";
    }
    refreshAdminUi();
    render();
  }

  window.Rokasgramata = {
    wire,
    render,
    refreshAdminUi,
    getVisibleAttachments,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
