import { clusterPoints, CLUSTER_ID_PREFIX } from "@gearhead/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { buildMapHtml } from "@/lib/map-html";
import { colors } from "./ui";

// Os tipos do pacote declaram `WebView<P = undefined>`, o que vira `props: never` com
// TypeScript estrito; instanciar com `object` restaura as props corretas.
const TypedWebView = WebView<object>;

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export interface MapMarker extends MapPoint {
  id: string;
  highlighted?: boolean;
}

export interface MapState {
  center: MapPoint;
  zoom: number;
  markers?: MapMarker[];
  radius?: (MapPoint & { km: number }) | null;
}

/**
 * Mapa (MapLibre GL JS) dentro de uma WebView — funciona no Expo Go, sem chave.
 * Ver src/lib/map-html.ts e docs/MAPS.md.
 */
export function MapWebView({
  state,
  onMarkerPress,
  onMoveEnd,
  style,
  accessibilityLabel,
}: {
  state: MapState;
  onMarkerPress?: (id: string) => void;
  onMoveEnd?: (center: MapPoint & { zoom: number }) => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}) {
  const ref = useRef<WebView<object>>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const html = useMemo(() => buildMapHtml(), []);
  const [zoom, setZoom] = useState(Math.round(state.zoom));
  const groups = useMemo(() => clusterPoints(state.markers ?? [], zoom), [state.markers, zoom]);

  // Câmera e raio: enviados só quando o estado pedido muda.
  useEffect(() => {
    if (!ready) return;
    const { markers: _markers, ...camera } = state;
    ref.current?.injectJavaScript(`window.__update(${JSON.stringify(camera)}); true;`);
  }, [ready, state]);

  // Marcadores agrupados conforme o zoom atual do mapa.
  useEffect(() => {
    if (!ready) return;
    const list = groups.map((g) =>
      g.kind === "cluster"
        ? { id: g.id, latitude: g.latitude, longitude: g.longitude, count: g.count }
        : g.item,
    );
    ref.current?.injectJavaScript(`window.__markers(${JSON.stringify(list)}); true;`);
  }, [ready, groups]);

  function pressMarker(id: string) {
    const group = groups.find((g) => g.kind === "cluster" && g.id === id);
    if (group?.kind === "cluster") {
      ref.current?.injectJavaScript(
        `window.__zoomTo(${group.longitude}, ${group.latitude}, ${group.expansionZoom}); true;`,
      );
    } else if (!id.startsWith(CLUSTER_ID_PREFIX)) onMarkerPress?.(id);
  }

  function onMessage(event: WebViewMessageEvent) {
    let msg: { type?: string; id?: string; latitude?: number; longitude?: number; zoom?: number };
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "ready") setReady(true);
    else if (msg.type === "error") setFailed(true);
    else if (msg.type === "marker" && typeof msg.id === "string") pressMarker(msg.id);
    else if (
      msg.type === "moveend" &&
      typeof msg.latitude === "number" &&
      typeof msg.longitude === "number"
    ) {
      if (typeof msg.zoom === "number") setZoom(Math.round(msg.zoom));
      onMoveEnd?.({ latitude: msg.latitude, longitude: msg.longitude, zoom: msg.zoom ?? 10 });
    }
  }

  return (
    <View style={[styles.wrapper, style]} accessibilityLabel={accessibilityLabel}>
      {failed ? (
        <Text style={styles.error}>Não foi possível carregar o mapa. Verifique a conexão.</Text>
      ) : (
        <TypedWebView
          ref={ref}
          source={{ html }}
          originWhitelist={["*"]}
          onMessage={onMessage}
          onError={() => setFailed(true)}
          javaScriptEnabled
          // A página do mapa não precisa de cookies, armazenamento nem geolocalização.
          geolocationEnabled={false}
          incognito
          setSupportMultipleWindows={false}
          style={styles.webview}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  webview: { flex: 1, backgroundColor: colors.background },
  error: { color: colors.muted, padding: 16 },
});
