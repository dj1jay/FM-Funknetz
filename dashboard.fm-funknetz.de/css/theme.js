// FM-Funknetz – Light/Dark Theme Toggle
// Leg in html: <script src="css/theme.js" defer></script>
// Optionaler Button: <button id="themeToggle" class="theme-toggle" type="button">🌙 Dunkel</button>

(function(){
  const KEY = "fm_theme";      // 'light' | 'dark'
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");

  function sysPrefersDark(){
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function apply(theme){
    const normalized = theme === "light" ? "light" : "dark";
    root.setAttribute("data-theme", normalized);
    if (btn) btn.textContent = normalized === "light" ? "🌞" : "🌙 ";
  }

  // Initial: gespeicherte Wahl oder System
  const saved = localStorage.getItem(KEY);
  const initial = saved || (sysPrefersDark() ? "dark" : "light");
  apply(initial);

  // Reagiere auf Systemwechsel nur, wenn keine manuelle Wahl gespeichert ist
  if (!saved && window.matchMedia) {
    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", e => apply(e.matches ? "dark" : "light"));
    } catch(_) { /* ältere Browser meckern – egal */ }
  }

  // Button toggelt, speichert Wahl
  if (btn) {
    btn.addEventListener("click", () => {
      const cur = root.getAttribute("data-theme") || initial;
      const next = cur === "light" ? "dark" : "light";
      localStorage.setItem(KEY, next);
      apply(next);
    });
  }
})();