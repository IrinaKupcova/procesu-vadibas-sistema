/* Navigācijas teksti */
(function () {
  "use strict";

  function relabelReportsToStats() {
    document.querySelectorAll(".side-nav-jump[data-scroll-target='__home']").forEach((btn) => btn.remove());
    document.querySelectorAll(".side-nav-jump[data-scroll-target='reportsCard']").forEach((btn) => {
      btn.textContent = "Statistika";
    });

    const reportsCard = document.getElementById("reportsCard");
    if (reportsCard) {
      const title = reportsCard.querySelector(".toolbar .section-title");
      if (title) title.textContent = "Statistika";
    }
  }
  function ensureProcessGroupsNav() {
    const existing = document.querySelector(".side-nav-jump[data-scroll-target='processGroupsCard']");
    if (existing) return;
    const catalogBtn = document.querySelector(".side-nav-jump[data-scroll-target='catalogListCard']");
    if (!catalogBtn || !catalogBtn.parentElement) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary side-nav-jump";
    btn.setAttribute("data-scroll-target", "processGroupsCard");
    btn.textContent = "Procesu grupas";
    catalogBtn.insertAdjacentElement("afterend", btn);
  }
  function applyProcessRegisterSubsections() {
    ["catalogListCard", "processGroupsCard", "processJomasCard", "executorsCard"].forEach((id) => {
      document.querySelectorAll(`.side-nav-jump[data-scroll-target='${id}']`).forEach((btn) => {
        btn.classList.add("nav-subsection");
      });
    });
  }

  function boot() {
    relabelReportsToStats();
    ensureProcessGroupsNav();
    applyProcessRegisterSubsections();
    const processBtn = document.querySelector(".side-nav-jump[data-scroll-target='processListCard']");
    if (processBtn) processBtn.classList.add("nav-active");

    // Vienreizējs atkārtots mēģinājums pēc dinamiska satura ielādes.
    setTimeout(() => {
      relabelReportsToStats();
      ensureProcessGroupsNav();
      applyProcessRegisterSubsections();
    }, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
