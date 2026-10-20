"use client";

import { DEFAULT_MAP_STYLE_URL } from "@gearhead/shared";
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  setWorkerUrl,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

/** Estilo de mapa (OpenFreeMap por padrão; trocar de provedor = trocar a URL). Ver docs/MAPS.md. */
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_MAP_STYLE_URL;

// Worker servido de public/vendor (copiado por scripts/copy-maplibre-worker.mjs).
setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  /** Texto do popup (opcional). */
  label?: string;
  href?: string;
  highlighted?: boolean;
}

export interface MapViewProps {
  center: { latitude: number; longitude: number };
  zoom: number;
  markers?: MapMarker[];
  /** Círculo do raio de busca, em km, desenhado em volta do centro informado. */
  radius?: { latitude: number; longitude: number; km: number } | null;
  onMoveEnd?: (center: { latitude: number; longitude: number; zoom: number }) => void;
  onMapClick?: (point: { latitude: number; longitude: number }) => void;
  /** Ajusta a câmera para mostrar todos os marcadores quando eles mudam. */
  fitToMarkers?: boolean;
  className?: string;
  ariaLabel: string;
}

/** Polígono aproximando um círculo geodésico (64 pontos) para desenhar o raio. */
function circlePolygon(lat: number, lng: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const points: [number, number][] = [];
  const dLat = km / 110.574;
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * 2 * Math.PI;
    points.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [points] } };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Mapa MapLibre GL JS controlado por props. A atribuição (OpenFreeMap/OpenStreetMap)
 * é obrigatória e fica visível pelo AttributionControl padrão — não remover.
 */
export function MapView({
  center,
  zoom,
  markers = [],
  radius = null,
  onMoveEnd,
  onMapClick,
  fitToMarkers = false,
  className = "h-80 w-full",
  ariaLabel,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const handlersRef = useRef({ onMoveEnd, onMapClick });
  useEffect(() => {
    handlersRef.current = { onMoveEnd, onMapClick };
  }, [onMoveEnd, onMapClick]);

  // Cria o mapa uma vez.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: [center.longitude, center.latitude],
      zoom,
      cooperativeGestures: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("moveend", () => {
      const c = map.getCenter();
      handlersRef.current.onMoveEnd?.({ latitude: c.lat, longitude: c.lng, zoom: map.getZoom() });
    });
    map.on("click", (e: MapMouseEvent) =>
      handlersRef.current.onMapClick?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }),
    );
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Centro/zoom iniciais apenas; mudanças posteriores vêm pelo efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentraliza quando o centro pedido muda.
  useEffect(() => {
    mapRef.current?.easeTo({ center: [center.longitude, center.latitude], zoom });
  }, [center.latitude, center.longitude, zoom]);

  // Marcadores.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = markers.map((m) => {
      const marker = new Marker({
        color: m.highlighted ? "#c2410c" : "#fb923c",
      }).setLngLat([m.longitude, m.latitude]);
      if (m.label) {
        const html = m.href
          ? `<a href="${escapeHtml(m.href)}" style="font-weight:600;color:#c2410c">${escapeHtml(m.label)}</a>`
          : `<strong>${escapeHtml(m.label)}</strong>`;
        marker.setPopup(new Popup({ offset: 24 }).setHTML(html));
      }
      return marker.addTo(map);
    });
    if (fitToMarkers && markers.length > 0) {
      const bounds = new LngLatBounds();
      for (const m of markers) bounds.extend([m.longitude, m.latitude]);
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    }
  }, [markers, fitToMarkers]);

  // Círculo do raio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const data = radius
        ? circlePolygon(radius.latitude, radius.longitude, radius.km)
        : { type: "FeatureCollection" as const, features: [] };
      const source = map.getSource("radius") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource("radius", { type: "geojson", data });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: { "fill-color": "#fb923c", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: { "line-color": "#c2410c", "line-width": 1.5 },
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [radius]);

  return <div ref={containerRef} role="region" aria-label={ariaLabel} className={className} />;
}
