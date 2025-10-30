<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Live Map – FM-Funknetz</title>
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css" crossorigin=""/>

<!-- Zentrales CSS + Theme -->
  <link rel="stylesheet" href="css/map.css" />
  <script src="css/themes.js" defer></script>

</head>
<body>
<header>
  <h1>FM-Funknetz.de – Live Map</h1>
  <div class="row">
    <nav class="row" style="gap:12px;">
      <a href="index.php"   class="<?= $page==='home' ? 'pill ok' : 'pill' ?>">Dashboard</a>
      <a href="livemap.php" class="<?= $page==='map'  ? 'pill ok' : 'pill' ?>">Live-Map</a>
    <!--  <a href="node.php"    class="<?= $page==='node' ? 'pill ok' : 'pill' ?>">Nodes</a> -->
    </nav>

    <!-- Status-IDs, die das Skript braucht --
    <button id="themeToggle" class="theme-toggle" type="button">🌙 </button> -->
     <div <button id="toggleMap" class="toggle" type="button">Karte: Dunkel / Hell</button>
</div>
 
 </header>
  <div id="map"></div>
  <div class="controls" id="controls">
    <div class="search-wrap">
      <div style="font-weight:600; margin-bottom:4px;">Suche Rufzeichen</div>
      <input id="searchCall" type="text" placeholder="z. B. DB0MGN" list="callsDatalist" autocomplete="off" />
      <datalist id="callsDatalist"></datalist>
      <div class="search-actions">
        <button id="btnGo" class="btn" type="button">Suchen</button>
        <span id="searchHint" class="hint">Tippen zum Vorschlagen</span>
      </div>
    </div>
    <div><strong>Typen</strong></div>
    <label><input type="checkbox" id="t1" checked> Relais</label>
    <label><input type="checkbox" id="t2" checked> Simplex Link</label>
    <label><input type="checkbox" id="t3" checked> Privater Hotspot</label>
    <hr style="border-color:#1f2937">
    <label><input type="checkbox" id="me" checked> Mein Standort zeigen</label>
  </div>

 <script src="vendor/leaflet/leaflet.js" crossorigin=""></script>
<script src="js/vendor/mqtt.min.js"></script>
<script src="js/nodes.js"></script>
<script src="js/livemap-core.js"></script>
</body>
</html>
