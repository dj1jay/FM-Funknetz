<?php
  // /node.php?call=DB0MGN
  $page  = 'node';
  $title = 'Node';
  $call  = isset($_GET['call']) ? preg_replace('/[^A-Z0-9\-]/i','', $_GET['call']) : '';
  if (!$call) { $call = 'DB0MGN'; } // Fallback zum Testen
  $wsUrl = 'wss://status.thueringen.link/mqtt';
  include __DIR__ . '/includes/head.inc.php';
?>
<!-- Test ausbau -->

 <!-- Zentrales CSS + Theme -->
  <link rel="stylesheet" href="css/styles.css" />
  <script src="css/theme.js" defer></script>

</head>
<body>
<header>
  <h1>FM-Funknetz.de – Live</h1>
  <div class="row">
    <nav class="row" style="gap:12px;">
      <a href="index.php"   class="<?= $page==='home' ? 'pill ok' : 'pill' ?>">Dashboard</a>
      <a href="livemap.php" class="<?= $page==='map'  ? 'pill ok' : 'pill' ?>">Live-Map</a>
    <!--  <a href="node.php"    class="<?= $page==='node' ? 'pill ok' : 'pill' ?>">Nodes</a>-->
    </nav>

    <!-- Status-IDs, die das Skript braucht -->
    <button id="themeToggle" class="theme-toggle" type="button">🌙 </button>
  </div>
</header>
<!-- Testausbau ende -->


<main id="nodeRoot" data-ws-url="<?= htmlspecialchars($wsUrl) ?>" data-call="<?= htmlspecialchars($call) ?>">
  <section class="card">
    <h2>Node: <span id="ndCall"><?= htmlspecialchars($call) ?></span></h2>
    <div class="body">
      <div class="grid">

        <!-- Link zur Client-Seite (oberhalb) -->
        <div class="box" style="grid-column: 1 / -1; display:flex; justify-content:flex-end;">
          <a id="clientLink" href="client.php?call=<?= htmlspecialchars($call) ?>" class="btn">Zur Client-Ansicht</a>
        </div>

        <!-- OBERER BEREICH: Allgemein (links) und Funk (rechts) -->
        <div class="box">
          <div class="section-title">Allgemein</div>
          <div class="kvtable">
            <div><span class="key">Rufzeichen:</span><span id="kvCall">—</span></div>
            <div><span class="key">Standort:</span><span id="kvLocation">—</span></div>
            <div><span class="key">Locator:</span><span id="kvLocator">—</span></div>
            <div><span class="key">Koordinaten:</span><span id="kvCoords">—</span></div>
            <div><span class="key">SysOp:</span><span id="kvSysop">—</span></div>
            <div><span class="key">Verbund:</span><span id="kvVerbund">—</span></div>
            <div><span class="key">Website:</span><span id="kvWebsite">—</span></div>
          </div>
        </div>

        <div class="box">
          <div class="section-title">Funk</div>
          <div class="kvtable">
            <div><span class="key">Modus:</span><span id="kvMode">—</span></div>
            <div><span class="key">RX/TX:</span><span id="kvRxtx">—</span></div>
            <div><span class="key">CTCSS:</span><span id="kvCTCSS">—</span></div>
            <div><span class="key">Echolink:</span><span id="kvEcholink">—</span></div>
            <div><span class="key">Aktuelle&nbsp;TG:</span><span id="kvTG">—</span></div>
            <div><span class="key">Default&nbsp;TG:</span><span id="kvDefTG">—</span></div>
            <div><span class="key">Software:</span><span id="kvSoftware">—</span></div>
          </div>
        </div>

        <!-- UNTERER BEREICH: Entfernung + Karten-Umschalter + Karte (volle Breite) -->
        <div class="box" style="grid-column: 1 / -1;">
          <div class="section-title">Entfernung</div>
          <div class="small muted" style="margin-bottom:6px;">Berechne die Entfernung zu diesem Node</div>

          <div class="row" style="gap:8px; flex-wrap:wrap; margin-bottom:10px;">
            <button id="btnUseGeo" class="btn" type="button">Mein Standort verwenden</button>
            <input id="locatorInput" class="mono" type="text" placeholder="Locator (z. B. JO50ML)" style="padding:8px 10px; border-radius:8px; border:1px solid var(--btn-border); background:var(--bg); color:var(--text);">
            <button id="btnUseLocator" class="btn" type="button">Aus Locator berechnen</button>
            <span id="distOut" class="small muted"></span>

            <!-- Karten-Theme-Umschalter (Auto/Hell/Dunkel, nur Karte) -->
            <span class="small muted" style="margin-left:auto; align-self:center;">Karte:</span>
            <button id="btnMapTheme" class="btn" type="button" title="Kartenstil: Auto/Hell/Dunkel">Auto</button>
          </div>

          <div class="section-title">Karte</div>
          <div id="map" style="height: 420px; border-radius: 12px; border:1px solid var(--btn-border); background:var(--bg-muted);"></div>
        </div>

      </div>
    </div>
  </section>
</main>

<?php include __DIR__ . '/includes/footer.inc.php'; ?>
<?php include __DIR__ . '/includes/scripts.inc.php'; ?>
<!-- Seiten-spezifisches Script -->
<script src="js/node-core.js" defer></script>
</body>
</html>