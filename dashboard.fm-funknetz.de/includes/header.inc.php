<header>
  <h1>FM-Funknetz.de – Live</h1>

  <div class="row">
    <nav class="row" style="gap:12px;">
      <a href="index.php"   class="<?= ($page ?? '')==='home' ? 'pill ok' : 'pill' ?>">Dashboard</a>
      <a href="livemap.php" class="<?= ($page ?? '')==='map'  ? 'pill ok' : 'pill' ?>">Live-Map</a>
      <a href="node.php"    class="<?= ($page ?? '')==='node' ? 'pill ok' : 'pill' ?>">Nodes</a>
    </nav>

    <!-- Theme -->
    <button id="themeToggle" class="theme-toggle" type="button">🌙 Dunkel</button>

    <!-- MQTT Verbindungsstatus (IDs werden von index.php benutzt!) -->
    <span id="conn" class="pill">Getrennt</span>
    <span id="clients" class="pill">Verbundene Clients: —</span>
    <button id="btnConnect"    class="btn" type="button">Verbinden</button>
    <button id="btnDisconnect" class="btn" type="button" disabled>Trennen</button>
  </div>
</header>