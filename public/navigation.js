(() => {
  const shell = document.querySelector(".shell");
  const toggle = document.querySelector(".sidebar-toggle");
  if (!shell || !toggle) return;

  const storageKey = "mmg-sidebar-expanded";
  let expanded = false;
  try {
    expanded = localStorage.getItem(storageKey) === "true";
  } catch {}

  const setExpanded = (value) => {
    expanded = value;
    shell.classList.toggle("sidebar-expanded", expanded);
    toggle.setAttribute("aria-expanded", String(expanded));
    const label = expanded ? "Contraer menú" : "Expandir menú";
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  };

  setExpanded(expanded);
  toggle.addEventListener("click", () => {
    setExpanded(!expanded);
    try {
      localStorage.setItem(storageKey, String(expanded));
    } catch {}
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && expanded) {
      setExpanded(false);
      try {
        localStorage.setItem(storageKey, "false");
      } catch {}
      toggle.focus();
    }
  });
})();
