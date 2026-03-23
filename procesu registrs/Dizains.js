/* Dizaina režīmi: tumšs / gaišs */
(function () {
  "use strict";

  var KEY = "pv_theme_mode";

  function byId(id) {
    return document.getElementById(id);
  }

  function getTheme() {
    try {
      var saved = localStorage.getItem(KEY);
      return saved === "light" ? "light" : "dark";
    } catch (_) {
      return "dark";
    }
  }

  function setTheme(theme) {
    var isLight = theme === "light";
    document.body.classList.toggle("theme-light", isLight);

    var btn = byId("themeToggleBtn");
    if (btn) {
      btn.textContent = isLight ? "Tumšais režīms" : "Gaišais režīms";
      btn.setAttribute("aria-pressed", isLight ? "true" : "false");
      btn.title = isLight ? "Pārslēgt uz tumšo dizainu" : "Pārslēgt uz gaišo dizainu";
    }

    try {
      localStorage.setItem(KEY, isLight ? "light" : "dark");
    } catch (_) {}
  }

  function initThemeToggle() {
    var btn = byId("themeToggleBtn");
    setTheme(getTheme());
    if (!btn) return;

    btn.addEventListener("click", function () {
      var isLight = document.body.classList.contains("theme-light");
      setTheme(isLight ? "dark" : "light");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initThemeToggle);
  } else {
    initThemeToggle();
  }
})();
