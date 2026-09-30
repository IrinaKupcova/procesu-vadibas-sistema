/* Skaidrojumi: «i» pogas, BUJ, administrators — Supabase (DB.js). */
(function () {
  "use strict";

  const K_ICONS = "pv_help_icons_v1";
  const K_FAQ = "pv_help_faq_v1";

  const $ = (id) => document.getElementById(id);

  /** Sadaļas no navigācijas + kartīnes un biežākie elementi — pilna izvēlne «i» pievienošanai. */
  function collectSectionPresets() {
    const out = [];
    const seen = new Set();

    function add(label, selector) {
      const sel = String(selector || "").trim();
      if (!sel || seen.has(sel)) return;
      seen.add(sel);
      const lab = String(label || sel).trim() || sel;
      out.push({ label: lab, selector: sel });
    }

    add("Izvēlēties sadaļu", "");

    document.querySelectorAll(".side-nav-jump[data-scroll-target]").forEach((btn) => {
      const id = String(btn.getAttribute("data-scroll-target") || "").trim();
      if (!id || id === "skaidrojumiAdminCard" || id === "__home") return;
      const card = document.getElementById(id);
      const navLabel = String(btn.textContent || "").trim();
      const titleEl =
        card &&
        (card.querySelector(".toolbar .section-title") ||
          card.querySelector(".section-title") ||
          card.querySelector("h2"));
      const titleLabel = titleEl ? String(titleEl.textContent || "").trim() : "";
      const blockLabel = titleLabel || navLabel || id;
      add(blockLabel, "#" + id);
      add(blockLabel + " — virsraksts", "#" + id + " .section-title");
    });

    [
      ["Augšējā vadības zona", "#topToolbarCard"],
      ["Izmaiņu pieteikums", "#changeRequestCard"],
      ["Uzdevumi", "#tasksViewCard"],
      ["Procesu grupas", "#processGroupsCard"],
      ["Plūsmas shēmas", "#plusmasShemasCard"],
      ["Meklēšana", "#searchInput"],
      ["Procesu reģistra skats", "#levelSelect"],
      ["Procesu tabula", "#processTable"],
      ["Kataloga tabula", "#catalogTable"],
      ["Normatīvo aktu tabula", "#naTable"],
      ["Izpildītāju tabula", "#executorsTable"],
      ["Jomu tabula", "#processJomasTable"],
      ["Procesu grupu tabula", "#processGroupsTable"],
      ["Procesa kartiņa", "#editorCard"],
      ["Galaprodukta kartiņa", "#catalogEditorCard"],
      ["Normatīvā akta kartiņa", "#normActEditorCard"],
      ["Jomas kartiņa", "#jomaEditorCard"],
      ["Uzdevuma kartiņa", "#taskEditorCard"],
      ["Lietotāja loma", "#roleSelect"],
    ].forEach(([label, sel]) => add(label, sel));

    out.sort((a, b) => {
      if (!a.selector) return -1;
      if (!b.selector) return 1;
      return a.label.localeCompare(b.label, "lv", { sensitivity: "base" });
    });
    return out;
  }

  function ensureAdminStyles() {
    if (document.getElementById("pvHelpAdminStyles")) return;
    const s = document.createElement("style");
    s.id = "pvHelpAdminStyles";
    s.textContent =
      "#skaidrojumiAdminCard h3,#skaidrojumiAdminMount h3{color:#334155!important;font-weight:700;font-size:14px;margin:14px 0 8px;letter-spacing:.01em}" +
      "#skaidrojumiAdminMount h3:first-child{margin-top:0}";
    document.head.appendChild(s);
  }

  function isAdminEdit() {
    if (typeof window.canEdit === "function") return window.canEdit();
    const rs = $("roleSelect");
    if (window.PVRoles) return window.PVRoles.canEditFromSelectValue(rs && rs.value);
    return !!(rs && rs.value === "admin");
  }

  let iconsCache = [];
  let faqCache = [];
  let dataReadyPromise = null;

  function loadIconsFromLegacy() {
    try {
      return JSON.parse(localStorage.getItem(K_ICONS) || "[]");
    } catch (_) {
      return [];
    }
  }

  function loadFaqFromLegacy() {
    try {
      return JSON.parse(localStorage.getItem(K_FAQ) || "[]");
    } catch (_) {
      return [];
    }
  }

  function loadIcons() {
    return iconsCache.slice();
  }

  function loadFaq() {
    return faqCache.slice();
  }

  function dbErrorMessage(err) {
    if (window.DB && typeof window.DB.mapDbError === "function") {
      try {
        return window.DB.mapDbError(err);
      } catch (_) {}
    }
    return String((err && err.message) || err || "Nezināma kļūda");
  }

  async function persistIcons(arr) {
    iconsCache = Array.isArray(arr) ? arr.slice() : [];
    if (!window.DB || typeof window.DB.saveHelpIcons !== "function") {
      throw new Error("Datubāzes modulis nav pieejams.");
    }
    await window.DB.saveHelpIcons(iconsCache);
  }

  async function persistFaq(arr) {
    faqCache = Array.isArray(arr) ? arr.slice() : [];
    if (!window.DB || typeof window.DB.saveHelpFaq !== "function") {
      throw new Error("Datubāzes modulis nav pieejams.");
    }
    await window.DB.saveHelpFaq(faqCache);
  }

  async function reloadFromDb() {
    if (!window.DB || typeof window.DB.loadHelpIcons !== "function") {
      throw new Error("Datubāzes modulis nav pieejams.");
    }
    iconsCache = await window.DB.loadHelpIcons();
    faqCache = await window.DB.loadHelpFaq();
    const legacyIcons = loadIconsFromLegacy();
    const legacyFaq = loadFaqFromLegacy();
    if (!iconsCache.length && legacyIcons.length) {
      iconsCache = legacyIcons;
      await window.DB.saveHelpIcons(iconsCache);
      try {
        localStorage.removeItem(K_ICONS);
      } catch (_) {}
    }
    if (!faqCache.length && legacyFaq.length) {
      faqCache = legacyFaq;
      await window.DB.saveHelpFaq(faqCache);
      try {
        localStorage.removeItem(K_FAQ);
      } catch (_) {}
    }
  }

  function ensureDataReady() {
    if (!dataReadyPromise) dataReadyPromise = reloadFromDb();
    return dataReadyPromise;
  }

  function resetDataReady() {
    dataReadyPromise = null;
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

  function fillHelpPresetSelect(presetEl) {
    if (!presetEl) return;
    const prev = presetEl.value;
    presetEl.innerHTML = "";
    collectSectionPresets().forEach((p) => {
      const o = document.createElement("option");
      o.value = p.selector;
      o.textContent = p.label;
      presetEl.appendChild(o);
    });
    if (prev && Array.from(presetEl.options).some((o) => o.value === prev)) presetEl.value = prev;
  }

  const ADMIN_UI_VERSION = "2";

  function buildAdminUI() {
    const mount = $("skaidrojumiAdminMount");
    if (!mount) return;
    if (mount.dataset.built === "1" && mount.dataset.builtVersion === ADMIN_UI_VERSION) return;
    if (mount.dataset.built === "1") {
      mount.innerHTML = "";
      mount.dataset.built = "";
    }
    ensureAdminStyles();
    mount.dataset.built = "1";
    mount.dataset.builtVersion = ADMIN_UI_VERSION;
    mount.innerHTML = `
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
      <div class="form-row">
        <div class="form-group" style="flex:1 1 200px"><label>Jautājums</label><input type="text" id="newFaqQ" /></div>
        <div class="form-group" style="flex:2 1 320px"><label>Atbilde</label><textarea id="newFaqA" rows="2"></textarea></div>
        <div class="form-group" style="flex:0 0 80px"><label>Kārta</label><input type="number" id="newFaqSort" value="0" /></div>
        <div class="form-group"><label>&nbsp;</label><button type="button" id="btnAddFaq" class="secondary">Pievienot BUJ</button></div>
      </div>
      <div id="faqAdminListWrap" style="margin-top:12px"></div>
    `;
    const preset = $("newHelpPreset");
    fillHelpPresetSelect(preset);
    preset.addEventListener("change", () => {
      if (preset.value) $("newHelpSelector").value = preset.value;
    });
    $("btnAddHelpIcon").addEventListener("click", addHelpIconRow);
    $("btnAddFaq").addEventListener("click", addFaqRow);
    renderHelpIconsAdmin();
    renderFaqAdmin();
  }

  async function addHelpIconRow() {
    await ensureDataReady();
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
      const warnLabel = "jauno skaidrojuma «i» ierakstu (selektors šobrīd neatrod elementu)";
      if (window.PVConfirm) {
        if (!window.PVConfirm.confirmSave(warnLabel)) return;
      } else if (!confirm(`Vai tiešām gribat labot vai saglabāt — ${warnLabel}?`)) {
        return;
      }
    } else {
      const lbl = ($("newHelpLabel").value || "").trim() || sel;
      const saveLabel = `jauno skaidrojuma «i» ierakstu «${lbl}»`;
      if (window.PVConfirm) {
        if (!window.PVConfirm.confirmSave(saveLabel)) return;
      } else if (!confirm(`Vai tiešām gribat labot vai saglabāt — ${saveLabel}?`)) {
        return;
      }
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
    try {
      await persistIcons(icons);
    } catch (err) {
      alert("Neizdevās saglabāt DB: " + dbErrorMessage(err));
      return;
    }
    $("newHelpText").value = "";
    renderHelpIconsAdmin();
    refreshHelpIcons();
  }

  async function addFaqRow() {
    await ensureDataReady();
    const q = ($("newFaqQ").value || "").trim();
    const a = ($("newFaqA").value || "").trim();
    if (!q) {
      alert("Ievadiet jautājumu.");
      return;
    }
    const saveLabel = `jaunu BUJ ierakstu «${q}»`;
    if (window.PVConfirm) {
      if (!window.PVConfirm.confirmSave(saveLabel)) return;
    } else if (!confirm(`Vai tiešām gribat labot vai saglabāt — ${saveLabel}?`)) {
      return;
    }
    const faq = loadFaq();
    faq.push({
      id: "f" + Date.now(),
      question: q,
      answer: a,
      sort: Number($("newFaqSort").value) || 0,
    });
    try {
      await persistFaq(faq);
    } catch (err) {
      alert("Neizdevās saglabāt DB: " + dbErrorMessage(err));
      return;
    }
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
    if (typeof window.applyTableColumnSizing === "function") window.applyTableColumnSizing(wrap.querySelector("table"));
    wrap.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id");
      tr.querySelector(".hi-save").addEventListener("click", async () => {
        await ensureDataReady();
        const lbl = tr.querySelector(".hi-label") ? tr.querySelector(".hi-label").value.trim() : "skaidrojuma ierakstu";
        const saveLabel = `skaidrojuma «i» ierakstu «${lbl || "—"}»`;
        if (window.PVConfirm) {
          if (!window.PVConfirm.confirmSave(saveLabel)) return;
        } else if (!confirm(`Vai tiešām gribat labot vai saglabāt — ${saveLabel}?`)) {
          return;
        }
        const all = loadIcons();
        const i = all.findIndex((x) => x.id === id);
        if (i < 0) return;
        all[i].label = tr.querySelector(".hi-label").value.trim();
        all[i].selector = tr.querySelector(".hi-sel").value.trim();
        all[i].position = tr.querySelector(".hi-pos").value;
        all[i].enabled = tr.querySelector(".hi-en").checked;
        all[i].text = tr.querySelector(".hi-txt").value.trim();
        try {
          await persistIcons(all);
        } catch (err) {
          alert("Neizdevās saglabāt DB: " + dbErrorMessage(err));
          return;
        }
        refreshHelpIcons();
        alert("Saglabāts.");
      });
      tr.querySelector(".hi-del").addEventListener("click", async () => {
        await ensureDataReady();
        const lbl = tr.querySelector(".hi-label") ? tr.querySelector(".hi-label").value.trim() : "skaidrojumu";
        const delLabel = `skaidrojuma «i» ierakstu «${lbl || "—"}»`;
        if (window.PVConfirm) {
          if (!window.PVConfirm.confirmDelete(delLabel)) return;
        } else if (!confirm(`Vai tiešām gribat dzēst — ${delLabel}?`)) {
          return;
        }
        try {
          await persistIcons(loadIcons().filter((x) => x.id !== id));
        } catch (err) {
          alert("Neizdevās saglabāt DB: " + dbErrorMessage(err));
          return;
        }
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
    if (typeof window.applyTableColumnSizing === "function") window.applyTableColumnSizing(wrap.querySelector("table"));
    wrap.querySelectorAll("tr[data-fid]").forEach((tr) => {
      const id = tr.getAttribute("data-fid");
      tr.querySelector(".fq-save").addEventListener("click", async () => {
        await ensureDataReady();
        const q = tr.querySelector(".fq-q") ? tr.querySelector(".fq-q").value.trim() : "";
        const saveLabel = `BUJ ierakstu «${q || "—"}»`;
        if (window.PVConfirm) {
          if (!window.PVConfirm.confirmSave(saveLabel)) return;
        } else if (!confirm(`Vai tiešām gribat labot vai saglabāt — ${saveLabel}?`)) {
          return;
        }
        const all = loadFaq();
        const i = all.findIndex((x) => x.id === id);
        if (i < 0) return;
        all[i].sort = Number(tr.querySelector(".fq-sort").value) || 0;
        all[i].question = tr.querySelector(".fq-q").value.trim();
        all[i].answer = tr.querySelector(".fq-a").value.trim();
        try {
          await persistFaq(all);
        } catch (err) {
          alert("Neizdevās saglabāt DB: " + dbErrorMessage(err));
          return;
        }
        renderFaqModal();
        alert("BUJ saglabāts.");
      });
      tr.querySelector(".fq-del").addEventListener("click", async () => {
        await ensureDataReady();
        const q = tr.querySelector(".fq-q") ? tr.querySelector(".fq-q").value.trim() : "";
        const delLabel = `BUJ ierakstu «${q || "—"}»`;
        if (window.PVConfirm) {
          if (!window.PVConfirm.confirmDelete(delLabel)) return;
        } else if (!confirm(`Vai tiešām gribat dzēst — ${delLabel}?`)) {
          return;
        }
        try {
          await persistFaq(loadFaq().filter((x) => x.id !== id));
        } catch (err) {
          alert("Neizdevās saglabāt DB: " + dbErrorMessage(err));
          return;
        }
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
    if (adminBtn && (!show || (card && card.classList.contains("hidden")))) {
      adminBtn.classList.remove("nav-active");
    }
    if (show) {
      ensureAdminStyles();
      buildAdminUI();
      fillHelpPresetSelect($("newHelpPreset"));
    }
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
        ensureDataReady().then(() => {
          renderFaqModal();
          faqModal.classList.remove("hidden");
          faqModal.setAttribute("aria-hidden", "false");
        });
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

    // "Skaidrojuma ievietosana" atveram caur kreisas navigacijas vienoto logiku (index.html initLeftNav),
    // lai pietiek ar VIENU klikšķi uz sadaļas. Šeit neatsevišķi netogglējam karti.
    if (helpClose && helpCard) {
      helpClose.addEventListener("click", () => {
        helpCard.classList.add("hidden");
        if (helpOpen) helpOpen.classList.remove("nav-active");
      });
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

    window.addEventListener("app:db-sync", (ev) => {
      const d = ev && ev.detail ? ev.detail : {};
      const kind = d.kind || "all";
      const source = d.source || "";
      if (source === "html") return;
      if (kind !== "all" && kind !== "skaidrojumi") return;
      resetDataReady();
      ensureDataReady()
        .then(() => {
          refreshHelpIcons();
          if ($("skaidrojumiAdminMount") && $("skaidrojumiAdminMount").dataset.built === "1") {
            renderHelpIconsAdmin();
            renderFaqAdmin();
          }
          renderFaqModal();
        })
        .catch(() => {});
    });

    ensureDataReady().then(() => {
      refreshHelpAdminVisibility();
      refreshHelpIcons();
    });

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

