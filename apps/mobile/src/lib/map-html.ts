import { DEFAULT_MAP_STYLE_URL } from "@gearhead/shared";

/**
 * HTML do mapa exibido na WebView (MapLibre GL JS + OpenFreeMap). Ver docs/MAPS.md.
 * Usa o build UMD da v5 (worker embutido; o ESM da v6 exige servir o worker à parte)
 * com hash de integridade (SRI). A atribuição OpenFreeMap/OpenStreetMap é obrigatória
 * e fica visível pelo controle padrão — não remover.
 *
 * Ponte: o app envia câmera/raio com `window.__update(estado)`, marcadores (já agrupados)
 * com `window.__markers(lista)` e aproxima com `window.__zoomTo(lng, lat, zoom)`; a página
 * responde com { type: "ready" | "moveend" | "marker" } via ReactNativeWebView.postMessage.
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
  var pendingMarkers = null;

  function circle(lat, lng, km) {
    var pts = [], dLat = km / 110.574, dLng = km / (111.32 * Math.cos(lat * Math.PI / 180));
    for (var i = 0; i <= 64; i++) { var t = i / 64 * 2 * Math.PI; pts.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]); }
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } };
  }

  function apply(state) {
    if (!loaded) { pending = state; return; }
    if (state.center) map.jumpTo({ center: [state.center.longitude, state.center.latitude], zoom: state.zoom || map.getZoom() });
    var data = state.radius ? circle(state.radius.latitude, state.radius.longitude, state.radius.km) : { type: "FeatureCollection", features: [] };
    var src = map.getSource("radius");
    if (src) { src.setData(data); }
    else {
      map.addSource("radius", { type: "geojson", data: data });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius", paint: { "fill-color": "#fb923c", "fill-opacity": 0.08 } });
      map.addLayer({ id: "radius-line", type: "line", source: "radius", paint: { "line-color": "#c2410c", "line-width": 1.5 } });
    }
  }

  // Marcadores já agrupados pelo app ({ count } = grupo). Não mexe na câmera.
  function setMarkers(list) {
    if (!loaded) { pendingMarkers = list; return; }
    markers.forEach(function (m) { m.remove(); });
    markers = list.map(function (m) {
      var marker;
      if (m.count) {
        var el = document.createElement("div");
        var size = m.count < 10 ? 34 : m.count < 25 ? 40 : 46;
        el.textContent = String(m.count);
        el.style.cssText = "width:" + size + "px;height:" + size + "px;border-radius:50%;background:#c2410c;color:#fff;font:600 14px sans-serif;display:flex;align-items:center;justify-content:center;border:3px solid rgba(255,255,255,.85);box-shadow:0 1px 4px rgba(0,0,0,.35)";
        marker = new maplibregl.Marker({ element: el });
      } else {
        marker = new maplibregl.Marker({ color: m.highlighted ? "#c2410c" : "#fb923c" });
      }
      marker.setLngLat([m.longitude, m.latitude]).addTo(map);
      marker.getElement().addEventListener("click", function (ev) { ev.stopPropagation(); send({ type: "marker", id: m.id }); });
      return marker;
    });
  }

  window.__update = apply;
  window.__markers = setMarkers;
  window.__zoomTo = function (lng, lat, zoom) { map.easeTo({ center: [lng, lat], zoom: zoom }); };
  map.on("load", function () {
    loaded = true;
    if (pending) { apply(pending); pending = null; }
    if (pendingMarkers) { setMarkers(pendingMarkers); pendingMarkers = null; }
    send({ type: "ready" });
  });
  map.on("moveend", function () { var c = map.getCenter(); send({ type: "moveend", latitude: c.lat, longitude: c.lng, zoom: map.getZoom() }); });
  map.on("error", function () { send({ type: "tile-error" }); });
})();
</script>
</body>
</html>`;
}
