import { z } from "zod";
import { fail, type GearheadClient } from "./data-core";

/**
 * GPS social seguro. Todas as regras (amizade, bloqueio, prazo, revogação, limpeza,
 * frequência mínima) estão nas RPCs do banco — ver *_social_gps.sql e docs/SECURITY.md.
 */

export const LOCATION_PURPOSES = ["meetup", "convoy", "safety", "other"] as const;
export type LocationPurpose = (typeof LOCATION_PURPOSES)[number];

export const LOCATION_PURPOSE_LABELS: Record<LocationPurpose, string> = {
  meetup: "Encontro",
  convoy: "Comboio/passeio",
  safety: "Segurança (chegar bem)",
  other: "Outro",
};

/** Durações oferecidas na interface (minutos). O banco aceita de 5 a 480. */
export const SHARE_DURATIONS_MIN = [15, 30, 60, 120, 240, 480] as const;
export const PRESENCE_DURATIONS_MIN = [30, 60, 120] as const;

/** Intervalo de envio de posição pelo app/site (o banco ignora < 30 s). */
export const LOCATION_UPDATE_INTERVAL_MS = 60_000;

export const shareInputSchema = z.object({
  purpose: z.enum(LOCATION_PURPOSES, "Escolha a finalidade"),
  minutes: z.coerce.number().int().min(5, "Mínimo 5 minutos").max(480, "Máximo 8 horas"),
  recipientIds: z
    .array(z.uuid())
    .min(1, "Escolha ao menos um amigo")
    .max(20, "Máximo de 20 amigos"),
  note: z
    .string()
    .trim()
    .max(120, "Máximo de 120 caracteres")
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type ShareInput = z.infer<typeof shareInputSchema>;

export interface MyLocationSession {
  id: string;
  purpose: LocationPurpose;
  purpose_note: string | null;
  started_at: string;
  expires_at: string;
  position_at: string | null;
  recipients: { id: string; username: string | null; display_name: string | null }[];
}

export interface SharedLocation {
  session_id: string;
  owner_id: string;
  username: string | null;
  display_name: string | null;
  purpose: LocationPurpose;
  purpose_note: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  position_at: string | null;
  expires_at: string;
}

export interface NearbyFriend {
  user_id: string;
  username: string | null;
  display_name: string | null;
  distance_band: string;
  until: string;
}

export async function startLocationSession(
  client: GearheadClient,
  input: ShareInput,
): Promise<string> {
  const { data, error } = await client.rpc("start_location_session", {
    p_purpose: input.purpose,
    p_minutes: input.minutes,
    p_recipient_ids: input.recipientIds,
    p_note: input.note ?? undefined,
  });
  if (error) fail(error);
  return data;
}

export async function updateSessionLocation(
  client: GearheadClient,
  sessionId: string,
  position: { latitude: number; longitude: number; accuracy?: number | null },
): Promise<string> {
  const { data, error } = await client.rpc("update_session_location", {
    p_session_id: sessionId,
    p_latitude: position.latitude,
    p_longitude: position.longitude,
    p_accuracy_m: position.accuracy ?? undefined,
  });
  if (error) fail(error);
  return data;
}

export async function stopLocationSession(client: GearheadClient, sessionId: string) {
  const { error } = await client.rpc("stop_location_session", { p_session_id: sessionId });
  if (error) fail(error);
}

export async function getMyLocationSession(
  client: GearheadClient,
): Promise<MyLocationSession | null> {
  const { data, error } = await client.rpc("my_location_session");
  if (error) fail(error);
  return (data[0] as MyLocationSession | undefined) ?? null;
}

export async function listSharedWithMe(client: GearheadClient): Promise<SharedLocation[]> {
  const { data, error } = await client.rpc("shared_locations_for_me");
  if (error) fail(error);
  return data;
}

/** Presença aproximada: o banco guarda só uma célula de ~5,5 km. */
export async function setPresence(
  client: GearheadClient,
  position: { latitude: number; longitude: number },
  minutes: number,
): Promise<string> {
  const { data, error } = await client.rpc("set_presence", {
    p_latitude: position.latitude,
    p_longitude: position.longitude,
    p_minutes: minutes,
  });
  if (error) fail(error);
  return data;
}

export async function clearPresence(client: GearheadClient) {
  const { error } = await client.rpc("clear_presence");
  if (error) fail(error);
}

export async function listNearbyFriends(
  client: GearheadClient,
  position: { latitude: number; longitude: number },
): Promise<NearbyFriend[]> {
  const { data, error } = await client.rpc("nearby_friends", {
    p_latitude: position.latitude,
    p_longitude: position.longitude,
  });
  if (error) fail(error);
  return data;
}

/** "faltam 1 h 20 min" / "faltam 5 min" / "encerrado". */
export function formatRemaining(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "encerrado";
  const min = Math.ceil(ms / 60_000);
  if (min < 60) return `faltam ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `faltam ${h} h ${m} min` : `faltam ${h} h`;
}

/** "agora", "há 3 min", "há 2 h" — idade da última posição. */
export function formatAge(at: string | null, now: Date = new Date()): string {
  if (!at) return "sem posição ainda";
  const min = Math.floor((now.getTime() - new Date(at).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)} h`;
}
