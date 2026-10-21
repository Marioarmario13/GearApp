/**
 * Agrupamento de marcadores próximos na tela (site e app). Puro e sem dependências:
 * projeta em Web Mercator no zoom atual e junta pontos a menos de `radiusPx` pixels.
 * Pensado para dezenas de pontos (o radar devolve no máximo 50); O(n²) é suficiente.
 */
export interface ClusterInput {
  id: string;
  latitude: number;
  longitude: number;
  /** Destacados nunca entram em grupo (ex.: parceiro selecionado). */
  highlighted?: boolean;
}

export type Clustered<T extends ClusterInput> =
  | { kind: "point"; item: T }
  | {
      kind: "cluster";
      id: string;
      latitude: number;
      longitude: number;
      count: number;
      items: T[];
      /** Zoom em que o grupo começa a se separar (limitado a `maxZoom`). */
      expansionZoom: number;
    };

export interface ClusterOptions {
  radiusPx?: number;
  /** A partir deste zoom, nada é agrupado. */
  maxZoom?: number;
}

export const CLUSTER_ID_PREFIX = "cluster:";

function project(lat: number, lng: number, zoom: number): [number, number] {
  const scale = 256 * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return [
    ((lng + 180) / 360) * scale,
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  ];
}

export function clusterPoints<T extends ClusterInput>(
  points: readonly T[],
  zoom: number,
  { radiusPx = 48, maxZoom = 15 }: ClusterOptions = {},
): Clustered<T>[] {
  if (zoom >= maxZoom || points.length < 2) {
    return points.map((item) => ({ kind: "point", item }));
  }
  const nodes = points.map((item) => {
    const [x, y] = project(item.latitude, item.longitude, zoom);
    return { item, x, y, used: false };
  });
  const result: Clustered<T>[] = [];

  for (const seed of nodes) {
    if (seed.used) continue;
    seed.used = true;
    const members = [seed];
    let spread = 0;
    if (!seed.item.highlighted) {
      for (const other of nodes) {
        if (other.used || other.item.highlighted) continue;
        const d = Math.hypot(other.x - seed.x, other.y - seed.y);
        if (d <= radiusPx) {
          other.used = true;
          members.push(other);
          spread = Math.max(spread, d);
        }
      }
    }
    if (members.length === 1) {
      result.push({ kind: "point", item: seed.item });
      continue;
    }
    const items = members.map((m) => m.item);
    const expansion =
      spread > 0 ? Math.ceil(zoom + Math.log2(radiusPx / spread) + 0.01) : Number.POSITIVE_INFINITY;
    result.push({
      kind: "cluster",
      id: `${CLUSTER_ID_PREFIX}${seed.item.id}`,
      latitude: items.reduce((s, p) => s + p.latitude, 0) / items.length,
      longitude: items.reduce((s, p) => s + p.longitude, 0) / items.length,
      count: items.length,
      items,
      expansionZoom: Math.min(maxZoom, expansion),
    });
  }
  return result;
}
