// js/client-core.js
// Client-Detailseite: /client.php?call=<CALL>
// Lauscht auf /server/state/nodes/<CALL>/client/state/{rx,tx,echolink,talker,rssi}/
// Sendet DTMF nach /server/cmd/dtmf/<CALL>/

// js/client-core.js
// Client-Detailseite: /client.php?call=<CALL>
// Lauscht auf /server/state/nodes/<CALL>/client/state/{rx,tx,echolink,talker,rssi}/
// Sendet DTMF nach /server/cmd/dtmf/<CALL>/

(function () {
  'use strict';

  // DOM-Ready
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    const root = document.getElementById('clientRoot');
    if (!root) return;

    // ---- Config aus data-* ----
    const WS_URL = root.dataset.wsUrl || "wss://status.thueringen.link/mqtt";
    const CALL   = (root.dataset.call || "DB0MGN").trim();

    // ---- DOM Helper ----
    const $ = s => document.querySelector(s);

    const clTitle = $("#clTitle");

    const rxChip = $("#rxChip");
    const txChip = $("#txChip");

    const rxVal = $("#rxVal");
    const txVal = $("#txVal");
    const rssiVal = $("#rssiVal");

    const rxTime = $("#rxTime");
    const rxCnt  = $("#rxCnt");
    const txTime = $("#txTime");
    const txCnt  = $("#txCnt");

    const elList  = $("#elList");
    const elEmpty = $("#elEmpty");

    const tkActive = $("#tkActive");
    const tkActiveEmpty = $("#tkActiveEmpty");
    const tkList  = $("#tkList");
    const tkEmpty = $("#tkEmpty");

    const rssiBarFill = $("#rssiBarFill");

    const dtmfInput = $("#dtmfInput");
    const dtmfSend  = $("#dtmfSend");
    const dtmfHint  = $("#dtmfHint");
    const dtmfTopicEl = $("#dtmfTopic");

    if (clTitle) clTitle.textContent = CALL;

    // ---- Topics (mit abschließendem Slash) ----
    const BASE   = `/server/state/nodes/${CALL}/client`;
    const T_RX   = `${BASE}/state/rx/`;
    const T_TX   = `${BASE}/state/tx/`;
    const T_EL   = `${BASE}/state/echolink/`;
    const T_TK   = `${BASE}/state/talker/`;
    const T_RS   = `${BASE}/state/rssi/`;
    const T_DTMF = `/server/cmd/dtmf/${CALL}/`;
    if (dtmfTopicEl) dtmfTopicEl.textContent = T_DTMF;

    // ---- MQTT ----
    let client = null;
    let connected = false;

    // Aktive Talker: call -> { call, tg, time }
    const activeTalkers = new Map();

    try {
      client = mqtt.connect(WS_URL, {
        reconnectPeriod: 3000,
        keepalive: 30,
        clean: true,
        clientId: "fm-client-" + Math.random().toString(16).slice(2, 10),
      });
    } catch (e) {
      console.error("MQTT connect fail:", e);
      hint("MQTT-Verbindung fehlgeschlagen.");
      return;
    }

    client.on("connect", () => {
      connected = true;
      client.subscribe([T_RX, T_TX, T_EL, T_TK, T_RS], { qos: 0 }, err => {
        if (err) console.warn("subscribe error", err);
      });
    });

    client.on("close", () => { connected = false; });

    client.on("message", (topic, payload) => {
      const text = (typeof payload === "string") ? payload : new TextDecoder().decode(payload);
      handleMessage(topic, text);
    });

    // ---- Message Handling ----
    function handleMessage(topic, text) {
      try {
        if (topic === T_RX) {
          // JSON {"time","rx","cnt"} ODER plain "on|off|1|0"
          const msg  = safeJSON(text) || {};
          const val  = (msg.rx !== undefined) ? msg.rx : text;
          const norm = normalizeOnOff(val);

          if (rxVal)  rxVal.textContent  = norm.label;
          if (rxCnt)  rxCnt.textContent  = (msg.cnt !== undefined ? String(msg.cnt) : "–");
          if (rxTime) rxTime.textContent = (msg.time || "–");
          colorizeChip(rxChip, norm.isOn);
          return;
        }

        if (topic === T_TX) {
          // {"time":"..","tx":"on|off"} – ohne cnt
          const msg  = safeJSON(text) || {};
          const val  = (msg.tx !== undefined) ? msg.tx : text;
          const norm = normalizeOnOff(val);

          if (txVal)  txVal.textContent  = norm.label;
          if (txCnt)  txCnt.textContent  = "–";
          if (txTime) txTime.textContent = (msg.time || "–");
          colorizeChip(txChip, norm.isOn);
          return;
        }

        if (topic === T_RS) {
          // Zahl ODER JSON {"rssi":-85}
          let val = Number(text);
          if (Number.isNaN(val)) {
            const msg = safeJSON(text);
            val = Number(msg && msg.rssi);
          }
          if (Number.isNaN(val)) {
            if (rssiVal) rssiVal.textContent = "keine Daten vorhanden";
            if (rssiBarFill) rssiBarFill.style.width = "0%";
          } else {
            if (rssiVal) rssiVal.textContent = String(val);
            // -120..-40 dBm → 0..100 %
            const p = Math.max(0, Math.min(100, ((val + 120) / 80) * 100));
            if (rssiBarFill) rssiBarFill.style.width = p.toFixed(0) + "%";
          }
          return;
        }

        if (topic === T_EL) {
          // Freier Text: connect/disconnect + Zeit/Call
          const line = (text || "").trim();
          if (line) {
            if (elEmpty) elEmpty.style.display = "none";
            if (elList) {
              const li = document.createElement("li");
              li.textContent = line;
              elList.prepend(li);
              limitList(elList, 50);
            }
          }
          return;
        }

        if (topic === T_TK) {
          // JSON z.B.: {"time":"21:26:17","talker":"stop","call":"DB0MGN","tg":"26298"}
          // oder {"talk":"start",...} oder {"state":"on",...}
          const raw = safeJSON(text);
          if (raw) {
            const kind = normalizeTalkState(raw.talker ?? raw.talk ?? raw.state);
            const call = (raw.call || "").trim();
            const tg   = (raw.tg || "").trim();
            const time = raw.time || "";

            if (kind === "start") {
              if (call) activeTalkers.set(call, { call, tg, time });
              renderActiveTalkers();
            } else if (kind === "stop") {
              if (call) activeTalkers.delete(call);
              renderActiveTalkers();

              // Last-heard: nur Zeit + Call
              const line = (time ? `[${time}] ` : "") + call;
              if (line.trim()) {
                if (tkEmpty) tkEmpty.style.display = "none";
                if (tkList) {
                  const li = document.createElement("li");
                  li.textContent = line.trim();
                  tkList.prepend(li);
                  limitList(tkList, 100);
                }
              }
            } else {
              // unbekannt → protokollieren
              const line = (time ? `[${time}] ` : "") + call;
              if (line.trim()) {
                if (tkEmpty) tkEmpty.style.display = "none";
                if (tkList) {
                  const li = document.createElement("li");
                  li.textContent = line.trim();
                  tkList.prepend(li);
                  limitList(tkList, 100);
                }
              }
            }
          } else {
            // Fallback: Plaintext
            const line = (text || "").trim();
            if (line) {
              if (tkEmpty) tkEmpty.style.display = "none";
              if (tkList) {
                const li = document.createElement("li");
                li.textContent = line;
                tkList.prepend(li);
                limitList(tkList, 100);
              }
            }
          }
          return;
        }

      } catch (e) {
        console.warn("handleMessage error", topic, e);
      }
    }

    // ---- Utils ----
    function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }

    // on/off Normalisierung für rx/tx (inkl. 0|1, true|false, ein/aus, yes/no)
    function normalizeOnOff(v) {
      const s = String(v ?? "").toLowerCase().trim();
      const ON  = new Set(["on","1","true","an","ein","yes","y"]);
      const OFF = new Set(["off","0","false","aus","no","n"]);
      const isOn = ON.has(s) ? true : OFF.has(s) ? false : false;
      const label = ON.has(s) ? "on" : OFF.has(s) ? "off" : (s ? s : "keine Daten vorhanden");
      return { isOn, label };
    }

    // start/stop Normalisierung für talker
    function normalizeTalkState(v) {
      const s = String(v ?? "").toLowerCase().trim();
      if (s === "start" || s === "begin" || s === "on" || s === "1" || s === "true" || s === "active") return "start";
      if (s === "stop"  || s === "end"   || s === "off"|| s === "0" || s === "false"|| s === "inactive") return "stop";
      return s; // unbekannt
    }

    function colorizeChip(el, isOn) {
      if (!el) return;
      if (isOn) {
        el.style.borderColor = "var(--ok)";
        el.style.background  = "rgba(16,185,129,.18)";
        el.style.color       = "var(--text)";
      } else {
        el.style.borderColor = "var(--chip-border)";
        el.style.background  = "var(--chip-bg)";
        el.style.color       = "var(--text)";
      }
    }

    function renderActiveTalkers(){
      if (!tkActive) return;

      const arr = Array.from(activeTalkers.values());
      if (!arr.length) {
        tkActive.innerHTML = "";
        if (tkActiveEmpty) tkActiveEmpty.style.display = "";
        return;
      }
      if (tkActiveEmpty) tkActiveEmpty.style.display = "none";

      // jüngste zuerst
      arr.sort((a,b)=> String(b.time||"").localeCompare(String(a.time||"")));

      const html = arr.map(it => {
        const safeCall = escapeHtml(it.call);
        const safeTG   = escapeHtml(it.tg || "—");
        return (
          '<div class="talker-btn" title="'+safeCall+'">'+
            '<div class="talker-call">'+safeCall+'</div>'+
            '<div class="talker-tg">TG '+safeTG+'</div>'+
          '</div>'
        );
      }).join("");

      tkActive.innerHTML = html;
    }

    function limitList(ul, max) {
      if (!ul) return;
      while (ul.children.length > max) ul.removeChild(ul.lastChild);
    }

    function hint(msg) {
      if (!dtmfHint) return;
      dtmfHint.textContent = msg || "";
      setTimeout(() => { dtmfHint.textContent = ""; }, 4000);
    }

    function escapeHtml(s){
      return String(s ?? "")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;");
    }

    // ---- DTMF senden ----
    function sendDTMF() {
      const cmd = (dtmfInput && dtmfInput.value || "").trim();
      if (!cmd) { hint("Bitte DTMF-Befehl eingeben."); return; }
      if (!connected || !client) { hint("Nicht verbunden."); return; }
      try {
        client.publish(T_DTMF, cmd, { qos: 0, retain: false }, (err) => {
          if (err) { hint("Senden fehlgeschlagen."); }
          else { hint("Gesendet."); if (dtmfInput) dtmfInput.value = ""; }
        });
      } catch (e) {
        hint("Fehler beim Senden.");
      }
    }

    if (dtmfSend) dtmfSend.addEventListener("click", sendDTMF);
    if (dtmfInput) dtmfInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendDTMF();
    });
  }
})();