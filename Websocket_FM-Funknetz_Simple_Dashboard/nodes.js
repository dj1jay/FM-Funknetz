// nodes.js – Nodes + aktive TG-Bar
// Enthält: Sättigungsfarben, aktive TG-Chips unter der Überschrift, Klick-Filter + Löschen

(function nodesModule(){
  const GRID = document.getElementById("nodesGrid") || document.getElementById("nodesContainer");
  const TG_BAR = document.getElementById("activeTGsBar");
  if (!GRID) return;

  // Warten, bis der Haupt-Client aus index.html da ist
  const waitForClient = () => new Promise((resolve) => {
    const iv = setInterval(() => {
      if (window.fmClient) { clearInterval(iv); resolve(window.fmClient); }
    }, 100);
  });

  // Datenhaltung
  const nodes = new Map();     // call -> nodeData (aus /server/state/nodes/<CALL>)
  let callsIndex = [];         // alphabetisch sortiert
  let subscribed = false;
  let currentTGFilter = null;  // string oder null

  // =========================
  // Farbmodell für TGs
  // =========================
  const TG_BASE_COLORS = {
    "1":  "#f87171",  // Rot
    "2":  "#3b82f6",  // Blau
    "23": "#06b6d4",  // Türkis
    "24": "#0ea5e9",  // Hellblau
    "25": "#10b981",  // Grün
    "26": "#2563eb",  // Dunkelblau
    "27": "#38bdf8",  // Cyan
    "91": "#f59e0b",  // Orange
    "13": "#a855f7",  // Violett
    "default": "#9ca3af" // Grau
  };
  function varyLightness(hex, percent) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    let r = parseInt(m[1],16);
    let g = parseInt(m[2],16);
    let b = parseInt(m[3],16);
    const factor = 1 + (percent / 100);
    r = Math.min(255, Math.max(0, r * factor));
    g = Math.min(255, Math.max(0, g * factor));
    b = Math.min(255, Math.max(0, b * factor));
    return "#" + ((1<<24) | (r<<16) | (g<<8) | b).toString(16).slice(1);
  }
  function colorForTG(tgStr){
    if (!tgStr) return TG_BASE_COLORS.default;
    const s = String(tgStr);
    const baseKey = Object.keys(TG_BASE_COLORS).find(k => s.startsWith(k)) || "default";
    const base = TG_BASE_COLORS[baseKey];
    const last = parseInt(s.slice(-1), 10);
    const variantPct = isNaN(last) ? 0 : (last - 5) * 10; // -50..+50 %
    return varyLightness(base, variantPct);
  }
  function rgba(hex, a){
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const r=parseInt(m[1],16), g=parseInt(m[2],16), b=parseInt(m[3],16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0,Math.min(1,a))})`;
  }

  // Helpers
  function toTG(n){
    const v = (n && (n.tg ?? n.raw?.tg ?? 0));
    const num = Number.parseInt(String(v), 10);
    return Number.isNaN(num) ? 0 : num;
  }
  function getDefaultTG(n){
    const v = (n && (n.default_tg ?? n.DefaultTG ?? n.raw?.DefaultTG ?? 0));
    return String(v || 0);
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
  function escapeHtml(s) {
    return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }
  function normalizeTG(s){ return String(s||"").replace(/^TG\s*/i,"").replace(/^0+/,"").trim(); }

  // aktive TGs aus fmActive: Map<tg, {count, calls:Set}>
  function computeActiveTGs(){
    const out = new Map();
    const A = (window.fmActive && typeof window.fmActive.forEach === "function") ? window.fmActive : null;
    if (!A) return out;
    A.forEach(v => {
      const tg = normalizeTG(v?.tg);
      const call = String(v?.call || "").trim();
      if (!tg || !call) return;
      if (!out.has(tg)) out.set(tg, { count: 0, calls: new Set() });
      const entry = out.get(tg);
      entry.calls.add(call);
      entry.count = entry.calls.size;
    });
    return out;
  }

  function getActiveCallsForTG(tg){
    const map = computeActiveTGs();
    return map.get(String(tg))?.calls || new Set();
  }

  function renderTGBar(){
    if (!TG_BAR) return;
    const activeMap = computeActiveTGs();
    const entries = Array.from(activeMap.entries())
      .sort((a,b) => Number(b[1].count) - Number(a[1].count));

    if (entries.length === 0){
      TG_BAR.innerHTML = `<span class="small" style="opacity:.8;">Keine aktiven TGs</span>`;
      return;
    }

    const chips = entries.map(([tg, info]) => {
      const col = colorForTG(tg);
      const sel = String(currentTGFilter||"") === String(tg);
      const style = `border:1px solid ${col}; color:${col}; background:${rgba(col,0.2)};` + (sel ? " box-shadow:0 0 0 2px "+rgba(col,0.35)+";" : "");
      return `<button class="tgchip" data-tg="${tg}" title="TG ${tg} – ${info.count} Node(s)" style="${style}">
        <span class="mono">${escapeHtml(tg)}</span>
        <span class="count">${info.count}</span>
      </button>`;
    });

    if (currentTGFilter){
      chips.unshift(`<button class="tgchip clear" id="tgClear" title="Filter löschen">× löschen</button>`);
    }

    TG_BAR.innerHTML = chips.join("");

    TG_BAR.querySelectorAll(".tgchip[data-tg]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tg = btn.getAttribute("data-tg");
        currentTGFilter = String(tg);
        renderFiltered();
      });
    });
    const clear = document.getElementById("tgClear");
    if (clear) clear.addEventListener("click", () => { currentTGFilter = null; renderOnce(); renderTGBar(); });
  }

  function renderOnce() {
    if (!callsIndex.length) { GRID.innerHTML = '<div class="meta">Keine Nodes geladen.</div>'; return; }
    const pieces = [];
    for (const call of callsIndex) {
      const n = nodes.get(call) || {};
      const tgNum = toTG(n);
      const tgStr = String(tgNum);
      const active = tgNum > 1;
      const col   = active ? colorForTG(tgStr) : "";
      const badgeStyle = active
        ? `border:1px solid ${col}; color:${col}; background:${rgba(col,0.2)}; font-weight:700;`
        : `border:1px solid #374151; color:#e5e7eb; background:#1f2937;`;
      const title = tooltipFor(call, n);

      pieces.push(`
        <button class="node-btn${active ? " active":""}" data-call="${call}"
          title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:64px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;cursor:pointer;">
          <div class="call" style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(call)}</div>
          <div class="meta" style="display:flex;gap:8px;justify-content:center;">
            <span class="tg-chip" style="display:inline-block;padding:2px 8px;border-radius:999px;${badgeStyle}">${escapeHtml(tgStr)}</span>
          </div>
        </button>
      `);
    }
    GRID.innerHTML = pieces.join("");
  }

  function renderFiltered(){
    if (!currentTGFilter){
      renderOnce();
      renderTGBar();
      return;
    }
    const callsSet = getActiveCallsForTG(currentTGFilter);
    const list = callsIndex.filter(c => callsSet.has(c));
    if (list.length === 0){
      GRID.innerHTML = `<div class="meta">TG <b>${escapeHtml(currentTGFilter)}</b>: keine aktiven Clients.</div>`;
      renderTGBar();
      return;
    }
    const pieces = [];
    for (const call of list) {
      const n = nodes.get(call) || {};
      const col = colorForTG(currentTGFilter);
      const badgeStyle = `border:1px solid ${col}; color:${col}; background:${rgba(col,0.2)}; font-weight:700;`;
      const title = tooltipFor(call, n);
      pieces.push(`
        <button class="node-btn active" data-call="${call}"
          title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:64px;border:1px solid #374151;background:#1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;cursor:pointer;">
          <div class="call" style="font-weight:700;font-size:14px;margin-bottom:4px;">${escapeHtml(call)}</div>
          <div class="meta" style="display:flex;gap:8px;justify-content:center;">
            <span class="tg-chip" style="display:inline-block;padding:2px 8px;border-radius:999px;${badgeStyle}">${escapeHtml(currentTGFilter)}</span>
          </div>
        </button>
      `);
    }
    GRID.innerHTML = pieces.join("");
    renderTGBar();
  }

  function lightweightUpdate() {
    renderTGBar();
    if (currentTGFilter) {
      renderFiltered();
      return;
    }
    const buttons = GRID.querySelectorAll(".node-btn");
    for (const btn of buttons) {
      const call = btn.getAttribute("data-call");
      const n = nodes.get(call) || {};
      const tgNum = toTG(n);
      const tgStr = String(tgNum);
      const active = tgNum > 1;
      btn.classList.toggle("active", active);

      const chip = btn.querySelector(".tg-chip");
      if (chip) {
        chip.textContent = tgStr;
        if (active) {
          const col = colorForTG(tgStr);
          chip.style.border = `1px solid ${col}`;
          chip.style.color = col;
          chip.style.background = rgba(col, 0.2);
          chip.style.fontWeight = "700";
        } else {
          chip.style.border = "1px solid #374151";
          chip.style.color = "#e5e7eb";
          chip.style.background = "#1f2937";
          chip.style.fontWeight = "";
        }
      }
      const title = tooltipFor(call, n);
      if (btn.title !== title) { btn.title = title; btn.setAttribute("aria-label", title); }
    }
  }

  function subscribeTopics(client) {
    if (subscribed) return;
    subscribed = true;
    try {
      client.subscribe("/server/state/nodes_index", { qos: 0 });
      client.subscribe("/server/state/nodes/+", { qos: 0 });
    } catch(e) {
      console.error("Subscribe error in nodes.js:", e);
    }

    GRID.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".node-btn");
      if (!btn) return;
      const call = btn.getAttribute("data-call");
      if (call) window.open(`node.html?call=${encodeURIComponent(call)}`, "_blank");
    });

    client.on("message", (topic, payload) => {
      try {
        if (topic === "/server/state/nodes_index") {
          const txt = (typeof payload === "string") ? payload : new TextDecoder().decode(payload);
          const arr = JSON.parse(txt);
          if (Array.isArray(arr)) {
            callsIndex = arr.slice().sort((a,b) => String(a).localeCompare(String(b)));
            currentTGFilter ? renderFiltered() : renderOnce();
          }
          return;
        }
        if (topic.startsWith("/server/state/nodes/")) {
          const call = topic.split("/").pop();
          const txt = (typeof payload === "string") ? payload : new TextDecoder().decode(payload);
          const obj = JSON.parse(txt);
          if (call) {
            nodes.set(call, obj || {});
            if (!callsIndex.includes(call)) {
              callsIndex.push(call);
              callsIndex.sort((a,b) => String(a).localeCompare(String(b)));
            }
            currentTGFilter ? renderFiltered() : renderOnce();
          }
          return;
        }
      } catch(e) {
        // still
      }
    });
  }

  waitForClient().then((client) => {
    subscribeTopics(client);
    renderTGBar();
    setInterval(lightweightUpdate, 1000);
  });
})();