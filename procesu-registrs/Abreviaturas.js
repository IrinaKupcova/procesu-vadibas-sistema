/* Abreviatūru atšifrējumi pārvaldēm ar hover tooltip. */
(function () {
  "use strict";

  const FULL_BY_ABBR = {
    VID: "Valsts ieņēmumu dienests",
    IAD: "Iekšējā audita daļa",
    IKD: "Iekšējās kontroles daļa",
    JPSIP: "Juridiskā un pirmstiesas strīdu izskatīšanas pārvalde",
    NSUP: "Nefinanšu sektora uzraudzības pārvalde",
    NP: "Nodokļu pārvalde",
    NNVP: "Nodokļu nomaksas veicināšanas pārvalde",
    NMUAPP: "Nodokļu maksātāju uzvedības analīzes un prognozēšanas pārvalde",
    SNASLD: "Specializētā nodokļu administrēšanas un sevišķas lietvedības daļa",
    MP: "Muitas pārvalde",
    ITP: "Informācijas tehnoloģiju pārvalde",
    ISDPD: "Informācijas sistēmu drošības pārvaldības daļa",
    APP: "Attīstības un personāla pārvalde",
    AP: "Administratīvā pārvalde",
  };

  const TOKEN_RE = /\b[A-Z]{2,}\b/g;
  const KEY_LIST = Object.keys(FULL_BY_ABBR).sort((a, b) => b.length - a.length);
  const splitMemo = new Map();

  function ensureStyles() {
    if (document.getElementById("abbrTooltipCss")) return;
    const s = document.createElement("style");
    s.id = "abbrTooltipCss";
    s.textContent = `
      .pv-abbr{
        text-decoration:underline dotted #94a3b8;
        text-underline-offset:2px;
        cursor:help;
      }
      #pvAbbrTooltip{
        position:fixed;
        z-index:9999;
        max-width:min(70vw,520px);
        white-space:normal;
        line-height:1.25;
        font-size:11px;
        color:#64748b;
        background:#f8fafc;
        border:1px solid #cbd5e1;
        border-radius:6px;
        padding:4px 8px;
        box-shadow:0 2px 8px rgba(15,23,42,.12);
        pointer-events:none;
        opacity:0;
        transform:translateY(2px);
        transition:opacity .12s ease-in-out;
      }
      #pvAbbrTooltip.visible{opacity:1}
    `;
    document.head.appendChild(s);
  }

  function getTooltipNode() {
    let n = document.getElementById("pvAbbrTooltip");
    if (n) return n;
    n = document.createElement("div");
    n.id = "pvAbbrTooltip";
    document.body.appendChild(n);
    return n;
  }

  function isSkippable(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return true;
    if (!String(node.nodeValue || "").trim()) return true;
    const p = node.parentElement;
    if (!p) return true;
    if (p.closest(".pv-abbr")) return true;
    const tn = p.tagName;
    return tn === "SCRIPT" || tn === "STYLE" || tn === "TEXTAREA" || tn === "INPUT" || tn === "OPTION";
  }

  function splitComposite(token) {
    if (splitMemo.has(token)) return splitMemo.get(token);
    if (!token) return [];
    if (FULL_BY_ABBR[token]) {
      const direct = [token];
      splitMemo.set(token, direct);
      return direct;
    }
    for (const k of KEY_LIST) {
      if (!token.startsWith(k)) continue;
      const rest = token.slice(k.length);
      const restSplit = splitComposite(rest);
      if (restSplit && restSplit.length) {
        const joined = [k].concat(restSplit);
        splitMemo.set(token, joined);
        return joined;
      }
    }
    splitMemo.set(token, []);
    return [];
  }

  function resolveFullName(token) {
    const t = String(token || "").trim().toUpperCase();
    if (!t) return "";
    if (FULL_BY_ABBR[t]) return FULL_BY_ABBR[t];
    const parts = splitComposite(t);
    if (!parts.length) return "";
    return parts.map((p) => FULL_BY_ABBR[p]).filter(Boolean).join(" + ");
  }

  function decorateTextNode(node) {
    const txt = String(node.nodeValue || "");
    TOKEN_RE.lastIndex = 0;
    if (!TOKEN_RE.test(txt)) return;
    TOKEN_RE.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    txt.replace(TOKEN_RE, (m, idx) => {
      if (idx > last) frag.appendChild(document.createTextNode(txt.slice(last, idx)));
      const full = resolveFullName(m);
      if (full) {
        const span = document.createElement("span");
        span.className = "pv-abbr";
        span.textContent = m;
        span.dataset.full = full;
        span.setAttribute("aria-label", `${m} — ${full}`);
        span.title = full;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(m));
      }
      last = idx + m.length;
      return m;
    });
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }

  function decorate(root) {
    const target = root && root.nodeType ? root : document.body;
    if (!target) return;
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!isSkippable(n)) decorateTextNode(n);
    });
  }

  function bindTooltip() {
    const tip = getTooltipNode();
    let active = null;

    function hide() {
      active = null;
      tip.classList.remove("visible");
    }

    document.addEventListener("mouseover", (e) => {
      const el = e.target && e.target.closest ? e.target.closest(".pv-abbr") : null;
      if (!el || !el.dataset || !el.dataset.full) return;
      active = el;
      tip.textContent = el.dataset.full;
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 8, r.left + r.width / 2));
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.min(window.innerHeight - 8, r.bottom + 8)}px`;
      tip.style.transform = "translateX(-50%)";
      tip.classList.add("visible");
    });

    document.addEventListener("mouseout", (e) => {
      const el = e.target && e.target.closest ? e.target.closest(".pv-abbr") : null;
      if (!el) return;
      const next = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest(".pv-abbr") : null;
      if (next === el) return;
      hide();
    });

    window.addEventListener("scroll", () => {
      if (!active) return hide();
      const r = active.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 8, r.left + r.width / 2));
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.min(window.innerHeight - 8, r.bottom + 8)}px`;
    }, true);
  }

  function boot() {
    ensureStyles();
    decorate(document.body);
    bindTooltip();
    let processing = false;
    const mo = new MutationObserver((list) => {
      if (processing) return;
      processing = true;
      mo.disconnect();
      list.forEach((m) => {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            if (!isSkippable(n)) decorateTextNode(n);
            return;
          }
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n;
            if (el.id === "pvAbbrTooltip") return;
            if (el.closest && (el.closest(".pv-abbr") || el.closest("#pvAbbrTooltip"))) return;
            decorate(n);
          }
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
      processing = false;
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
