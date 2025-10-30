// js/theme.js
// Einheitliche Theme-Steuerung: Auto | Hell | Dunkel
(function () {
  'use strict';
  const STORAGE_KEY = 'appThemeMode';
  const html = document.documentElement;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');

  let mode = localStorage.getItem(STORAGE_KEY) || 'auto';
  apply(mode);

  // Wenn System-Theme wechselt und wir in Auto sind → anpassen
  mql.addEventListener?.('change', () => { if (mode === 'auto') apply('auto'); });

  // Optionaler globaler Button (falls du irgendwo #globalThemeBtn im Header hast)
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('globalThemeBtn');
    const state = document.getElementById('globalThemeState');
    if (!btn) return;
    btn.addEventListener('click', () => {
      mode = next(mode);
      localStorage.setItem(STORAGE_KEY, mode);
      apply(mode);
      btn.textContent = label(mode);
      if (state) state.textContent = mode === 'auto' ? '(System)' : '';
    });
    btn.textContent = label(mode);
    if (state) state.textContent = mode === 'auto' ? '(System)' : '';
  });

  // Seiten können auf dieses Event lauschen (Karte neu laden etc.)
  function emit(effective) {
    document.dispatchEvent(new CustomEvent('app:theme-changed', {
      detail: { mode, theme: effective } // theme: 'light' | 'dark'
    }));
  }
  function apply(next) {
    mode = (next === 'light' || next === 'dark') ? next : 'auto';
    html.setAttribute('data-theme-mode', mode);
    const effective = (mode === 'auto') ? (mql.matches ? 'dark' : 'light') : mode;
    html.setAttribute('data-theme', effective);
    emit(effective);
  }
  function next(m) { return m === 'auto' ? 'light' : m === 'light' ? 'dark' : 'auto'; }
  function label(m) { return m === 'auto' ? 'Auto' : m === 'light' ? 'Hell' : 'Dunkel'; }
})();