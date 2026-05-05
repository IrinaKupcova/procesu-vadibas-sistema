/* Navigācijas teksti */
(function () {
  "use strict";

  function relabelReportsToStats() {
    document.querySelectorAll(".side-nav-jump[data-scroll-target='reportsCard']").forEach((btn) => {
      btn.textContent = "Statistika";
    });

    const reportsCard = document.getElementById("reportsCard");
    if (reportsCard) {
      const title = reportsCard.querySelector(".toolbar .section-title");
      if (title) title.textContent = "Statistika";
    }
  }

  function boot() {
    relabelReportsToStats();

    const obs = new MutationObserver(() => relabelReportsToStats());
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
