// nodes.js – Zwei Dropdowns: "Aktive TG" und "Monitored TG"
// Zählweise: COUNT_MODE = "live" | "lazy" | "none"
// - live: Zähler in den Dropdowns, laufend aus nodes berechnet
// - lazy: Zähler nicht im Dropdown, nur nach Auswahl rendern
// - none: nie Zähler anzeigen
//
// Filterlogik: Wenn "Aktive TG" gewählt, zeige nur Nodes mit tg == Auswahl.
// Sonst, wenn "Monitored TG" gewählt, zeige nur Nodes mit monitoredTGs enthält Auswahl.
// Beide Listen numerisch aufsteigend sortiert.

(function nodesModule(){
  const GRID       = document.getElementById("nodesGrid") || document.getElementById("nodesContainer");
  const TG_SELECT  = document.getElementById("tgSelect");
  const TG_CLEAR   = document.getElementById("tgClearBtn");
  const MON_SELECT = document.getElementById("monSelect");
  const MON_CLEAR  = document.getElementById("monClearBtn");
  if (!GRID || !TG_SELECT || !MON_SELECT) return;

  // ======= EINSTELLUNG: Zählmodus =======
  const COUNT_MODE = "lazy";  // "live" | "lazy" | "none"

  // auf globalen MQTT-Client warten
  const waitForClient = () => new Promise((resolve) => {
    const iv = setInterval(() => { if (window.fmClient) { clearInterval(iv); resolve(window.fmClient); } }, 100);
  });

  // Daten
  const nodes = new Map(); // call -> nodeData
  let callsIndex = [];
  let subscribed = false;
  let currentActiveTG = "";    // "" == Alle
  let currentMonitoredTG = ""; // "" == kein Monitored-Filter

  // Farben
  const TG_BASE_COLORS = {
    "1":  "#f87171", "2":  "#3b82f6", "23": "#06b6d4", "24": "#0ea5e9",
    "25": "#10b981", "26": "#2563eb", "27": "#38bdf8", "91": "#f59e0b",
    "13": "#a855f7", "default": "#9ca3af"
  };
  function varyLightness(hex, percent) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    let r = parseInt(m[1],16), g = parseInt(m[2],16), b = parseInt(m[3],16);
    const f = 1 + (percent / 100);
    r = Math.min(255, Math.max(0, r * f));
    g = Math.min(255, Math.max(0, g * f));
    b = Math.min(255, Math.max(0, b * f));
    return "#" + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
  }
  function colorForTG(tgStr){
    if (!tgStr) return TG_BASE_COLORS.default;
    const s = String(tgStr);
    const key = Object.keys(TG_BASE_COLORS).find(k => s.startsWith(k)) || "default";
    const base = TG_BASE_COLORS[key];
    const last = parseInt(s.slice(-1), 10);
    const pct = isNaN(last) ? 0 : (last - 5) * 10; // -50..+50
    return varyLightness(base, pct);
  }
  function rgba(hex, a){
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r=parseInt(m[1],16), g=parseInt(m[2],16), b=parseInt(m[3],16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0,Math.min(1,a))})`;
  }

  // Helpers
  function escapeHtml(s) { return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function toTG(n){
    const v = (n && (n.tg ?? n.raw?.tg ?? 0));
    const num = Number.parseInt(String(v), 10);
    return Number.isNaN(num) ? 0 : num;
  }
  function getDefaultTG(n){
    const v = (n && (n.default_tg ?? n.DefaultTG ?? n.raw?.DefaultTG ?? 0));
    return String(v || 0);
  }
  function getMonitored(n){
    const m = n?.monitoredTGs || n?.raw?.monitoredTGs;
    return Array.isArray(m) ? m.map(x => String(x)) : [];
  }
  function getLocation(n){
    return (n?.location || n?.raw?.nodeLocation || n?.raw?.Location || "").trim();
  }
  function tooltipFor(call, n){
    const loc = getLocation(n);
    const dft = getDefaultTG(n);
    const parts = [call];
    if (loc) parts.push(loc);
    parts.push("Default TG: " + dft);
    return parts.join(" • ");
  }

  // Aktive TGs (nur tuned, tg>1) numerisch aufsteigend
  function computeActiveTGs(){
    const map = new Map(); // tg -> count
    nodes.forEach((n) => {
      const tg = toTG(n);
      if (tg > 1) {
        const key = String(tg);
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([tg,count]) => ({ tg, count }))
      .sort((a,b) => Number(a.tg) - Number(b.tg));
  }

  // Monitored TGs numerisch aufsteigend
  function computeMonitoredTGs(){
    const map = new Map(); // tg -> count
    nodes.forEach((n) => {
      for (const t of getMonitored(n)) {
        if (!/^\d+$/.test(t)) continue;
        map.set(t, (map.get(t) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([tg,count]) => ({ tg, count }))
      .sort((a,b) => Number(a.tg) - Number(b.tg));
  }

  // Dropdowns befüllen (COUNT_MODE steuert Label)
  function renderTGSelects(){
    const listActive = computeActiveTGs();
    TG_SELECT.innerHTML = `<option value="">Alle</option>` + listActive.map(e => {
      const label = COUNT_MODE === "live" ? `TG ${e.tg} (${e.count})` : `TG ${e.tg}`;
      return `<option value="${escapeHtml(e.tg)}"${currentActiveTG === String(e.tg) ? " selected":""}>${escapeHtml(label)}</option>`;
    }).join("");
    if (TG_CLEAR) TG_CLEAR.style.display = currentActiveTG ? "inline-block" : "none";

    const listMon = computeMonitoredTGs();
    MON_SELECT.innerHTML = `<option value="">—</option>` + listMon.map(e => {
      const label = COUNT_MODE === "live" ? `TG ${e.tg} (${e.count})` : `TG ${e.tg}`;
      return `<option value="${escapeHtml(e.tg)}"${currentMonitoredTG === String(e.tg) ? " selected":""}>${escapeHtml(label)}</option>`;
    }).join("");
    if (MON_CLEAR) MON_CLEAR.style.display = currentMonitoredTG ? "inline-block" : "none";
  }

  // Nodes rendern (ungefiltert)
  function renderOnce() {
    if (!callsIndex.length) { GRID.innerHTML = '<div class="meta">Keine Nodes geladen.</div>'; return; }
    const pieces = [];
    for (const call of callsIndex) {
      const n = nodes.get(call) || {};
      const tgNum = toTG(n), tgStr = String(tgNum);
      const active = tgNum > 1;
      const col = active ? colorForTG(tgStr) : "";
      const badgeStyle = active
        ? `border:1px solid ${col}; color:${col}; background:${rgba(col,0.2)}; font-weight:700;`
        : `border:1px solid #374151; color:#e5e7eb; background:#1f2937;`;
      const title = tooltipFor(call, n);

      pieces.push(`
        <button class="node-btn${active ? " active":""}" data-call="${call}"
          title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
          <div class="call" style="margin-bottom:4px;">${escapeHtml(call)}</div>
          <div class="meta"><span class="tg-chip" style="display:inline-block;padding:2px 8px;border-radius:999px;${badgeStyle}">${escapeHtml(tgStr)}</span></div>
        </button>`);
    }
    GRID.innerHTML = pieces.join("");
  }

  // Gefiltert: Priorität Aktive TG, sonst Monitored TG
  function renderFiltered(){
    if (currentActiveTG) {
      const t = String(currentActiveTG);
      const list = callsIndex.filter(c => String(toTG(nodes.get(c) || {})) === t);
      if (!list.length){
        GRID.innerHTML = `<div class="meta">TG <b>${escapeHtml(t)}</b>: kein Node in Sprechgruppe aktiv.</div>`;
        return;
      }
      GRID.innerHTML = list.map(call => {
        const n = nodes.get(call) || {};
        const col = colorForTG(t);
        const badgeStyle = `border:1px solid ${col}; color:${col}; background:${rgba(col,0.2)}; font-weight:700;`;
        const title = tooltipFor(call, n);
        return `
          <button class="node-btn active" data-call="${call}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
            <div class="call" style="margin-bottom:4px;">${escapeHtml(call)}</div>
            <div class="meta"><span class="tg-chip" style="display:inline-block;padding:2px 8px;border-radius:999px;${badgeStyle}">${escapeHtml(t)}</span></div>
          </button>`;
      }).join("");
      return;
    }
    if (currentMonitoredTG) {
      const t = String(currentMonitoredTG);
      const list = callsIndex.filter(c => getMonitored(nodes.get(c) || {}).includes(t));
      if (!list.length){
        GRID.innerHTML = `<div class="meta">Monitored TG <b>${escapeHtml(t)}</b>: kein Node hört diese TG.</div>`;
        return;
      }
      GRID.innerHTML = list.map(call => {
        const n = nodes.get(call) || {};
        const col = colorForTG(t);
        const badgeStyle = `border:1px solid ${col}; color:${col}; background:${rgba(col,0.2)}; font-weight:700;`;
        const title = tooltipFor(call, n);
        return `
          <button class="node-btn" data-call="${call}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">
            <div class="call" style="margin-bottom:4px;">${escapeHtml(call)}</div>
            <div class="meta"><span class="tg-chip" style="display:inline-block;padding:2px 8px;border-radius:999px;${badgeStyle}">${escapeHtml(t)}</span></div>
          </button>`;
      }).join("");
      return;
    }
    renderOnce();
  }

  // Tick: bei live-Zählern Dropdowns neu berechnen; bei lazy/none seltener reicht auch
  function tick(){
    if (COUNT_MODE === "live") renderTGSelects();
    if (currentActiveTG || currentMonitoredTG) renderFiltered();
  }

  // MQTT abonnieren
  function subscribeTopics(client) {
    if (subscribed) return; subscribed = true;
    client.subscribe("/server/state/nodes_index", { qos: 0 });
    client.subscribe("/server/state/nodes/+", { qos: 0 });

    GRID.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".node-btn");
      if (!btn) return;
      const call = btn.getAttribute("data-call");
      if (call) window.open(`node.php?call=${encodeURIComponent(call)}`, "_blank");
    });

    client.on("message", (topic, payload) => {
      const txt = (typeof payload === "string") ? payload : new TextDecoder().decode(payload);

      // FIXED: keine doppelte Klammer mehr
      if (topic === "/server/state/nodes_index") {
        const arr = JSON.parse(txt);
        if (Array.isArray(arr)) {
          callsIndex = arr.slice().sort((a,b) => String(a).localeCompare(String(b)));
          (currentActiveTG || currentMonitoredTG) ? renderFiltered() : renderOnce();
          if (COUNT_MODE !== "none") renderTGSelects();
        }
        return;
      }

      if (topic.startsWith("/server/state/nodes/")) {
        const call = topic.split("/").pop();
        const obj = JSON.parse(txt);
        if (call) {
          nodes.set(call, obj || {});
          if (!callsIndex.includes(call)) {
            callsIndex.push(call);
            callsIndex.sort((a,b) => String(a).localeCompare(String(b)));
          }
          (currentActiveTG || currentMonitoredTG) ? renderFiltered() : renderOnce();
          if (COUNT_MODE !== "none") renderTGSelects();
        }
      }
    });
  }

  // Events
  TG_SELECT.addEventListener("change", () => {
    currentActiveTG = TG_SELECT.value || "";
    if (currentActiveTG) { currentMonitoredTG = ""; MON_SELECT.value = ""; }
    renderFiltered();
    if (COUNT_MODE !== "none") renderTGSelects();
  });
  MON_SELECT.addEventListener("change", () => {
    currentMonitoredTG = MON_SELECT.value || "";
    if (currentMonitoredTG) { currentActiveTG = ""; TG_SELECT.value = ""; }
    renderFiltered();
    if (COUNT_MODE !== "none") renderTGSelects();
  });
  if (TG_CLEAR) TG_CLEAR.addEventListener("click", () => {
    currentActiveTG = ""; TG_SELECT.value = ""; renderFiltered(); if (COUNT_MODE !== "none") renderTGSelects();
  });
  if (MON_CLEAR) MON_CLEAR.addEventListener("click", () => {
    currentMonitoredTG = ""; MON_SELECT.value = ""; renderFiltered(); if (COUNT_MODE !== "none") renderTGSelects();
  });

  waitForClient().then((client) => {
    subscribeTopics(client);
    if (COUNT_MODE !== "none") renderTGSelects();
    setInterval(tick, 1500);
  });
})();