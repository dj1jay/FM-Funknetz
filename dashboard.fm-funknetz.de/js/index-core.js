
// ======================= KONFIG =======================
const WS_URL        = "wss://status.thueringen.link/mqtt";
const TALK_TOPIC    = "/server/statethr/1";
const CLIENTS_TOPIC = "/server/state/logins";
const TGDB_URL      = "https://master1.fm-funknetz.de/dashtt/tgdb_proxy.php";
const ALT_MAX_BUTTONS = 7;
const ALT_TICK_MS = 1000;

// ======================= DOM =======================
const elConn   = document.getElementById("conn");
const elBtnC   = document.getElementById("btnConnect");
const elBtnD   = document.getElementById("btnDisconnect");
const elClients = document.getElementById("clients");
const elErr    = document.getElementById("error");
const elActiveEmpty = document.getElementById("activeEmpty");
const elActiveTable = document.getElementById("activeTable");
const elActiveBody  = elActiveTable.querySelector("tbody");
const elLHBody      = document.getElementById("lhTable").querySelector("tbody");
const chkLive  = document.getElementById("chkLive");
const chkHeard = document.getElementById("chkHeard");
const chkAlt   = document.getElementById("chkAlt");
const liveCard  = document.getElementById("liveCard");
const heardCard = document.getElementById("heardCard");
const altCard   = document.getElementById("altCard");

// ======================= STATE =======================
let client = null;
const active = new Map();
const lastHeard = [];
const tgMap = new Map();

