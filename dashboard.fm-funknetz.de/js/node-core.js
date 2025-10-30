// js/node-core.js
// Node-Detail: /node.php?call=<CALL>
// Datenquelle: /server/state/nodes/<CALL>

(function(){
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    const root = document.getElementById('nodeRoot');
    if (!root) return;

    const WS_URL = root.dataset.wsUrl || "wss://status.thueringen.link/mqtt";
    const CALL   = (root.dataset.call || "DB0MGN").trim();

    const $ = s => document.querySelector(s);
    const ndCall = $("#ndCall");

    // Allgemein
    const kvCall = $("#kvCall");
    const kvLocation = $("#kvLocation");
    const kvLocator = $("#kvLocator");
    const kvCoords = $("#kvCoords");
    const kvSysop = $("#kvSysop");
    const kvVerbund = $("#kvVerbund");
    const kvWebsite = $("#kvWebsite");

    // Funk
    const kvMode = $("#kvMode");
    const kvRxtx = $("#kvRxtx");
    const kvCTCSS = $("#kvCTCSS");
    const kvEcholink = $("#kvEcholink");
    const kvTG = $("#kvTG");
    const kvDefTG = $("#kvDefTG");
    const kvSoftware = $("#kvSoftware");

    // Client-Link
    const clientLink = $("#clientLink");

    // Karte / Entfernung / Karten-Theme
    const btnUseGeo = $("#btnUseGeo");
    const locatorInput = $("#locatorInput");
    const btnUseLocator = $("#btnUseLocator");
    const distOut = $("#distOut");
    const btnMapTheme = $("#btnMapTheme");

    let nodeLat = null, nodeLon = null;
    let map = null, marker = null, currentTiles = null;

    // Map-Theme: 'auto' | 'light' | 'dark'
    let mapThemeMode = localStorage.getItem('mapThemeMode') || 'auto';
    updateMapThemeButton();

    if (ndCall) ndCall.textContent = CALL;
    if (clientLink) clientLink.href = `client.php?call=${encodeURIComponent(CALL)}`;

    // MQTT verbinden
    let mqttClient = null;
    try {
      mqttClient = mqtt.connect(WS_URL, {
        reconnectPeriod: 3000,
        keepalive: 30,
        clean: true,
        clientId: "fm-node-" + Math.random().toString(16).slice(2,10),
      });
    } catch (e) {
      console.warn("MQTT connect fail:", e);
      return;
    }

    const NODE_TOPIC = `/server/state/nodes/${CALL}`;
    mqttClient.on("connect", ()=>{
      mqttClient.subscribe(NODE_TOPIC, { qos: 0 }, err => { if (err) console.warn("subscribe error", err); });
    });
    mqttClient.on("message", (topic, payload)=>{
      if (topic !== NODE_TOPIC) return;
      const text = (typeof payload === "string") ? payload : new TextDecoder().decode(payload);
      let msg = null;
      try { msg = JSON.parse(text); } catch {}
      if (!msg) return;
      renderNode(msg);
    });

    // Marker-Icons (absolute Pfade – so wie es bei dir klappt)
    if (typeof L !== "undefined" && L.Icon && L.Icon.Default) {
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/marker-icon-2x.png',
        iconUrl:       '/marker-icon.png',
        shadowUrl:     '/marker-shadow.png'
      });
    }

    function renderNode(m){
      // Datenquellen: top-level und ggf. raw.*
      const call = m.call || m.raw?.Call || CALL;
      setText(kvCall, call);

      const locText = m.location || m.nodeLocation || m.raw?.Location || "keine Daten vorhanden";
      setText(kvLocation, locText);

      const locator = m.locator || m.raw?.Locator || "";
      setText(kvLocator, locator || "keine Daten vorhanden");

      const mode = m.mode || m.raw?.Mode || "—";
      setText(kvMode, mode);

      const rx = m.rx_freq || m.raw?.RXFREQ || "";
      const tx = m.tx_freq || m.raw?.TXFREQ || "";
      setText(kvRxtx, (rx && tx) ? `${rx} / ${tx}` : (rx || tx || "keine Daten vorhanden"));

      const ctcss = normCTCSS(m.CTCSS || m.ctcss || m.raw?.CTCSS);
      setText(kvCTCSS, ctcss || "keine Daten vorhanden");

      const echolink = (m.Echolink ?? m.echolink ?? m.raw?.Echolink ?? "");
      setText(kvEcholink, (String(echolink).trim() === "" || String(echolink).trim() === "0") ? "—" : String(echolink).trim());

      const tg = (m.tg !== undefined ? m.tg : m.raw?.tg);
      setText(kvTG, tg === undefined || tg === null ? "—" : String(tg));

      const defTG = m.default_tg || m.DefaultTG || m.raw?.DefaultTG || "";
      setText(kvDefTG, defTG || "—");

      const swName = m.sw || m.raw?.sw || "SvxLink";
      const swVer  = m.swVer || m.raw?.swVer || "";
      setText(kvSoftware, swVer ? `${swName} ${swVer}` : swName);

      const lat = num(m.lat ?? m.LAT ?? m.raw?.LAT);
      const lon = num(m.lon ?? m.LONG ?? m.raw?.LONG);
      if (isFinite(lat) && isFinite(lon)) {
        nodeLat = lat; nodeLon = lon;
        setText(kvCoords, `${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        ensureMap(lat, lon, call);
      } else {
        setText(kvCoords, "keine Daten vorhanden");
      }

      const verbund = m.verbund || m.Verbund || m.raw?.Verbund || "—";
      setText(kvVerbund, verbund);

      const sysop = m.sysop || m.SysOp || m.raw?.SysOp || m.raw?.Sysop || "—";
      setText(kvSysop, sysop);

      const websiteRaw = m.website || m.Website || m.raw?.Website || "";
      const websiteUrl = normalizeUrl(websiteRaw);
      if (websiteUrl) {
        const nice = websiteUrl.replace(/^https?:\/\//i, "");
        setHTML(kvWebsite, `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener">${escapeHtml(nice)}</a>`);
      } else {
        setText(kvWebsite, "—");
      }
    }

    // Karte aufbauen + robust neu messen
    function ensureMap(lat, lon, label){
      if (typeof L === "undefined") return; // Leaflet nicht geladen

      const tileUrl = tileUrlFor(effectiveMapTheme());

      if (!map) {
        map = L.map('map', { zoomControl: true, attributionControl: false });
        currentTiles = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
        map.setView([lat, lon], 11);

        // Nach Layout/Webfonts neu messen
        setTimeout(()=> map.invalidateSize(), 0);
        setTimeout(()=> map.invalidateSize(), 300);
      } else {
        // Tile-Layer wechseln, falls Theme geändert wurde
        if (!currentTiles || currentTiles._url !== tileUrl) {
          if (currentTiles) map.removeLayer(currentTiles);
          currentTiles = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);
        }
        map.setView([lat, lon], map.getZoom());
        setTimeout(()=> map.invalidateSize(), 0);
      }

      if (marker) { marker.setLatLng([lat, lon]).setPopupContent(label); }
      else { marker = L.marker([lat, lon]).addTo(map).bindPopup(label); }
    }

    // Browser-Resize → neu messen
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (!map) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=> map.invalidateSize(), 150);
    });

    // Beobachte Seitenthema, ABER nur relevant, wenn mapThemeMode === 'auto'
    const mo = new MutationObserver(() => {
      if (mapThemeMode !== 'auto' || !map || marker == null) return;
      const ll = marker.getLatLng();
      ensureMap(ll.lat, ll.lng, marker.getPopup()?.getContent() || '');
      setTimeout(()=> map.invalidateSize(), 50);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    // Karten-Theme Umschalter (Auto/Hell/Dunkel, nur Karte)
    if (btnMapTheme) {
      btnMapTheme.addEventListener('click', () => {
        mapThemeMode = nextThemeMode(mapThemeMode);
        localStorage.setItem('mapThemeMode', mapThemeMode);
        updateMapThemeButton();
        if (map && marker) {
          const ll = marker.getLatLng();
          ensureMap(ll.lat, ll.lng, marker.getPopup()?.getContent() || '');
          setTimeout(()=> map.invalidateSize(), 50);
        }
      });
    }

    function nextThemeMode(cur){
      if (cur === 'auto') return 'light';
      if (cur === 'light') return 'dark';
      return 'auto';
    }

    function effectiveMapTheme(){
      if (mapThemeMode === 'light' || mapThemeMode === 'dark') return mapThemeMode;
      const page = (document.documentElement.getAttribute('data-theme') || 'dark');
      return page === 'light' ? 'light' : 'dark';
    }

    function updateMapThemeButton(){
      if (!btnMapTheme) return;
      const mode = mapThemeMode;
      btnMapTheme.textContent = (mode === 'auto') ? 'Auto' : (mode === 'light' ? 'Hell' : 'Dunkel');
      btnMapTheme.title = 'Kartenstil: Auto/Hell/Dunkel (klick wechselt)';
    }

///// neu drinne geht es?

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

    function tileUrlFor(theme){
      return theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    }

    // Entfernung
    if (btnUseGeo) {
      btnUseGeo.addEventListener('click', ()=>{
        if (!nodeLat || !nodeLon) { setText(distOut, "Node-Koordinaten unbekannt."); return; }
        if (!navigator.geolocation) { setText(distOut, "Geolocation nicht verfügbar."); return; }
        navigator.geolocation.getCurrentPosition(
          pos => {
            const km = haversine(pos.coords.latitude, pos.coords.longitude, nodeLat, nodeLon);
            setText(distOut, `Entfernung: ${km.toFixed(1)} km`);
          },
          err => { setText(distOut, `Geolocation-Fehler: ${err.message || err.code}`); },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
    }
    if (btnUseLocator) {
      btnUseLocator.addEventListener('click', ()=>{
        if (!nodeLat || !nodeLon) { setText(distOut, "Node-Koordinaten unbekannt."); return; }
        const loc = (locatorInput?.value || "").trim().toUpperCase();
        if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/.test(loc)) { setText(distOut, "Ungültiger Locator."); return; }
        const ll = maidenheadToLatLon(loc);
        if (!ll) { setText(distOut, "Locator konnte nicht umgerechnet werden."); return; }
        const km = haversine(ll.lat, ll.lon, nodeLat, nodeLon);
        setText(distOut, `Entfernung: ${km.toFixed(1)} km`);
      });
    }

    // Utils
    function setText(el, txt){ if (el) el.textContent = txt; }
    function setHTML(el, html){ if (el) el.innerHTML = html; }
    function num(v){ const n = Number(String(v).replace(',','.')); return Number.isFinite(n) ? n : NaN; }
    function escapeHtml(s){
      return String(s ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");
    }

    function normalizeUrl(u){
      if (!u) return "";
      let s = String(u).trim();
      if (!s) return "";
      const ABS = /^(https?|ftp|mailto|tel):\/\//i;
      if (ABS.test(s)) return s;
      if (s.startsWith("//")) return "https:" + s;
      s = s.replace(/^\/*/, "");
      return "https://" + s;
    }

    // Haversine in km
    function haversine(lat1, lon1, lat2, lon2){
      const R = 6371;
      const toRad = d => d*Math.PI/180;
      const dLat = toRad(lat2-lat1);
      const dLon = toRad(lon2-lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // Maidenhead → lat/lon (Zentrum des Feldes)
    function maidenheadToLatLon(locator){
      if (!locator) return null;
      const loc = locator.toUpperCase();
      const A = 'A'.charCodeAt(0);
      let lon = (loc.charCodeAt(0)-A) * 20 - 180;
      let lat = (loc.charCodeAt(1)-A) * 10 - 90;
      if (loc.length >= 4) {
        lon += parseInt(loc[2]) * 2;
        lat += parseInt(loc[3]) * 1;
      }
      if (loc.length >= 6) {
        lon += (loc.charCodeAt(4)-A) * (5/60);
        lat += (loc.charCodeAt(5)-A) * (2.5/60);
      }
      if (loc.length >= 8) {
        lon += parseInt(loc[6]) * (5/600);
        lat += parseInt(loc[7]) * (2.5/600);
      }
      // Mittelpunkt des Feldes
      lon += (loc.length>=8 ? 5/1200 : loc.length>=6 ? 5/120 : loc.length>=4 ? 1 : 10);
      lat += (loc.length>=8 ? 2.5/1200 : loc.length>=6 ? 2.5/120 : loc.length>=4 ? 0.5 : 5);
      return { lat, lon };
    }

    function normCTCSS(v){
      if (v === undefined || v === null) return "";
      let s = String(v).trim();
      if (!s) return "";
      if (!/hz$/i.test(s)) {
        const n = s.replace(',','.').replace(/[^0-9.]/g,'');
        if (n) return `${n} Hz`;
      }
      return s.replace(/\s+/g,' ');
    }
  }
})();