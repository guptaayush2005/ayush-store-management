// ==========================================================================
// AYUSH SERVICE CENTER — THEME SWITCHER SYSTEM (LIGHT & DARK THEME)
// Persistent theme controller with instant response and zero page flicker
// ==========================================================================

export function getCurrentTheme() {
  return localStorage.getItem("asc_theme") || "light";
}

export function setTheme(theme) {
  const activeTheme = theme === "dark" ? "dark" : "light";
  localStorage.setItem("asc_theme", activeTheme);
  document.documentElement.setAttribute("data-theme", activeTheme);

  if (activeTheme === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  // Update theme toggle buttons icon and title
  const themeButtons = document.querySelectorAll(".theme-toggle-btn");
  themeButtons.forEach(btn => {
    if (activeTheme === "dark") {
      btn.innerHTML = `☀️ <span class="theme-text hide-on-mobile" style="font-size: 0.82rem; font-weight: 700; margin-left: 4px;">Light</span>`;
      btn.title = "Switch to Light Mode";
      btn.setAttribute("aria-label", "Switch to Light Mode");
    } else {
      btn.innerHTML = `🌙 <span class="theme-text hide-on-mobile" style="font-size: 0.82rem; font-weight: 700; margin-left: 4px;">Dark</span>`;
      btn.title = "Switch to Dark Mode";
      btn.setAttribute("aria-label", "Switch to Dark Mode");
    }
  });

  window.dispatchEvent(new CustomEvent("asc-theme-changed", { detail: { theme: activeTheme } }));
}

export function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

export function initThemeSwitcher() {
  const current = getCurrentTheme();
  setTheme(current);

  document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleTheme();
    });
  });
}

