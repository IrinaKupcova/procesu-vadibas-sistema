(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function isAdminEditRole() {
    const roleSelect = $("roleSelect");
    if (roleSelect && roleSelect.value === "admin_edit") return true;

    try {
      const userSelect = $("userSelect");
      const currentUser = userSelect ? userSelect.value : "daina";
      const roleMap = JSON.parse(localStorage.getItem("roleMap") || "{}");
      return roleMap[currentUser] === "admin_edit";
    } catch {
      return false;
    }
  }

  function setEditorState() {
    const form = $("editorForm");
    if (!form) return;

    const canEdit = isAdminEditRole();
    form.querySelectorAll("input, select, textarea, button").forEach((el) => {
      if (el.id === "closeBtn") return;
      el.disabled = !canEdit;
    });

    // Ensure process group dropdown is editable for admin_edit role.
    const groupSelect = $("eGroup");
    if (groupSelect) groupSelect.disabled = !canEdit;

    const modeHint = $("modeHint");
    if (modeHint) {
      modeHint.textContent = canEdit
        ? "Labošanas režīms ieslēgts. Visi lauki ir aktīvi."
        : "Skatīšanās režīms. Lauku rediģēšana nav pieejama.";
    }
  }

  function patchOpenEditor() {
    if (typeof window.openEditor !== "function" || window.__newProcessOpenPatched) return;

    const originalOpenEditor = window.openEditor;
    window.openEditor = function (row) {
      originalOpenEditor(row);
      setEditorState();
    };
    window.__newProcessOpenPatched = true;
  }

  function patchSubmitSafety() {
    const form = $("editorForm");
    if (!form || form.dataset.submitSafetyPatched === "1") return;

    form.addEventListener(
      "submit",
      function () {
        if (!isAdminEditRole()) return;
        // Keep all form values enabled so existing Supabase save can read everything.
        form.querySelectorAll("input, select, textarea").forEach((el) => {
          el.disabled = false;
        });
      },
      true
    );

    form.dataset.submitSafetyPatched = "1";
  }

  function wireUiEvents() {
    const ids = ["newBtn", "roleSelect", "userSelect", "saveRoleBtn"];
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      const evt = id === "newBtn" ? "click" : "change";
      el.addEventListener(evt, () => {
        setTimeout(setEditorState, 0);
      });
      if (id === "saveRoleBtn") {
        el.addEventListener("click", () => setTimeout(setEditorState, 0));
      }
    });
  }

  function init() {
    patchOpenEditor();
    patchSubmitSafety();
    wireUiEvents();
    setEditorState();
  }

  function boot() {
    if (!$("editorForm") || !$("newBtn")) {
      setTimeout(boot, 200);
      return;
    }
    init();
  }

  boot();
})();