// ======================= UTILS =======================
function setState(txt, cls) {
  elConn.textContent = txt;
  elConn.className = "pill " + (cls || "");
  elBtnC.disabled = (txt !== "Getrennt" && txt !== "Fehler");
  elBtnD.disabled = (txt !== "Verbunden");
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
const TG_BASE_COLORS = {
  "1":  "#f87171", "2":  "#3b82f6", "23": "#06b6d4", "24": "#0ea5e9",
  "25": "#10b981", "26": "#2563eb", "27": "#38bdf8", "91": "#f59e0b",
  "13": "#a855f7", "default": "#9ca3af"
};
function varyLightness(hex, percent) {
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if(!m)return hex;
  let r=parseInt(m[1],16),g=parseInt(m[2],16),b=parseInt(m[3],16);
  const f=1+(percent/100);
  r=Math.min(255,Math.max(0,r*f)); g=Math.min(255,Math.max(0,g*f)); b=Math.min(255,Math.max(0,b*f));
  return "#" + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function colorForTG(tgStr){
  if(!tgStr)return TG_BASE_COLORS.default;
  const s=String(tgStr);
  const key=Object.keys(TG_BASE_COLORS).find(k=>s.startsWith(k))||"default";
  const base=TG_BASE_COLORS[key];
  const last=parseInt(s.slice(-1),10);
  const pct=isNaN(last)?0:(last-5)*10;
  return varyLightness(base,pct);
}
function rgba(hex, a){
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if(!m)return hex;
  const r=parseInt(m[1],16), g=parseInt(m[2],16), b=parseInt(m[3],16);
  return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`;
}

// ======================= TG-Namen laden =======================
(async function loadTGDB(){
  try{
    const resp = await fetch(TGDB_URL, { cache:"no-store" });
    const text = await resp.text();
    const phpRe = /'(\d+)'\s*=>\s*'([^']*)'/g;
    let m, found=false;
    while((m=phpRe.exec(text))!==null){ found=true; tgMap.set(m[1], m[2]); }
    if(!found){
      const lines = text.split(/\r?\n/);
      for(let line of lines){
        line=line.trim();
        if(!line || /^(\s*[/#;])/.test(line)) continue;
        let parts=line.split(/\s*[,;\t]\s*/);
        if(parts.length===1){
          const mm=line.match(/^(\d+)\s+(.+)$/);
          if(mm) parts=[mm[1],mm[2]];
        }
        if(parts.length>=2 && /^\d+$/.test(parts[0])){
          tgMap.set(parts[0].trim(), parts.slice(1).join(" ").trim());
        }
      }
    }
  } catch(e){ console.warn("TGDB load fail:", e); }
})();

// ======================= MQTT =======================
function connect() {
  if (client) { try{ client.end(true); }catch(e){} }
  setState("Verbinden…","warn");
  client = mqtt.connect(WS_URL, {
    reconnectPeriod: 3000,
    keepalive: 30,
    clean: true,
    clientId: "fm-talk-" + Math.random().toString(16).slice(2,10),
  });

  // Globale Hooks für nodes.js
  window.fmClient = client;
  window.fmActive = active;
  window.fmTGDB   = tgMap;

  client.on("connect", ()=>{
    setState("Verbunden","ok");
    client.subscribe([TALK_TOPIC, CLIENTS_TOPIC], { qos: 0 });
    // für nodes.js
    client.subscribe("/server/state/nodes_index", { qos: 0 });
    client.subscribe("/server/state/nodes/+",     { qos: 0 });
  });
  client.on("reconnect", ()=>setState("Verbinden…","warn"));
  client.on("close", ()=>setState("Getrennt"));
  client.on("error",(err)=>{ setState("Fehler","bad"); elErr.textContent = err?.message || String(err); });

  client.on("message",(topic,payload)=>{
    const text = (typeof payload === "string") ? payload : new TextDecoder().decode(payload);

    if (topic === CLIENTS_TOPIC) {
      const n = parseInt(String(text).trim(), 10);
      if (!isNaN(n)) elClients.textContent = "Verbundene Clients: " + n;
      return;
    }

    if (topic === TALK_TOPIC) {
      try { handleTalk(JSON.parse(text)); } catch(e){ elErr.textContent="Parsing-Fehler: "+e.message; }
    }
  });
}
document.getElementById("btnConnect").addEventListener("click", connect);
document.getElementById("btnDisconnect").addEventListener("click", ()=>{ try{client.end(true);}catch(_){}} );
connect();

// ======================= TALK-LOGIK =======================
function handleTalk(msg){
  const now=Date.now();
  const id=String(msg.call||"").trim();
  const tg=String(msg.tg||"").trim();
  const kind=String(msg.talk||"").toLowerCase();
  if(!id) return;

  if(kind==="start"){
    active.set(id,{call:id,tg,startMs:now});
  } else if(kind==="stop"){
    if(active.has(id)){
      const a=active.get(id); active.delete(id);
      const durSec=Math.max(0,Math.round((now-a.startMs)/1000));
      lastHeard.unshift({call:a.call,tg:a.tg||tg,endMs:now,durationSec:durSec});
      while(lastHeard.length>100) lastHeard.pop();
    }
  }
  renderTables();
}

// ======================= DARSTELLUNG =======================
function renderTables() {
  var table = document.getElementById("activeTable");
  var empty = document.getElementById("activeEmpty");
  var tbody = table ? table.querySelector("tbody") : null;
  var lhTable = document.getElementById("lhTable");
  var lhTbody = lhTable ? lhTable.querySelector("tbody") : null;
  if (!table || !tbody || !empty || !lhTbody) return;

  var arr = Array.from(active.values()).sort(function(a, b){ return a.startMs - b.startMs; });
  tbody.innerHTML = "";
  if (arr.length === 0) {
    empty.style.display = "block";
    table.style.display = "none";
  } else {
    empty.style.display = "none";
    table.style.display = "table";
    var now = Date.now();
    for (var i=0;i<arr.length;i++){
      var a = arr[i];
      var durSec = Math.max(0, Math.round((now - a.startMs) / 1000));
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="call">' + escapeHtml(a.call) + '</td>' +
        '<td><span class="tag mono">' + escapeHtml(a.tg || "—") + '</span></td>' +
        '<td>' + escapeHtml(tgMap.get(a.tg) || "—") + '</td>' +
        '<td class="mono">' + new Date(a.startMs).toLocaleTimeString() + '</td>' +
        '<td class="mono">' + durSec + 's</td>';
      tbody.appendChild(tr);
    }
  }

  lhTbody.innerHTML = "";
  for (var j=0;j<lastHeard.length;j++){
    var h = lastHeard[j];
    var tr2 = document.createElement("tr");
    tr2.innerHTML =
      '<td class="call">' + escapeHtml(h.call) + '</td>' +
      '<td><span class="tag mono">' + escapeHtml(h.tg || "—") + '</span></td>' +
      '<td>' + escapeHtml(tgMap.get(h.tg) || "—") + '</td>' +
      '<td class="mono">' + new Date(h.endMs).toLocaleTimeString() + '</td>' +
      '<td class="mono">' + h.durationSec + 's</td>';
    lhTbody.appendChild(tr2);
  }
}

// ======================= Live-ANSICHT Liste (nur Live-Daten) =======================
function tickAltView(){
  if(!chkAlt.checked) return;
  var el = document.getElementById("altGrid");

  var activeArr = Array.from(active.values())
    .map(function(a){ return {call:a.call,tg:a.tg,isActive:true,ts:a.startMs}; })
    .sort(function(a,b){ return b.ts - a.ts; });

  var stoppedArr = [];
  var seen = new Set(activeArr.map(function(x){ return x.call; }));
  for (var i=0;i<lastHeard.length;i++){
    var h = lastHeard[i];
    var c = String(h.call||"");
    if (!c || seen.has(c)) continue;
    stoppedArr.push({call:c,tg:h.tg,isActive:false,ts:h.endMs});
    seen.add(c);
    if (stoppedArr.length >= ALT_MAX_BUTTONS) break;
  }

  var merged = activeArr.concat(stoppedArr).slice(0, ALT_MAX_BUTTONS);

  var html = "";
  for (var k=0;k<merged.length;k++){
    var item = merged[k];
    var col = colorForTG(item.tg);
    var chipStyle = item.isActive
      ? 'border-color:'+col+'; color:'+col+'; background:'+rgba(col,0.22)+';'
      : 'border-color:rgba(148,163,184,0.35); color:#e5e7eb; background:rgba(148,163,184,0.15);';
    var muted = item.isActive ? "" : " alt-muted";
    html += '<div class="alt-btn'+muted+'">'+
            '  <div class="alt-call">'+escapeHtml(item.call)+'</div>'+
            '  <div class="alt-tg" style="'+chipStyle+'">'+escapeHtml(item.tg)+'</div>'+
            '</div>';
  }
  el.innerHTML = html || '<div class="small">Erst wenn du sprichst, siehst du es!</div>';
}

// ======================= SICHTBARKEIT & LOOPS =======================
function applyVisibility(){
  liveCard.style.display = chkLive.checked ? "" : "none";
  heardCard.style.display = chkHeard.checked ? "" : "none";
  altCard.style.display = chkAlt.checked ? "" : "none";
}
chkLive.addEventListener("change",applyVisibility);
chkHeard.addEventListener("change",applyVisibility);
chkAlt.addEventListener("change",applyVisibility);
applyVisibility();

setInterval(function(){ renderTables(); }, 1000);
setInterval(tickAltView, 1000);
