import { DEFAULT_MAP_STYLE_URL } from "@gearhead/shared";

/**
 * HTML do mapa exibido na WebView (MapLibre GL JS + OpenFreeMap). Ver docs/MAPS.md.
 * Usa o build UMD da v5 (worker embutido; o ESM da v6 exige servir o worker à parte)
 * com hash de integridade (SRI). A atribuição OpenFreeMap/OpenStreetMap é obrigatória
 * e fica visível pelo controle padrão — não remover.
 *
 * Ponte: o app envia o estado com `window.__update(estado)`; a página responde com
 * mensagens { type: "ready" | "moveend" | "marker" } via ReactNativeWebView.postMessage.
 */
const MAPLIBRE_VERSION = "5.24.0";
const MAPLIBRE_JS_SRI = "sha384-5+cfbwT0iiub6VsQAdn6yz16nr6sDiQoHx6tm4O8OVYXHYOxcffFmCJBL0dgdvGp";
const MAPLIBRE_CSS_SRI = "sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK";

export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

export function buildMapHtml(styleUrl: string = MAP_STYLE_URL): string {
  const base = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="${base}/maplibre-gl.css" integrity="${MAPLIBRE_CSS_SRI}" crossorigin="anonymous" />
<script src="${base}/maplibre-gl.js" integrity="${MAPLIBRE_JS_SRI}" crossorigin="anonymous"></script>
<style>
  html, body, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0e0e0f; }
  #erro { display: none; color: #ededed; font: 14px sans-serif; padding: 16px; }
</style>
</head>
<body>
<div id="map"></div>
<p id="erro">Não foi possível carregar o mapa. Verifique a conexão.</p>
<script>
(function () {
  function send(msg) { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  if (!window.maplibregl) {
    document.getElementById("erro").style.display = "block";
    send({ type: "error" });
    return;
  }
  var map = new maplibregl.Map({ container: "map", style: ${JSON.stringify(styleUrl)}, center: [-51.9253, -14.235], zoom: 3.5 });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  var markers = [];
  var loaded = false;
  var pending = null;

  function circle(lat, lng, km) {
    var pts = [], dLat = km / 110.574, dLng = km / (111.32 * Math.cos(lat * Math.PI / 180));
    for (var i = 0; i <= 64; i++) { var t = i / 64 * 2 * Math.PI; pts.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]); }
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } };
  }

  function apply(state) {
    if (!loaded) { pending = state; return; }
    if (state.center) map.jumpTo({ center: [state.center.longitude, state.center.latitude], zoom: state.zoom || map.getZoom() });
    markers.forEach(function (m) { m.remove(); });
    markers = (state.markers || []).map(function (m) {
      var el = new maplibregl.Marker({ color: m.highlighted ? "#c2410c" : "#fb923c" }).setLngLat([m.longitude, m.latitude]).addTo(map);
      el.getElement().addEventListener("click", function (ev) { ev.stopPropagation(); send({ type: "marker", id: m.id }); });
      return el;
    });
    var data = state.radius ? circle(state.radius.latitude, state.radius.longitude, state.radius.km) : { type: "FeatureCollection", features: [] };
    var src = map.getSource("radius");
    if (src) { src.setData(data); }
    else {
      map.addSource("radius", { type: "geojson", data: data });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#fb923c", "fill-opacity": 0.08 } });
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#c2410c", "line-width": 1.5 } });
    }
  }

  window.__update = apply;
  map.on("load", function () { loaded = true; if (pending) { apply(pending); pending = null; } send({ type: "ready" }); });
  map.on("moveend", function () { var c = map.getCenter(); send({ type: "moveend", latitude: c.lat, longitude: c.lng, zoom: map.getZoom() }); });
  map.on("error", function () { send({ type: "tile-error" }); });
})();
</script>
</body>
</html>`;
}
