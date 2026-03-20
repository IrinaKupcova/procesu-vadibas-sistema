(function () {
  "use strict";

  function initViewCardToggle() {
    const card = document.getElementById("extraViewsCard");
    if (!card || card.dataset.toggleReady === "1") return !!card;

    const toolbar = card.querySelector(".toolbar");
    const left = toolbar ? toolbar.querySelector(".left") : null;
    if (!toolbar || !left) return false;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "toggleViewZoneBtn";
    btn.className = "secondary";
    btn.textContent = "Atvērt skatu";

    const right = document.createElement("div");
    right.className = "right";
    right.appendChild(btn);
    toolbar.appendChild(right);

    const sections = Array.from(card.children).filter((el) => !el.classList.contains("toolbar"));
    sections.forEach((el) => el.classList.add("hidden"));

    btn.addEventListener("click", () => {
      const isClosed = sections.every((el) => el.classList.contains("hidden"));
      if (isClosed) {
        const select = document.getElementById("extraViewSelect");
        const v = select ? select.value : "owners";
        const tasks = document.getElementById("tasksViewWrap");
        const owners = document.getElementById("ownersViewWrap");
        if (tasks) tasks.classList.toggle("hidden", v !== "tasks");
        if (owners) owners.classList.toggle("hidden", v !== "owners");
        btn.textContent = "Aizvērt skatu";
      } else {
        sections.forEach((el) => el.classList.add("hidden"));
        btn.textContent = "Atvērt skatu";
      }
    });

    card.dataset.toggleReady = "1";
    return true;
  }

  function boot() {
    if (initViewCardToggle()) return;
    setTimeout(boot, 200);
  }

  boot();
})();

