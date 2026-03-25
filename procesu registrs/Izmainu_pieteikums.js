/* Izmaiņu pieteikuma veidlapa: atvērt/aizvērt, pielikumi (Supabase Storage), e-pasts administratoram. */
(function () {
  "use strict";

  const ADMIN_EMAIL = "irina.kupcova@vid.gov.lv";
  const MAILTO_MAX = 1900;

  const $ = (id) => document.getElementById(id);

  function val(id) {
    const el = $(id);
    return el ? String(el.value || "").trim() : "";
  }

  function buildBody(uploadedFiles) {
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
    if (uploadedFiles && uploadedFiles.length) {
      lines.push("--- Pielikumi (krātuve «Pieteikumu vesture» / pielikumi_uz_pieteikumiem) ---");
      uploadedFiles.forEach((f, i) => {
        lines.push((i + 1) + ". " + (f.name || "fails") + " — " + (f.url || ""));
      });
      lines.push("");
    }
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

  /** Uz Windows / dažiem pārlūkiem uzticamāk nekā location.href = mailto */
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
      const statusEl = $("ch_attachments_status");
      if (statusEl) statusEl.textContent = "";

      const fileInput = $("ch_attachments");
      const files = fileInput && fileInput.files ? fileInput.files : null;

      let uploaded = [];
      if (files && files.length) {
        const api = window.DB;
        if (!api || typeof api.uploadChangeRequestFiles !== "function") {
          alert("Pielikumu augšupielāde nav pieejama (DB API). Pārbaudiet, ka DB.js ir ielādēts (tajā pašā mapē ar index.html).");
          return;
        }
        if (statusEl) statusEl.textContent = "Augšupielādē pielikumus…";
        try {
          uploaded = await api.uploadChangeRequestFiles(files);
        } catch (err) {
          const msg =
            window.DB && typeof window.DB.mapDbError === "function"
              ? window.DB.mapDbError(err)
              : err && err.message
                ? err.message
                : String(err);
          if (statusEl) statusEl.textContent = "";
          const bid =
            typeof api.getPieteikumiStorageBucket === "function"
              ? api.getPieteikumiStorageBucket()
              : api.STORAGE_BUCKET_PIETEIKUMI || api.STORAGE_BUCKET_CHANGE_REQ || "pieteikumu-vesture";
          alert(
            "Pielikumu augšupielāde neizdevās:\n" +
              msg +
              "\n\nJa kļūda ir «Bucket not found»:\n" +
              "1) Atveriet Supabase → Storage.\n" +
              "2) Ja sarakstā nav bucket «" +
              bid +
              "», spiediet New bucket un Name (id) ierakstiet tieši: " +
              bid +
              "\n3) Pievienojiet politiku, kas atļauj INSERT (anon vai signed-in).\n" +
              "4) Ja bucket izveidojāt ar citu nosaukumu, index.html iestatiet:\n" +
              "   window.PV_SUPABASE_STORAGE_BUCKET = \"jusu-bucket-id\";\n" +
              "(pirms <script src=\"DB.js\">)\n\n" +
              "Mape failiem: pielikumi_uz_pieteikumiem/"
          );
          return;
        }
        if (statusEl) statusEl.textContent = "Pielikumi augšupielādēti (" + uploaded.length + ").";
      }

      const body = buildBody(uploaded);

      let vestureNote = "";
      if (statusEl) statusEl.textContent = "Saglabā pieteikumu krātuvē «Pieteikumu vesture»…";
      try {
        const api = window.DB;
        if (api && typeof api.savePieteikumuVestureSnapshot === "function") {
          const snap = await api.savePieteikumuVestureSnapshot(body, uploaded, {
            iesniedzejs: val("ch_submitter"),
            strukturvieniba: val("ch_orgunit"),
          });
          if (snap && snap.publicUrl) {
            vestureNote = "\n\n--- Pieteikuma pieraksts krātuvē (JSON) ---\n" + snap.publicUrl;
          }
        }
      } catch (ve) {
        const vm =
          window.DB && typeof window.DB.mapDbError === "function"
            ? window.DB.mapDbError(ve)
            : ve && ve.message
              ? ve.message
              : String(ve);
        console.error("Pieteikumu vesture:", ve);
        const bid2 =
          window.DB && typeof window.DB.getPieteikumiStorageBucket === "function"
            ? window.DB.getPieteikumiStorageBucket()
            : "pieteikumu-vesture";
        alert(
          "Brīdinājums: pilna pieteikuma JSON pieraksts netika saglabāts krātuvē:\n" +
            vm +
            "\n\nPārbaudiet bucket «" +
            bid2 +
            "», mapi vesture/ un INSERT politiku.\nTurpinām ar e-pasta atvēršanu."
        );
      }
      if (statusEl) statusEl.textContent = vestureNote ? "Pieteikums saglabāts krātuvē." : "";

      const fullBody = body + vestureNote;
      saveLocalCopy(fullBody);

      const subject = "Izmaiņu pieteikums — Procesu vadības bloks";
      let mailBody = fullBody;
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
        await navigator.clipboard.writeText(fullBody);
      } catch (_) {}

      try {
        openMailtoUrl(mailto);
      } catch (err) {
        alert(
          "Neizdevās atvērt e-pasta klientu. Pilnais pieteikuma teksts ir nokopēts starpliktuvē — ielīmējiet to vēstulē uz " +
            ADMIN_EMAIL
        );
        return;
      }

      alert(
        "Mēģināts atvērt e-pasta klientu ar vēstuli uz " +
          ADMIN_EMAIL +
          ".\n\nJa Outlook neatvērās, ielīmējiet tekstu manuāli (Ctrl+V).\n\nPilnais teksts ir arī starpliktuvē."
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
