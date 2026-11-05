// APX DIGITAL Obsidian Dark Theme Toggle Logic
export function initThemeSwitcher() {
  const savedTheme = localStorage.getItem("asc_theme") || "light";
  applyTheme(savedTheme);

  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  });
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("asc_theme", theme);
  
  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    if (btn.classList.contains("theme-toggle-btn-drawer")) {
      btn.innerHTML = theme === "dark" 
        ? `<span style="font-size: 18px;">☀️</span> <span>Light Mode</span>` 
        : `<span style="font-size: 18px;">🌙</span> <span>APX Dark Mode</span>`;
    } else {
      btn.innerHTML = theme === "dark" ? "☀️" : "🌙";
    }
    btn.title = theme === "dark" ? "Switch to Light Mode" : "Switch to APX Dark Mode";
  });

  window.dispatchEvent(new CustomEvent("asc-theme-changed", { detail: { theme } }));
}
