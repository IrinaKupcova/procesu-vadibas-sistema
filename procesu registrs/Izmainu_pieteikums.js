/* Izmaiņu pieteikuma veidlapa: atvērt/aizvērt, sagatavot e-pastu administratoram. */
(function () {
  "use strict";

  const ADMIN_EMAIL = "irina.kupcova@vid.gov.lv";
  const MAILTO_MAX = 1800;

  const $ = (id) => document.getElementById(id);

  function val(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function buildBody() {
    const lines = [];
    lines.push("=== IZMAIŅU PIETEIKUMS — Procesu vadības bloks ===");
    lines.push("Datums: " + new Date().toISOString());
    lines.push("");
    lines.push("--- Iesniedzējs ---");
    lines.push("Vārds, uzvārds: " + val("ch_submitter"));
    lines.push("Struktūrvienībā: " + val("ch_orgunit"));
    lines.push("");
    lines.push("--- Procesu reģistrs ---");
    lines.push("Procesu grupa: " + val("ch_pr_group"));
    lines.push("Uzdevuma Nr.: " + val("ch_pr_taskNo"));
    lines.push("Uzdevums: " + val("ch_pr_task"));
    lines.push("Procesa Nr.: " + val("ch_pr_processNo"));
    lines.push("Process: " + val("ch_pr_process"));
    lines.push("Procesa īpašnieks: " + val("ch_pr_owner"));
    lines.push("Procesa iniciātors (input): " + val("ch_pr_input"));
    lines.push("Galaprodukti: " + val("ch_pr_products"));
    lines.push("Galaproduktu veidi: " + val("ch_pr_productTypes"));
    lines.push("Saistītie procesi: " + val("ch_pr_related"));
    lines.push("Pakalpojumi: " + val("ch_pr_services"));
    lines.push("Plūsmas shēmas: " + val("ch_pr_flow"));
    lines.push("IT resursi: " + val("ch_pr_it"));
    lines.push("Optimizācija: " + val("ch_pr_opt"));
    lines.push("Citi rādītāji: " + val("ch_pr_other"));
    lines.push("");
    lines.push("--- Galaproduktu veidu katalogs ---");
    lines.push("Galaprodukta veida Nr.: " + val("ch_gp_typeNo"));
    lines.push("Galaprodukta veids: " + val("ch_gp_type"));
    lines.push("Strukturvieniba izpilditajs: " + val("ch_gp_unit"));
    lines.push("Uzdevuma Nr.: " + val("ch_gp_taskNo"));
    lines.push("Procesa Nr.: " + val("ch_gp_procNo"));
    lines.push("");
    lines.push("--- Lietotāja pamatojums ---");
    lines.push(val("ch_reason_user") || "(nav)");
    lines.push("");
    lines.push("--- Administrators (atbilde / izpilde) ---");
    lines.push(val("ch_reason_admin") || "(nav)");
    return lines.join("\n");
  }

  function saveLocalCopy(body) {
    try {
      const key = "change_request_log";
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.unshift({ t: Date.now(), body });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 20)));
    } catch (_) {}
  }

  function init() {
    const card = $("changeRequestCard");
    const toggle = $("changeRequestToggleBtn");
    const closeBtn = $("changeRequestCloseBtn");
    const form = $("changeRequestForm");

    if (!card || !toggle || !form) return;

    toggle.addEventListener("click", () => {
      card.classList.toggle("hidden");
      if (!card.classList.contains("hidden")) card.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        card.classList.add("hidden");
      });
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = buildBody();
      saveLocalCopy(body);

      const subject = "Izmaiņu pieteikums — Procesu vadības bloks";
      let mailBody = body;
      if (mailBody.length > MAILTO_MAX) {
        mailBody =
          body.slice(0, MAILTO_MAX) +
          "\n\n[... teksts apgriezts e-pasta saites ierobežojuma dēļ; pilns saturs nokopēts starpliktuvē ...]";
      }

      const mailto =
        "mailto:" +
        ADMIN_EMAIL +
        "?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(mailBody);

      try {
        await navigator.clipboard.writeText(body);
      } catch (_) {}

      try {
        window.location.href = mailto;
      } catch (err) {
        alert("Neizdevās atvērt e-pastu. Pilnais pieteikuma teksts ir nokopēts starpliktuvē — ielīmējiet to vēstulē uz " + ADMIN_EMAIL);
        return;
      }

      alert(
        "Atvērts e-pasta klients ar vēstuli uz " +
          ADMIN_EMAIL +
          ".\n\nPilnais pieteikuma teksts ir arī nokopēts starpliktuvē (Ctrl+V), ja vēstulē trūkst datu."
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
