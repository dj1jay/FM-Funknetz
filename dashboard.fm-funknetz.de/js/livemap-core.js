// livemap-core.js – stabile Popups + CTCSS/Echolink unter Frequenz + deine bestehenden Features

const WS_URL = "wss://status.thueringen.link/mqtt";
const INDEX_TOPIC = "/server/state/nodes_index";
const NODES_TOPIC = "/server/state/nodes/+";
const LABEL_ZOOM = 10;

// Karte aufsetzen (deine Startposition beibehalten)
const map = L.map('map', { scrollWheelZoom: true }).setView([51.00, 10.45], 6);

// Theme-Unterstützung: manueller Button + optional globaler Auto-Hook
const lightTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 });
const darkTiles  = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',  { maxZoom: 19 });
let currentBase = 'dark';
darkTiles.addTo(map);

// Manueller Toggle-Button wie bei dir
const toggleBtn = document.getElementById('toggleMap');
if (toggleBtn) {
  toggleBtn.textContent = currentBase === 'dark' ? 'Karte: Dunkel' : 'Karte: Hell';
  toggleBtn.addEventListener('click', () => {
    if (currentBase === 'dark') {
      map.removeLayer(darkTiles); lightTiles.addTo(map); currentBase = 'light';
      toggleBtn.textContent = 'Karte: Hell';
    } else {
      map.removeLayer(lightTiles); darkTiles.addTo(map); currentBase = 'dark';
      toggleBtn.textContent = 'Karte: Dunkel';
    }
    setTimeout(()=> map.invalidateSize(), 0);
  });
}

// Optional: wenn du globales Theme (theme.js) nutzt, folgen die Tiles automatisch
document.addEventListener('app:theme-changed', (e) => {
  const theme = e?.detail?.theme || (document.documentElement.getAttribute('data-theme') || 'dark');
  const target = theme === 'light' ? 'light' : 'dark';
  if (target === currentBase) return;
  if (target === 'light') {
    map.removeLayer(darkTiles); lightTiles.addTo(map); currentBase = 'light';
    if (toggleBtn) toggleBtn.textContent = 'Karte: Hell';
  } else {
    map.removeLayer(lightTiles); darkTiles.addTo(map); currentBase = 'dark';
    if (toggleBtn) toggleBtn.textContent = 'Karte: Dunkel';
  }
  setTimeout(()=> map.invalidateSize(), 0);
});

