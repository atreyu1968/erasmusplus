(() => {
  const shell = document.querySelector(".shell");
  const sidebar = document.querySelector(".sidebar");
  const pin = document.querySelector(".sidebar-pin");
  if (!shell || !sidebar || !pin) return;

  const storageKey = "mmg-sidebar-pinned";
  let pinned = false;
  let hovered = false;
  let focusWithin = false;
  try {
    const savedPin = localStorage.getItem(storageKey);
    pinned = savedPin === null
      ? localStorage.getItem("mmg-sidebar-expanded") === "true"
      : savedPin === "true";
  } catch {}

  const update = () => {
    const open = pinned || hovered || focusWithin;
    shell.classList.toggle("sidebar-expanded", open);
    pin.setAttribute("aria-expanded", String(open));
    pin.setAttribute("aria-pressed", String(pinned));
    const label = pinned ? "Desfijar menú" : "Fijar menú abierto";
    pin.setAttribute("aria-label", label);
    pin.title = label;
  };

  update();

  if (typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    sidebar.addEventListener("pointerenter", () => {
      hovered = true;
      update();
    });
    sidebar.addEventListener("pointerleave", () => {
      hovered = false;
      update();
    });
  }

  sidebar.addEventListener("focusin", () => {
    focusWithin = true;
    update();
  });
  sidebar.addEventListener("focusout", () => {
    setTimeout(() => {
      focusWithin = sidebar.contains(document.activeElement);
      update();
    }, 0);
  });

  pin.addEventListener("click", () => {
    pinned = !pinned;
    if (!pinned) focusWithin = false;
    try {
      localStorage.setItem(storageKey, String(pinned));
    } catch {}
    update();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (pinned || hovered || focusWithin)) {
      pinned = false;
      hovered = false;
      focusWithin = false;
      try {
        localStorage.setItem(storageKey, "false");
      } catch {}
      document.querySelector(".brand")?.focus();
      update();
    }
  });
})();
