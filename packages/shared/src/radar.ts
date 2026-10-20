import { z } from "zod";
import { fail, type GearheadClient } from "./data-core";
import type { BusinessKind } from "./partner";
import type { BrazilState } from "./profile";

/**
 * Radar: busca de parceiros por raio (PostGIS). Ver docs/MAPS.md para a escolha
 * de provedor e as regras de privacidade da localização do usuário.
 */

export const RADIUS_OPTIONS_KM = [2, 5, 10, 25, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 10;
export const MAX_RADIUS_KM = 100;
export const RADAR_RESULT_LIMIT = 50;

/** Estilo padrão (OpenFreeMap, sem chave). Configurável por variável de ambiente. */
export const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Centro geográfico aproximado do Brasil, para o mapa inicial sem localização. */
export const BRAZIL_CENTER = { latitude: -14.235, longitude: -51.9253, zoom: 3.5 } as const;

/** Caixa aproximada do Brasil — mesma regra da constraint e da RPC no banco. */
export const BRAZIL_BOUNDS = { minLat: -34.5, maxLat: 6.0, minLng: -74.5, maxLng: -28.0 } as const;

export function isInsideBrazil(lat: number, lng: number): boolean {
  return (
    lat >= BRAZIL_BOUNDS.minLat &&
    lat <= BRAZIL_BOUNDS.maxLat &&
    lng >= BRAZIL_BOUNDS.minLng &&
    lng <= BRAZIL_BOUNDS.maxLng
  );
}

/**
 * Privacidade: a posição do usuário sai do aparelho arredondada para 2 casas
 * decimais (~1,1 km). É suficiente para um raio mínimo de 2 km e evita enviar a
 * localização exata. Não é armazenada no servidor.
 */
export function coarsenCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

const coordinate = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v)) : v),
    z.number("Coordenada inválida").finite("Coordenada inválida").min(min).max(max),
  );

/** Pin do estabelecimento (precisa estar no Brasil). */
export const businessLocationSchema = z
  .object({
    latitude: coordinate(BRAZIL_BOUNDS.minLat, BRAZIL_BOUNDS.maxLat),
    longitude: coordinate(BRAZIL_BOUNDS.minLng, BRAZIL_BOUNDS.maxLng),
  })
  .refine((c) => isInsideBrazil(c.latitude, c.longitude), "A localização precisa estar no Brasil");
export type BusinessLocation = z.infer<typeof businessLocationSchema>;

export interface RadarQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  kind?: BusinessKind | null;
  specialty?: string | null;
}

export interface RadarResult {
  id: string;
  name: string;
  kind: BusinessKind;
  city: string;
  state: BrazilState;
  latitude: number;
  longitude: number;
  distance_m: number;
  specialty_ids: string[];
}

export function clampRadius(km: number | undefined): number {
  if (!km || !Number.isFinite(km)) return DEFAULT_RADIUS_KM;
  return Math.min(Math.max(km, 1), MAX_RADIUS_KM);
}

/** Parceiros aprovados no raio, do mais próximo ao mais distante (máx. 50). */
export async function searchNearby(client: GearheadClient, q: RadarQuery): Promise<RadarResult[]> {
  const { data, error } = await client.rpc("search_nearby_businesses", {
    p_latitude: q.latitude,
    p_longitude: q.longitude,
    p_radius_km: clampRadius(q.radiusKm),
    p_kind: q.kind ?? undefined,
    p_specialty: q.specialty ?? undefined,
    p_limit: RADAR_RESULT_LIMIT,
  });
  if (error) fail(error);
  return data as RadarResult[];
}

/** Define (ou remove, com null) o pin do estabelecimento. Só o dono (RPC verifica). */
export async function setBusinessLocation(
  client: GearheadClient,
  businessId: string,
  location: BusinessLocation | null,
): Promise<void> {
  const { error } = await client.rpc("set_business_location", {
    p_business_id: businessId,
    p_latitude: location?.latitude,
    p_longitude: location?.longitude,
  });
  if (error) fail(error);
}

/** "350 m", "4,2 km", "37 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return km < 10
    ? `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} km`
    : `${Math.round(km)} km`;
}

/** Link para abrir a rota no app de mapas do aparelho/navegador (sem API paga). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}