// Leaflet-Icons als Data-URI (deine Variante beibehalten)
function iconUrl(svg){ return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg); }
const ICONS = {
  "1": L.icon({  // Antennenmast
    iconUrl: iconUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='12' fill='#1f2937' stroke='#60a5fa' stroke-width='2'/>
      <g transform='translate(13,13)' stroke='#60a5fa' stroke-width='2' fill='none'>
        <line x1='0' y1='-6' x2='0' y2='6'/>
        <line x1='-3' y1='6' x2='3' y2='6'/>
        <path d='M-5 -5 A7 7 0 0 1 5 -5'/>
        <path d='M-7 0 A10 10 0 0 1 7 0'/>
      </g>
    </svg>`),
    iconSize:[26,26], iconAnchor:[13,13], popupAnchor:[0,-12], tooltipAnchor:[0,-12]
  }),
  "2": L.icon({  // Haus mit Antenne
    iconUrl: iconUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='12' fill='#1f2937' stroke='#f59e0b' stroke-width='2'/>
      <g transform='translate(13,13)' stroke='#f59e0b' stroke-width='2' fill='none'>
        <path d='M-6 2 L0 -3 L6 2 V7 H-6 Z' fill='none'/>
        <line x1='2' y1='-2' x2='2' y2='-7'/>
        <path d='M1 -7 A2 2 0 0 1 3 -7'/>
      </g>
    </svg>`),
    iconSize:[26,26], iconAnchor:[13,13], popupAnchor:[0,-12], tooltipAnchor:[0,-12]
  }),
  "3": L.icon({  // kleines Kästchen mit Antenne
    iconUrl: iconUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 26 26'>
      <circle cx='13' cy='13' r='12' fill='#1f2937' stroke='#34d399' stroke-width='2'/>
      <g transform='translate(13,13)' stroke='#34d399' stroke-width='2' fill='none'>
        <rect x='-4' y='2' width='8' height='5'/>
        <line x1='0' y1='2' x2='0' y2='-5'/>
        <path d='M-2 -5 A3 3 0 0 1 2 -5'/>
      </g>
    </svg>`),
    iconSize:[26,26], iconAnchor:[13,13], popupAnchor:[0,-12], tooltipAnchor:[0,-12]
  }),
  "me": L.icon({  // Person
    iconUrl: iconUrl(`<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'>
      <circle cx='14' cy='14' r='12' fill='#1f2937' stroke='#f472b6' stroke-width='2'/>
      <g transform='translate(14,14)' fill='none' stroke='#f472b6' stroke-width='2'>
        <circle cx='0' cy='-3' r='3'/>
        <path d='M-6 7 C-5 2,5 2,6 7'/>
      </g>
    </svg>`),
    iconSize:[28,28], iconAnchor:[14,14], popupAnchor:[0,-14], tooltipAnchor:[0,-14]
  })
};

// Datenhaltung
const nodes   = new Map();
const markers = new Map();
let myMarker = null, myCircle = null, myPos = null;

// UI-Elemente
function $(id){ return document.getElementById(id); }
function checked(){ return { t1: $("t1")?.checked, t2: $("t2")?.checked, t3: $("t3")?.checked, me: $("me")?.checked }; }
const input = $('searchCall');
const datalist = $('callsDatalist');
const hint = $('searchHint');

// Utils
function escapeHtml(s){ return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function typeLabel(d){
  const t = String(d.Type ?? d.raw?.Type ?? "").trim();
  if (t === "1") return "Relais";
  if (t === "2") return "Simplex Link";
  if (t === "3") return "Privater Hotspot";
  return "—";
}
function typeCode(d){ const t = String(d.Type ?? d.raw?.Type ?? "").trim(); return t || "0"; }
function haversine(lat1, lon1, lat2, lon2){
  const R=6371e3, toRad=x=>x*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function fmtDist(m){ return m>=1000 ? (m/1000).toFixed(1)+' km' : Math.round(m)+' m'; }

// Autocomplete
function updateDatalist(prefix){
  const q = String(prefix||"").trim().toUpperCase();
  datalist && (datalist.innerHTML = "");
  if (!q){ hint && (hint.textContent = "Tippen zum Vorschlagen"); return; }
  const opts = [];
  for (const [call] of nodes){
    if (call && call.toUpperCase().startsWith(q)) opts.push(call);
    if (opts.length >= 25) break;
  }
  if (!opts.length){ hint && (hint.textContent = "Kein Treffer"); }
  else {
    hint && (hint.textContent = opts.length + " Vorschläge");
    if (datalist) datalist.innerHTML = opts.map(c => `<option value="${c}"></option>`).join("");
  }
}
function focusCall(call){
  if (!call) return;
  const key = [...nodes.keys()].find(k => k.toUpperCase() === call.toUpperCase());
  if (!key){ hint && (hint.textContent = "Nicht auf der Karte"); return; }
  const d = nodes.get(key), mk = markers.get(key);
  if (d && mk){
    map.flyTo([d.lat, d.lon], Math.max(map.getZoom(), 11), { duration: 0.6 });
    mk.fire('click');
  } else {
    hint && (hint.textContent = "Nicht auf der Karte");
  }
}
input && input.addEventListener('input', (e)=> updateDatalist(e.target.value));
input && input.addEventListener('keydown', (e)=> { if (e.key === 'Enter'){ focusCall(input.value.trim()); }});
$('btnGo') && $('btnGo').addEventListener('click', ()=> focusCall(input.value.trim()));

// Marker erzeugen/aktualisieren – FIX: Popup einmal binden, Inhalt dynamisch setzen
function upsertMarker(call){
  const d = nodes.get(call);
  if (!d || d.lat==null || d.lon==null) return;

  const code = typeCode(d);
  let mk = markers.get(call);

  if (!mk) {
    mk = L.marker([d.lat, d.lon], { icon: ICONS[code] || ICONS["1"] }).addTo(map);
    markers.set(call, mk);

    // Tooltip permanent, NICHT interaktiv (blockiert keine Klicks)
    mk.bindTooltip(
      `<span class="lbl">${escapeHtml(d.call||call)}</span>`,
      { direction:"top", offset:[0,-14], opacity:0.9, permanent:true, interactive:false }
    );

    // Popup EINMAL binden (leer) – Leaflet mag das lieber als nur Options
    mk.bindPopup("", {
      maxWidth: 480,
      closeButton: true,
      autoPan: true,
      keepInView: true,
      autoClose: true,
      closeOnClick: true
    });

    // Klick setzt den Inhalt neu und öffnet
    mk.on('click', () => {
      const dist = (myPos && d.lat!=null && d.lon!=null) ? fmtDist(haversine(myPos.lat, myPos.lon, d.lat, d.lon)) : "—";
      const rx = d.rx_freq ? escapeHtml(String(d.rx_freq)) : "—";
      const tx = d.tx_freq ? escapeHtml(String(d.tx_freq)) : "—";
      const sysop = d.sysop ? escapeHtml(String(d.sysop)) : "—";
      const tg = (d.tg != null) ? escapeHtml(String(d.tg)) : "0";

      // NEU: CTCSS + Echolink unter der Frequenz
      const ctcss = (d.CTCSS ?? d.ctcss ?? d.raw?.CTCSS);
      const ctcssTxt = (ctcss && String(ctcss).trim() !== "") ? escapeHtml(String(ctcss)) : "—";
      const echolink = (d.Echolink ?? d.echolink ?? d.raw?.Echolink);
      const echolinkTxt = (echolink && String(echolink).trim() !== "" && String(echolink).trim() !== "0")
        ? escapeHtml(String(echolink))
        : "—";

      const html = `
        <div style="min-width:260px">
          <div style="font-weight:900">${escapeHtml(d.call||call)}</div>
          <div class="muted">${escapeHtml(d.location||"")}</div>
          <div class="muted">Typ: ${escapeHtml(typeLabel(d))}</div>

          <div class="popup-row">
            <span class="popup-key">Frequenz<br>Tx:<br>Rx:</span>
            <span class="popup-val"><br>${tx} MHz<br>${rx} MHz</span>
          </div>

          <div class="popup-row"><span class="popup-key">CTCSS</span><span class="popup-val">${ctcssTxt}</span></div>
          <div class="popup-row"><span class="popup-key">Echolink</span><span class="popup-val">${echolinkTxt}</span></div>

          <div class="popup-row"><span class="popup-key">SysOp</span><span class="popup-val">${sysop}</span></div>
          <div class="popup-row"><span class="popup-key">Aktuelle TG</span><span class="popup-val">${tg}</span></div>
          <div class="popup-row"><span class="popup-key">Entfernung</span><span class="popup-val">${dist}</span></div>

          <div style="margin-top:6px">
            <a href="node.php?call=${encodeURIComponent(d.call||call)}" target="_blank" rel="noopener">Details</a>
          </div>
        </div>`;

      const pop = mk.getPopup();
      if (!pop) {
        mk.bindPopup(html, { maxWidth: 320, autoPan: true, keepInView: true, closeButton: true, autoClose: true, closeOnClick: false });
      } else {
        pop.setContent(html);
      }
      // Sicherheits-Combo: einmal schließen, dann öffnen
      mk.closePopup();
      mk.openPopup();
    });

  } else {
    // existierenden Marker aktualisieren
    mk.setLatLng([d.lat, d.lon]);
    mk.setIcon(ICONS[code] || ICONS["1"]);
    if (mk.getTooltip()) mk.setTooltipContent(`<span class="lbl">${escapeHtml(d.call||call)}</span>`);
  }
}

// Filter anwenden
function applyFilters(){
  const f = checked();
  for (const [call, mk] of markers){
    const d = nodes.get(call);
    const code = typeCode(d);
    const show = (code==="1"&&f.t1) || (code==="2"&&f.t2) || (code==="3"&&f.t3) || (code!=="1"&&code!=="2"&&code!=="3");
    if (show) mk.addTo(map); else mk.remove();
  }
  if (f.me) { myMarker && myMarker.addTo(map); myCircle && myCircle.addTo(map); }
  else { myMarker && myMarker.remove(); myCircle && myCircle.remove(); }

  const showLabels = map.getZoom() >= LABEL_ZOOM;
  for (const [, mk] of markers){
    const tt = mk.getTooltip();
    if (!tt) continue;
    if (showLabels) mk.openTooltip();
    else mk.closeTooltip();
  }
}

// Eigene Position
function updateMyPos(pos){
  myPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy };
  if (!myMarker){
    myMarker = L.marker([myPos.lat, myPos.lon], { icon: ICONS["me"] }).addTo(map);
    myMarker.bindTooltip(`<span class="lbl">Du</span>`, { direction:"top", offset:[0,-14], opacity:0.9, interactive:false, permanent:true });
    myCircle = L.circle([myPos.lat, myPos.lon], { radius: myPos.acc, color:"#f472b6", fillColor:"#f472b6", fillOpacity:0.15, weight:1 }).addTo(map);
  } else {
    myMarker.setLatLng([myPos.lat, myPos.lon]);
    myCircle.setLatLng([myPos.lat, myPos.lon]).setRadius(myPos.acc);
  }
  applyFilters();
}
if (navigator.geolocation){
  navigator.geolocation.getCurrentPosition(updateMyPos, ()=>{}, { enableHighAccuracy:true, timeout:8000, maximumAge:60000 });
  navigator.geolocation.watchPosition(updateMyPos, ()=>{}, { enableHighAccuracy:true, timeout:15000, maximumAge:60000 });
}

// Suche steuern
map.on('zoomend', applyFilters);
['t1','t2','t3','me'].forEach(id => { const el=$(id); el && el.addEventListener('change', applyFilters); });

// MQTT verbinden
const client = mqtt.connect(WS_URL, {
  reconnectPeriod: 3000,
  clean: true,
  clientId: 'livemap-' + Math.random().toString(16).slice(2,10)
});
client.on('connect', () => {
  client.subscribe([INDEX_TOPIC, NODES_TOPIC], { qos: 0 });
});
client.on('message', (topic, payload) => {
  const text = (payload instanceof Uint8Array) ? new TextDecoder().decode(payload) : String(payload);
  try {
    if (topic.startsWith('/server/state/nodes/')) {
      const d = JSON.parse(text);
      if (!d || !d.call) return;
      nodes.set(d.call, d);
      upsertMarker(d.call);
      applyFilters();
      if (input?.value?.trim()) updateDatalist(input.value.trim());
    }
  } catch(e){
    // JSON-Fehler ignorieren
  }
});