(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function isAdminEditRole() {
    if (typeof window.canEdit === "function") return window.canEdit();
    const roleSelect = $("roleSelect");
    if (window.PVRoles) return window.PVRoles.canEditFromSelectValue(roleSelect && roleSelect.value);
    if (roleSelect && roleSelect.value === "admin") return true;

    try {
      const userSelect = $("userSelect");
      const currentUser = userSelect ? userSelect.value : "daina";
      const roleMap = JSON.parse(localStorage.getItem("roleMap") || "{}");
      const r = window.PVRoles && window.PVRoles.normalizeRole
        ? window.PVRoles.normalizeRole(roleMap[currentUser])
        : roleMap[currentUser];
      return r === "admin";
    } catch {
      return false;
    }
  }

  function setEditorState() {
    if (typeof window.applyProcessEditorAccessUi === "function") {
      const card = $("editorCard");
      if (card && !card.classList.contains("hidden")) {
        const hasRow = !!($("eId") && String($("eId").value || "").trim());
        window.applyProcessEditorAccessUi(hasRow);
      }
    }
    const groupSelect = $("eGroup");
    if (groupSelect) groupSelect.disabled = !isAdminEditRole();
    if (typeof window.refreshModeHint === "function") window.refreshModeHint();
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

  function tryPatchOpenEditor() {
    patchOpenEditor();
    if (!window.__newProcessOpenPatched) setTimeout(tryPatchOpenEditor, 150);
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
    tryPatchOpenEditor();
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
