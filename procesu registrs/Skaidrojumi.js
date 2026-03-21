/* Skaidrojumi: «i» pogas, BUJ, administrators — localStorage. */
(function () {
  "use strict";

  const K_ICONS = "pv_help_icons_v1";
  const K_FAQ = "pv_help_faq_v1";

  const PRESETS = [
    { label: "— Izvēlēties sadaļu —", selector: "" },
    { label: "Augšējā vadības zona", selector: "#topToolbarCard" },
    { label: "Procesu reģistrs (bloks)", selector: "#processListCard" },
    { label: "Galaproduktu veidu katalogs (bloks)", selector: "#catalogListCard" },
    { label: "Meklēšana", selector: "#searchInput" },
    { label: "Procesu tabula", selector: "#processTable" },
    { label: "Kataloga tabula", selector: "#catalogTable" },
    { label: "Skata izvēle", selector: "#extraViewsCard" },
    { label: "Izmaiņu pieteikuma veidlapa", selector: "#changeRequestCard" },
    { label: "Procesa kartiņa (forma)", selector: "#editorCard" },
    { label: "GP kartiņa (forma)", selector: "#catalogEditorCard" },
  ];

  const $ = (id) => document.getElementById(id);

  function isAdminEdit() {
    const rs = $("roleSelect");
    return rs && rs.value === "admin_edit";
  }

  function loadIcons() {
    try {
      return JSON.parse(localStorage.getItem(K_ICONS) || "[]");
    } catch (_) {
      return [];
    }
  }
  function saveIcons(arr) {
    localStorage.setItem(K_ICONS, JSON.stringify(arr));
  }
  function loadFaq() {
    try {
      return JSON.parse(localStorage.getItem(K_FAQ) || "[]");
    } catch (_) {
      return [];
    }
  }
  function saveFaq(arr) {
    localStorage.setItem(K_FAQ, JSON.stringify(arr));
  }

  let openPopoverId = null;

  function removeInjected() {
    document.querySelectorAll("[data-pv-help-injected]").forEach((el) => el.remove());
  }

  function positionPopover(btn) {
    const pop = $("pvHelpPopover");
    if (!pop || !btn) return;
    pop.style.position = "fixed";
    const r = btn.getBoundingClientRect();
    let top = r.bottom + 8;
    let left = Math.min(r.left, window.innerWidth - 28 - Math.min(420, window.innerWidth * 0.92));
    if (left < 8) left = 8;
    if (top + 200 > window.innerHeight) top = Math.max(8, r.top - 8 - (pop.offsetHeight || 120));
    pop.style.top = top + "px";
    pop.style.left = left + "px";
  }

  function closePopover() {
    const pop = $("pvHelpPopover");
    if (pop) pop.classList.add("hidden");
    document.querySelectorAll(".pv-help-i-btn[aria-expanded='true']").forEach((b) => b.setAttribute("aria-expanded", "false"));
    openPopoverId = null;
  }

  function openPopover(btn, text, id) {
    const pop = $("pvHelpPopover");
    const txt = $("pvHelpPopoverText");
    if (!pop || !txt) return;
    if (openPopoverId === id) {
      closePopover();
      return;
    }
    openPopoverId = id;
    txt.textContent = text || "(Nav skaidrojuma teksta.)";
    pop.classList.remove("hidden");
    btn.setAttribute("aria-expanded", "true");
    document.querySelectorAll(".pv-help-i-btn").forEach((b) => {
      if (b !== btn) b.setAttribute("aria-expanded", "false");
    });
    positionPopover(btn);
  }

  function refreshHelpIcons() {
    removeInjected();
    const items = loadIcons().filter((x) => x.enabled !== false);
    items.forEach((item) => {
      let target = null;
      try {
        target = document.querySelector(item.selector);
      } catch (_) {
        return;
      }
      if (!target) return;
      const wrap = document.createElement("span");
      wrap.className = "pv-help-i-wrap";
      wrap.setAttribute("data-pv-help-injected", "1");
      wrap.setAttribute("data-pv-help-id", item.id);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pv-help-i-btn";
      btn.textContent = "i";
      btn.setAttribute("aria-label", "Skaidrojums");
      btn.setAttribute("aria-expanded", "false");
      btn.dataset.pvHelpId = item.id;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        openPopover(btn, item.text, item.id);
      });
      wrap.appendChild(btn);
      const pos = item.position || "after";
      if (pos === "prepend") {
        target.insertBefore(wrap, target.firstChild);
      } else if (pos === "before") {
        target.parentNode.insertBefore(wrap, target);
      } else {
        target.appendChild(wrap);
      }
    });
  }

  function renderFaqModal() {
    const body = $("faqModalBody");
    if (!body) return;
    const list = loadFaq()
      .slice()
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
    if (!list.length) {
      body.innerHTML =
        '<p class="hint">Nav ierakstu. Saturu pievieno administrators sadaļā «Skaidrojuma ievietošana».</p>';
      return;
    }
    body.innerHTML = list
      .map(
        (f) =>
          `<div class="faq-item" data-faq-id="${escapeAttr(f.id)}"><h4>${escapeHtml(f.question || "")}</h4><p>${escapeHtml(f.answer || "")}</p></div>`
      )
      .join("");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function buildAdminUI() {
    const mount = $("skaidrojumiAdminMount");
    if (!mount || mount.dataset.built === "1") return;
    mount.dataset.built = "1";
    mount.innerHTML = `
      <h3>Vietnes sadaļas un elementi (īsais saraksts)</h3>
      <ul class="hint" style="margin-top:4px;padding-left:18px">
        <li><code>#topToolbarCard</code> — augšējā zona</li>
        <li><code>#processListCard</code>, <code>#catalogListCard</code> — reģistrs un katalogs</li>
        <li><code>#processTable</code>, <code>#catalogTable</code> — tabulas</li>
        <li><code>#searchInput</code>, <code>#levelSelect</code> — filtri</li>
        <li><code>#extraViewsCard</code> — skatu zona</li>
        <li><code>#changeRequestCard</code> — izmaiņu pieteikums</li>
        <li>Jebkurš derīgs CSS selektors (piem. <code>#processListCard .section-title</code>)</li>
      </ul>
      <h3>«i» skaidrojumu saraksts</h3>
      <div class="form-row" style="align-items:flex-end">
        <div class="form-group" style="flex:1 1 200px">
          <label>Nosaukums (iekšējs)</label>
          <input type="text" id="newHelpLabel" placeholder="piem., Procesu reģistrs" />
        </div>
        <div class="form-group" style="flex:1 1 220px">
          <label>Izvēle / elements</label>
          <select id="newHelpPreset"></select>
        </div>
        <div class="form-group" style="flex:2 1 280px">
          <label>Vai pats CSS selektors</label>
          <input type="text" id="newHelpSelector" placeholder="#processListCard .section-title" />
        </div>
        <div class="form-group">
          <label>Izvietojums</label>
          <select id="newHelpPosition">
            <option value="append">Beigās elementā</option>
            <option value="prepend">Sākumā elementā</option>
            <option value="before">Pirms elementa</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Skaidrojuma teksts</label>
        <textarea id="newHelpText" rows="3" placeholder="Teksts, kas parādās pēc «i» nospiešanas."></textarea>
      </div>
      <div class="form-row">
        <label><input type="checkbox" id="newHelpEnabled" checked /> Aktīvs</label>
        <button type="button" id="btnAddHelpIcon" class="secondary">Pievienot «i»</button>
      </div>
      <div id="helpIconsListWrap" style="margin-top:12px"></div>
      <h3 style="margin-top:20px">Biežāk uzdotie jautājumi un skaidrojumi</h3>
      <p class="hint">Šie ieraksti parādās logā «Biežāk uzdotie jautājumi un skaidrojumi». Rediģē tikai administrators.</p>
      <div class="form-row">
        <div class="form-group" style="flex:1 1 200px"><label>Jautājums</label><input type="text" id="newFaqQ" /></div>
        <div class="form-group" style="flex:2 1 320px"><label>Atbilde</label><textarea id="newFaqA" rows="2"></textarea></div>
        <div class="form-group" style="flex:0 0 80px"><label>Kārta</label><input type="number" id="newFaqSort" value="0" /></div>
        <div class="form-group"><label>&nbsp;</label><button type="button" id="btnAddFaq" class="secondary">Pievienot BUJ</button></div>
      </div>
      <div id="faqAdminListWrap" style="margin-top:12px"></div>
    `;
    const preset = $("newHelpPreset");
    PRESETS.forEach((p) => {
      const o = document.createElement("option");
      o.value = p.selector;
      o.textContent = p.label;
      preset.appendChild(o);
    });
    preset.addEventListener("change", () => {
      if (preset.value) $("newHelpSelector").value = preset.value;
    });
    $("btnAddHelpIcon").addEventListener("click", addHelpIconRow);
    $("btnAddFaq").addEventListener("click", addFaqRow);
    renderHelpIconsAdmin();
    renderFaqAdmin();
  }

  function addHelpIconRow() {
    const sel = ($("newHelpSelector").value || "").trim();
    if (!sel) {
      alert("Norādiet CSS selektoru vai izvēlieties sadaļu.");
      return;
    }
    let ok = false;
    try {
      ok = !!document.querySelector(sel);
    } catch (_) {}
    if (!ok) {
      if (!confirm("Selektors šobrīd neatrod nevienu elementu. Saglabāt tomēr?")) return;
    }
    const icons = loadIcons();
    icons.push({
      id: "h" + Date.now(),
      label: ($("newHelpLabel").value || "").trim() || sel,
      selector: sel,
      text: ($("newHelpText").value || "").trim(),
      enabled: $("newHelpEnabled").checked,
      position: $("newHelpPosition").value || "append",
    });
    saveIcons(icons);
    $("newHelpText").value = "";
    renderHelpIconsAdmin();
    refreshHelpIcons();
  }

  function addFaqRow() {
    const q = ($("newFaqQ").value || "").trim();
    const a = ($("newFaqA").value || "").trim();
    if (!q) {
      alert("Ievadiet jautājumu.");
      return;
    }
    const faq = loadFaq();
    faq.push({
      id: "f" + Date.now(),
      question: q,
      answer: a,
      sort: Number($("newFaqSort").value) || 0,
    });
    saveFaq(faq);
    $("newFaqQ").value = "";
    $("newFaqA").value = "";
    renderFaqAdmin();
    renderFaqModal();
  }

  function renderHelpIconsAdmin() {
    const wrap = $("helpIconsListWrap");
    if (!wrap) return;
    const icons = loadIcons();
    if (!icons.length) {
      wrap.innerHTML = '<p class="hint">Nav «i» ierakstu. Pievienojiet augšā.</p>';
      return;
    }
    const posOpts = (cur) => {
      const p = cur || "append";
      return [
        ["append", "Beigās"],
        ["prepend", "Sākumā"],
        ["before", "Pirms"],
      ]
        .map(
          ([v, lab]) =>
            `<option value="${v}" ${p === v ? "selected" : ""}>${lab}</option>`
        )
        .join("");
    };
    const rows = icons
      .map((it) => {
        const checked = it.enabled !== false ? "checked" : "";
        return `<tr data-id="${escapeAttr(it.id)}">
          <td><input type="text" class="hi-label" value="${escapeAttr(it.label)}" style="width:100%" /></td>
          <td><input type="text" class="hi-sel" value="${escapeAttr(it.selector)}" style="width:100%;font-size:11px" /></td>
          <td><select class="hi-pos">${posOpts(it.position)}</select></td>
          <td><input type="checkbox" class="hi-en" ${checked} /></td>
          <td><textarea class="hi-txt" rows="2" style="width:100%">${escapeHtml(it.text)}</textarea></td>
          <td><button type="button" class="secondary hi-save">Saglabāt</button><br/><button type="button" class="danger hi-del" style="margin-top:4px">Dzēst</button></td>
        </tr>`;
      })
      .join("");
    wrap.innerHTML = `<table class="help-admin-table"><thead><tr><th>Nosaukums</th><th>Selektors</th><th>Vietā</th><th>Akt.</th><th>Teksts</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    wrap.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id");
      tr.querySelector(".hi-save").addEventListener("click", () => {
        const all = loadIcons();
        const i = all.findIndex((x) => x.id === id);
        if (i < 0) return;
        all[i].label = tr.querySelector(".hi-label").value.trim();
        all[i].selector = tr.querySelector(".hi-sel").value.trim();
        all[i].position = tr.querySelector(".hi-pos").value;
        all[i].enabled = tr.querySelector(".hi-en").checked;
        all[i].text = tr.querySelector(".hi-txt").value.trim();
        saveIcons(all);
        refreshHelpIcons();
        alert("Saglabāts.");
      });
      tr.querySelector(".hi-del").addEventListener("click", () => {
        if (!confirm("Dzēst šo «i» skaidrojumu?")) return;
        saveIcons(loadIcons().filter((x) => x.id !== id));
        renderHelpIconsAdmin();
        refreshHelpIcons();
      });
    });
  }

  function renderFaqAdmin() {
    const wrap = $("faqAdminListWrap");
    if (!wrap) return;
    const faq = loadFaq().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    if (!faq.length) {
      wrap.innerHTML = '<p class="hint">Nav BUJ ierakstu.</p>';
      return;
    }
    wrap.innerHTML = `<table class="help-admin-table"><thead><tr><th>Kārta</th><th>Jautājums</th><th>Atbilde</th><th></th></tr></thead><tbody>${faq
      .map(
        (f) =>
          `<tr data-fid="${escapeAttr(f.id)}"><td><input type="number" class="fq-sort" value="${f.sort || 0}" style="width:64px"/></td><td><input type="text" class="fq-q" value="${escapeAttr(f.question)}" /></td><td><textarea class="fq-a" rows="2">${escapeHtml(f.answer)}</textarea></td><td><button type="button" class="secondary fq-save">Saglabāt</button><br/><button type="button" class="danger fq-del" style="margin-top:4px">Dzēst</button></td></tr>`
      )
      .join("")}</tbody></table>`;
    wrap.querySelectorAll("tr[data-fid]").forEach((tr) => {
      const id = tr.getAttribute("data-fid");
      tr.querySelector(".fq-save").addEventListener("click", () => {
        const all = loadFaq();
        const i = all.findIndex((x) => x.id === id);
        if (i < 0) return;
        all[i].sort = Number(tr.querySelector(".fq-sort").value) || 0;
        all[i].question = tr.querySelector(".fq-q").value.trim();
        all[i].answer = tr.querySelector(".fq-a").value.trim();
        saveFaq(all);
        renderFaqModal();
        alert("BUJ saglabāts.");
      });
      tr.querySelector(".fq-del").addEventListener("click", () => {
        if (!confirm("Dzēst BUJ ierakstu?")) return;
        saveFaq(loadFaq().filter((x) => x.id !== id));
        renderFaqAdmin();
        renderFaqModal();
      });
    });
  }

  function refreshHelpAdminVisibility() {
    const adminBtn = $("helpAdminOpenBtn");
    const card = $("skaidrojumiAdminCard");
    const show = isAdminEdit();
    if (adminBtn) adminBtn.classList.toggle("hidden", !show);
    if (!show && card) card.classList.add("hidden");
    if (show) buildAdminUI();
  }

  function init() {
    const faqOpen = $("faqOpenBtn");
    const faqClose = $("faqCloseBtn");
    const faqModal = $("faqModalCard");
    const helpOpen = $("helpAdminOpenBtn");
    const helpClose = $("helpAdminCloseBtn");
    const helpCard = $("skaidrojumiAdminCard");

    if (faqOpen && faqModal) {
      faqOpen.addEventListener("click", () => {
        renderFaqModal();
        faqModal.classList.remove("hidden");
        faqModal.setAttribute("aria-hidden", "false");
      });
    }
    if (faqClose && faqModal) {
      faqClose.addEventListener("click", () => {
        faqModal.classList.add("hidden");
        faqModal.setAttribute("aria-hidden", "true");
      });
    }
    if (faqModal) {
      faqModal.addEventListener("click", (e) => {
        if (e.target === faqModal) {
          faqModal.classList.add("hidden");
          faqModal.setAttribute("aria-hidden", "true");
        }
      });
    }

    if (helpOpen && helpCard) {
      helpOpen.addEventListener("click", () => {
        if (!isAdminEdit()) return;
        buildAdminUI();
        renderHelpIconsAdmin();
        renderFaqAdmin();
        helpCard.classList.remove("hidden");
        helpCard.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    if (helpClose && helpCard) {
      helpClose.addEventListener("click", () => helpCard.classList.add("hidden"));
    }

    const rs = $("roleSelect");
    if (rs) {
      rs.addEventListener("change", () => {
        refreshHelpAdminVisibility();
        closePopover();
      });
    }

    window.refreshHelpIcons = refreshHelpIcons;
    window.refreshHelpAdminVisibility = refreshHelpAdminVisibility;

    refreshHelpAdminVisibility();
    refreshHelpIcons();

    window.addEventListener("scroll", () => {
      const btn = document.querySelector(".pv-help-i-btn[aria-expanded='true']");
      if (btn && openPopoverId) positionPopover(btn);
    });
    window.addEventListener("resize", () => {
      const btn = document.querySelector(".pv-help-i-btn[aria-expanded='true']");
      if (btn && openPopoverId) positionPopover(btn);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
