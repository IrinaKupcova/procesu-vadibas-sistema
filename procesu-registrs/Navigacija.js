/* Navigācijas teksti un izkārtojums */
(function () {
  "use strict";

  const METRICS_LABEL = "Mērījumi/ procesu rādītāji";

  /** Apakšsadaļas zem «Procesu reģistrs». */
  const PROCESS_SUBSECTION_IDS = [
    "catalogListCard",
    "executorsCard",
    "plusmasShemasCard",
    "metricsCard",
    "optimizacijaCard",
    "normActsCard",
  ];

  /** Galvenā izvēlne (secība). */
  const NAV_ORDER = [
    "processListCard",
    "catalogListCard",
    "executorsCard",
    "plusmasShemasCard",
    "metricsCard",
    "optimizacijaCard",
    "normActsCard",
    "reportsCard",
    "processGroupsCard",
    "processJomasCard",
    "manualCard",
    "skaidrojumiAdminCard",
  ];

  function relabelReportsToStats() {
    document.querySelectorAll(".side-nav-jump[data-scroll-target='__home']").forEach((btn) => btn.remove());
    document.querySelectorAll(".side-nav-jump[data-scroll-target='reportsCard']").forEach((btn) => {
      btn.textContent = "Statistika";
    });

    const reportsCard = document.getElementById("reportsCard");
    if (reportsCard) {
      const title = reportsCard.querySelector(".toolbar .section-title") || reportsCard.querySelector(".section-title");
      if (title) title.textContent = "Statistika";
    }
  }

  function relabelMetrics() {
    document.querySelectorAll(".side-nav-jump[data-scroll-target='metricsCard']").forEach((btn) => {
      btn.textContent = METRICS_LABEL;
    });

    const metricsCard = document.getElementById("metricsCard");
    if (metricsCard) {
      const title = metricsCard.querySelector(".toolbar .section-title") || metricsCard.querySelector(".section-title");
      if (title) title.textContent = METRICS_LABEL;
    }
  }

  function ensurePlusmasShemasNav() {
    const existing = document.querySelector(".side-nav-jump[data-scroll-target='plusmasShemasCard']");
    if (existing) return;
    const anchor = document.querySelector(".side-nav-jump[data-scroll-target='executorsCard']");
    if (!anchor || !anchor.parentElement) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary side-nav-jump nav-subsection";
    btn.setAttribute("data-scroll-target", "plusmasShemasCard");
    btn.textContent = "Plūsmas shēmas";
    anchor.insertAdjacentElement("afterend", btn);
  }

  function ensureOptimizacijaNav() {
    const existing = document.querySelector(".side-nav-jump[data-scroll-target='optimizacijaCard']");
    if (existing) return;
    const anchor =
      document.querySelector(".side-nav-jump[data-scroll-target='metricsCard']") ||
      document.querySelector(".side-nav-jump[data-scroll-target='normActsCard']");
    if (!anchor || !anchor.parentElement) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary side-nav-jump nav-subsection";
    btn.setAttribute("data-scroll-target", "optimizacijaCard");
    btn.textContent = "Optimizācija";
    anchor.insertAdjacentElement("afterend", btn);
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
    document.querySelectorAll(".side-nav-jump[data-scroll-target]").forEach((btn) => {
      const id = btn.getAttribute("data-scroll-target");
      btn.classList.toggle("nav-subsection", PROCESS_SUBSECTION_IDS.includes(id));
    });
  }

  function reorderSideNav() {
    const list = document.querySelector(".side-nav-list");
    if (!list) return;
    NAV_ORDER.forEach((id) => {
      const btn = list.querySelector(`.side-nav-jump[data-scroll-target='${id}']`);
      if (btn) list.appendChild(btn);
    });
  }

  function applyNavigationLayout() {
    relabelReportsToStats();
    relabelMetrics();
    ensureProcessGroupsNav();
    ensurePlusmasShemasNav();
    ensureOptimizacijaNav();
    reorderSideNav();
    applyProcessRegisterSubsections();
  }

  function boot() {
    applyNavigationLayout();
    const processBtn = document.querySelector(".side-nav-jump[data-scroll-target='processListCard']");
    if (processBtn) processBtn.classList.add("nav-active");

    // Vienreizējs atkārtots mēģinājums pēc dinamiska satura ielādes.
    setTimeout(applyNavigationLayout, 300);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
