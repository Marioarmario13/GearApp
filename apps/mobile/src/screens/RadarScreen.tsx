import {
  BRAZIL_CENTER,
  BUSINESS_KIND_LABELS,
  BUSINESS_KINDS,
  coarsenCoordinate,
  dataErrorMessage,
  DEFAULT_RADIUS_KM,
  formatDistance,
  RADIUS_OPTIONS_KM,
  searchNearby,
  type BusinessKind,
  type RadarResult,
} from "@gearhead/shared";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MapWebView, type MapPoint, type MapState } from "@/components/MapWebView";
import { Button, colors, Message } from "@/components/ui";
import { locateForRadar } from "@/lib/location";
import { supabase } from "@/lib/supabase";

const zoomForRadius = (km: number) => Math.max(5, Math.min(14, 14.2 - Math.log2(km) * 1.05));

function Chips<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
      style={{ flexGrow: 0 }}
      accessibilityLabel={label}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && { color: "#fff" }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const RADIUS_CHIPS = RADIUS_OPTIONS_KM.map((km) => ({ value: km as number, label: `${km} km` }));
const KIND_CHIPS = [
  { value: "" as const, label: "Todos" },
  ...BUSINESS_KINDS.map((k) => ({ value: k, label: BUSINESS_KIND_LABELS[k] })),
];

export function RadarScreen() {
  const router = useRouter();
  const [origin, setOrigin] = useState<MapPoint | null>(null);
  const [mapCenter, setMapCenter] = useState<MapPoint>(BRAZIL_CENTER);
  const [view, setView] = useState<{ center: MapPoint; zoom: number }>({
    center: BRAZIL_CENTER,
    zoom: BRAZIL_CENTER.zoom,
  });
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [kind, setKind] = useState<BusinessKind | "">("");
  const [results, setResults] = useState<RadarResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(
    point: MapPoint,
    overrides: { radiusKm?: number; kind?: BusinessKind | "" } = {},
  ) {
    const p = {
      latitude: coarsenCoordinate(point.latitude),
      longitude: coarsenCoordinate(point.longitude),
    };
    const r = overrides.radiusKm ?? radiusKm;
    setOrigin(p);
    setView({ center: p, zoom: zoomForRadius(r) });
    setError(null);
    setLoading(true);
    try {
      setResults(
        await searchNearby(supabase, {
          ...p,
          radiusKm: r,
          kind: (overrides.kind ?? kind) || null,
        }),
      );
    } catch (e) {
      setError(dataErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function locateMe() {
    setError(null);
    setLoading(true);
    const res = await locateForRadar();
    setLoading(false);
    if (!res.ok) {
      setError(
        res.reason === "denied"
          ? "Sem permissão de localização. Você pode buscar pelo centro do mapa."
          : "Não foi possível obter sua localização agora.",
      );
      return;
    }
    await search(res);
  }

  function changeRadius(km: number) {
    setRadiusKm(km);
    if (origin) void search(origin, { radiusKm: km });
  }

  function changeKind(k: BusinessKind | "") {
    setKind(k);
    if (origin) void search(origin, { kind: k });
  }

  const mapState = useMemo<MapState>(
    () => ({
      center: view.center,
      zoom: view.zoom,
      markers: (results ?? []).map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
      })),
      radius: origin ? { ...origin, km: radiusKm } : null,
    }),
    [view, results, origin, radiusKm],
  );

  return (
    <FlatList
      data={results ?? []}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Chips label="Raio" options={RADIUS_CHIPS} value={radiusKm} onChange={changeRadius} />
          <Chips label="Tipo" options={KIND_CHIPS} value={kind} onChange={changeKind} />
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <Button onPress={() => void locateMe()} loading={loading}>
                Usar minha localização
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" onPress={() => void search(mapCenter)}>
                Centro do mapa
              </Button>
            </View>
          </View>
          <Text style={styles.hint}>
            Sua localização só é usada nesta busca, sai do aparelho arredondada (~1 km) e não é
            armazenada.
          </Text>
          <Message error={error} />
          <MapWebView
            accessibilityLabel="Mapa do radar"
            state={mapState}
            onMoveEnd={(c) => setMapCenter(c)}
            onMarkerPress={(id) => router.push(`/parceiros/${id}`)}
          />
          <Text accessibilityRole="header" style={styles.section}>
            {loading
              ? "Buscando…"
              : results === null
                ? "Escolha um ponto para buscar"
                : `${results.length} parceiro(s) em até ${radiusKm} km`}
          </Text>
          {loading && <ActivityIndicator color={colors.accent} />}
          {results?.length === 0 && !loading && (
            <Text style={styles.muted}>Nenhum parceiro verificado nesse raio. Aumente o raio.</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${formatDistance(item.distance_m)}`}
          onPress={() => router.push(`/parceiros/${item.id}`)}
          style={styles.card}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>✓ {item.name}</Text>
            <Text style={styles.muted}>
              {BUSINESS_KIND_LABELS[item.kind]} · {item.city}/{item.state}
            </Text>
          </View>
          <Text style={styles.distance}>{formatDistance(item.distance_m)}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  actions: { flexDirection: "row", gap: 8 },
  hint: { color: colors.muted, fontSize: 12 },
  section: { color: colors.text, fontSize: 18, fontWeight: "600", marginTop: 4 },
  muted: { color: colors.muted, fontSize: 14 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  distance: { color: colors.accent, fontWeight: "600" },
});
