<?php
// Gemeinsamer <head> für alle Seiten
if (!isset($title)) { $title = 'FM-Funknetz'; }
?>
<!doctype html>
<html lang="de" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <title><?= htmlspecialchars($title) ?> • FM-Funknetz</title>

  <!-- Dein globales CSS -->
  <link rel="stylesheet" href="css/styles.css">

  <!-- Leaflet CSS (lokal, damit CSP glücklich bleibt) -->
  <link rel="stylesheet" href="vendor/leaflet/leaflet.css">

  <!-- minimale Notfall-Regel, falls die Seiten-CSS mal fehlt -->
  <style>
    #map { width: 100%; min-height: 420px; }
  </style>
</head>