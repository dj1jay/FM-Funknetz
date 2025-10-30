<?php
  // Standalone-Variante zum Gegencheck der Includes.
  $page  = 'home';
  $title = 'Dashboard';
?>
<!DOCTYPE html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title><?= htmlspecialchars($title) ?> – FM-Funknetz</title>

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
    <span id="clients" class="pill">Verbundene Clients: —</span>
    <span id="conn" class="pill">Getrennt</span>
    <button id="btnConnect" class="btn" type="button">Verbinden</button>
    <button id="btnDisconnect" class="btn" type="button" disabled>Trennen</button>
    <button id="themeToggle" class="theme-toggle" type="button">🌙 </button>
  </div>
</header>

<main>
  <!-- Schalter -->
  <div class="top-toolbar">
    <label><input type="checkbox" id="chkLive" checked> Live anzeigen</label>
    <label><input type="checkbox" id="chkHeard" checked> Zuletzt Aktiv anzeigen</label>
    <label><input type="checkbox" id="chkAlt" checked> Kompakte Ansicht</label>
  </div>

  <!-- Live / Zuletzt Aktiv -->
  <div class="grid">
    <section class="card" id="liveCard">
      <h2><center>Live</center></h2>
      <div class="body">
        <div id="activeEmpty" class="small">Funkstille .... Niemand spricht... aber wirklich niemand.</div>
        <table id="activeTable" style="display:none">
          <thead>
            <tr>
              <th style="width:20%">Call</th>
              <th style="width:12%">TG</th>
              <th style="width:40%">Sprechgruppe</th>
              <th style="width:12%">Zeit</th>
              <th style="width:13%">Dauer</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
        <div id="error" class="small"></div>
      </div>
    </section>

    <section class="card" id="heardCard">
      <h2><center>Zuletzt Aktiv</center></h2>
      <div class="body" style="max-height:70vh; overflow:auto;">
        <table id="lhTable">
          <thead>
            <tr>
              <th style="width:20%">Call</th>
              <th style="width:12%">TG</th>
              <th style="width:40%">Sprechgruppe</th>
              <th style="width:12%">Zeit</th>
              <th style="width:13%">Dauer</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  </div>

  <!-- Alternative Ansicht -->
  <section class="card" id="altCard" style="margin-top:12px;">
    <h2>Kompakt Ansicht</h2>
    <div class="body">
      <div class="alt-legend"><center>Aktiv       <------      Reflektor Aktivität      ------>       LastHeard (Grau)
</div>
      <div id="altGrid" class="alt-grid"></div>
    </div>
  </section>

  <!-- Nodes -->
  <section class="card" id="nodesCard" style="margin-top:12px;">
    <h2>Nodes</h2>
    <div class="body">
      <div class="nodes-toolbar">
        <label for="tgSelect">Aktive TG:</label>
        <select id="tgSelect" class="filter-select">
          <option value="">Alle</option>
        </select>
        <button id="tgClearBtn" class="tg-clear" style="display:none;">× löschen</button>

        <span style="opacity:.5;">|</span>

        <label for="monSelect">Monitored TG:</label>
        <select id="monSelect" class="filter-select">
          <option value="">—</option>
        </select>
        <button id="monClearBtn" class="tg-clear" style="display:none;">× löschen</button>
      </div>

      <div id="nodesGrid" class="nodes-grid"></div>
    </div>
  </section>
</main>

<footer>
<div style="text-align: center;">
    <span class="footer-note">FM-Funknetz.de <br> – MQTT Livedashboard Version 20251021_1.5.7 <br> by  © DJ1JAY</span></div>
</footer>
<script src="js/vendor/mqtt.min.js" defer></script>
<script src="js/nodes.js" defer></script>
<script src="js/index-core.js" defer></script>
</body>
</html>