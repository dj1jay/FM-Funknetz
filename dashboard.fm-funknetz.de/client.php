<?php
  // /client.php?call=DB0MGN
  $page  = 'client';
  $title = 'Client';
  $call  = isset($_GET['call']) ? preg_replace('/[^A-Z0-9\-]/i','', $_GET['call']) : '';
  if (!$call) { $call = 'DB0MGN'; } // Fallback zum Testen
  $wsUrl = 'wss://status.thueringen.link/mqtt';
  include __DIR__ . '/includes/head.inc.php';
?>
<body>
<?php include __DIR__ . '/includes/header.inc.php'; ?>

<main id="clientRoot" data-ws-url="<?= htmlspecialchars($wsUrl) ?>" data-call="<?= htmlspecialchars($call) ?>">
  <section class="card">
    <h2>Client: <span id="clTitle"><?= htmlspecialchars($call) ?></span></h2>
    <div class="body">
      <div class="grid">
        <!-- Funkzustand -->
        <div class="box">
          <div class="section-title">Funkzustand</div>
          <div class="list-inline" style="gap:10px;">
            <div class="chip" id="rxChip" title="RX Status">RX: <span id="rxVal" class="mono">keine Daten vorhanden</span></div>
            <div class="chip" id="txChip" title="TX Status">TX: <span id="txVal" class="mono">keine Daten vorhanden</span></div>
            <div class="chip" id="rssiChip" title="RSSI">RSSI: <span id="rssiVal" class="mono">keine Daten vorhanden</span></div>
          </div>
          <div style="margin-top:10px;">
            <div class="small muted">Letzte RX-Zeit: <span id="rxTime">–</span> | Zähler: <span id="rxCnt">–</span></div>
            <div class="small muted">Letzte TX-Zeit: <span id="txTime">–</span> | Zähler: <span id="txCnt">–</span></div>
          </div>
          <div style="margin-top:10px;">
            <div class="small muted">RSSI-Verlauf (kurz):</div>
            <div id="rssiBar" style="height:10px; border-radius:8px; background:var(--bg-muted); overflow:hidden;">
              <div id="rssiBarFill" style="height:100%; width:0%; background:linear-gradient(90deg,#60a5fa,#10b981);"></div>
            </div>
          </div>
        </div>

        <!-- Echolink / Talker -->
        <div class="box">
          <div class="section-title">Echolink & Talker</div>

          <!-- Echolink -->
          <div style="margin-bottom:12px;">
            <div class="small muted">Echolink-Status</div>
            <ul id="elList" class="small" style="margin:6px 0 0 16px; padding:0; list-style:disc;"></ul>
            <div id="elEmpty" class="small">keine Daten vorhanden</div>
          </div>

          <!-- Talker -->
          <div style="margin-top:12px;">
            <div class="section-title">Talker</div>

            <!-- Aktive Talker: Buttons -->
            <div id="tkActive" class="talker-active-grid" style="margin:8px 0 10px 0;"></div>
            <div id="tkActiveEmpty" class="small">keine aktiven Talker</div>

            <!-- Zuletzt gehört: Zeit + Call -->
            <div class="small muted" style="margin-top:6px;">Zuletzt gehört</div>
            <ul id="tkList" class="small" style="margin:6px 0 0 16px; padding:0; list-style:disc;"></ul>
            <div id="tkEmpty" class="small">keine Daten vorhanden</div>
          </div>
        </div>
      </div>

      <!-- DTMF Steuerung -->
      <div class="box" style="margin-top:12px;">
        <div class="section-title">
          DTMF senden
          <span class="small muted">an Topic: <span id="dtmfTopic" class="mono"></span></span>
        </div>
        <form id="dtmfForm" class="row" onsubmit="return false;" style="gap:8px;">
          <input id="dtmfInput" type="text" maxlength="32" placeholder="DTMF Befehl, z. B. #26298*" style="padding:8px 10px; border-radius:8px; border:1px solid var(--btn-border); background:var(--bg); color:var(--text); min-width:260px;">
          <button id="dtmfSend" class="btn" type="button">Senden</button>
          <span id="dtmfHint" class="small muted"></span>
        </form>
      </div>
    </div>
  </section>
</main>

<?php // include __DIR__ . '/includes/footer.inc.php'; ?>
<?php //include __DIR__ . '/includes/scripts.inc.php'; ?>
<!-- Seiten-spezifisches Script (extern, CSP-freundlich) -->


 <script src="js/vendor/mqtt.min.js" defer></script>
<!--    <script src="js/nodes.js" defer></script> -->
<script src="js/client-core.js" defer></script>


<script>
// Übergabe der Parameter an client-core.js via globals (kein Inline-Eval, CSP-freundlich)
window.fmClientConfig = {
  wsUrl: "wss://status.thueringen.link/mqtt",
  baseCall: "<?= htmlspecialchars($call) ?>",
  // spätere Auth/ACL Hooks:
  // username: "", password: "", tls: true
};
</script>
</body>
</html>