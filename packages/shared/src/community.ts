import { z } from "zod";
import { fail, GearheadDataError, type GearheadClient } from "./data-core";
import type { PublicProfile } from "./profile";
import type { Vehicle } from "./garage-data";

/** Comunidade: amizades, bloqueios e denúncias. Bloqueios são aplicados no banco (RLS/RPCs). */

export type FriendshipStatus = "pending" | "accepted";
export type ReportTarget = "profile" | "vehicle" | "business" | "event" | "offer";
export const REPORT_REASONS = [
  "spam",
  "offensive",
  "fraud",
  "dangerous_driving",
  "privacy",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = "open" | "resolved" | "dismissed";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam ou propaganda enganosa",
  offensive: "Conteúdo ofensivo",
  fraud: "Golpe ou fraude",
  dangerous_driving: "Incentivo a direção perigosa ou racha",
  privacy: "Exposição de dados pessoais",
  other: "Outro motivo",
};

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  profile: "Perfil",
  vehicle: "Veículo",
  business: "Parceiro",
  event: "Evento",
  offer: "Oferta",
};

export const reportInputSchema = z.object({
  targetType: z.enum(["profile", "vehicle", "business", "event", "offer"]),
  targetId: z.uuid("Alvo inválido"),
  reason: z.enum(REPORT_REASONS, "Escolha o motivo"),
  details: z
    .string()
    .trim()
    .max(1000, "Máximo de 1000 caracteres")
    .nullish()
    .transform((v) => (v ? v : null)),
});
export type ReportInput = z.infer<typeof reportInputSchema>;

export interface Friendship {
  friendship_id: string;
  other_id: string;
  username: string | null;
  display_name: string | null;
  status: FriendshipStatus;
  incoming: boolean;
  created_at: string;
}

export interface BlockedUser {
  user_id: string;
  username: string | null;
  display_name: string | null;
  blocked_at: string;
}

const PROFILE_COLUMNS =
  "id, username, display_name, city, state, avatar_url, created_at, updated_at";

/** Perfil público por username; null se não existe ou há bloqueio entre os dois (RLS). */
export async function getProfileByUsername(
  client: GearheadClient,
  username: string,
): Promise<PublicProfile | null> {
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("username", username)
    .maybeSingle<PublicProfile>();
  if (error) fail(error);
  return data;
}

export interface PersonResult {
  id: string;
  username: string;
  display_name: string | null;
  city: string | null;
  state: string | null;
}

/** Termo normalizado para a busca de pessoas; null se inválido (o banco valida de novo). */
export function normalizePeopleQuery(query: string): string | null {
  const term = query.trim().replace(/^@/, "").toLowerCase();
  return term.length >= 3 && term.length <= 30 ? term : null;
}

/** Busca por username ou nome (até 20; bloqueios e o próprio usuário ficam de fora). */
export async function searchProfiles(
  client: GearheadClient,
  query: string,
): Promise<PersonResult[]> {
  const term = normalizePeopleQuery(query);
  if (!term) throw new GearheadDataError("GH001", "Digite de 3 a 30 caracteres para buscar.");
  const { data, error } = await client.rpc("search_profiles", { p_query: term });
  if (error) fail(error);
  return data as PersonResult[];
}

/** Veículos públicos de um usuário (RLS: some se houver bloqueio). */
export async function listPublicVehicles(
  client: GearheadClient,
  ownerId: string,
): Promise<Vehicle[]> {
  const { data, error } = await client
    .from("vehicles")
    .select(
      "id, owner_id, make, model, year, nickname, visibility, created_at, updated_at, photos:vehicle_photos(id, storage_path, created_at)",
    )
    .eq("owner_id", ownerId)
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(20)
    .overrideTypes<Vehicle[], { merge: false }>();
  if (error) fail(error);
  return data.map((v) => ({
    ...v,
    photos: [...(v.photos ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

export async function listMyFriendships(client: GearheadClient): Promise<Friendship[]> {
  const { data, error } = await client.rpc("my_friendships");
  if (error) fail(error);
  return data;
}

export async function sendFriendRequest(
  client: GearheadClient,
  userId: string,
): Promise<FriendshipStatus> {
  const { data, error } = await client.rpc("send_friend_request", { p_user_id: userId });
  if (error) fail(error);
  return data;
}

export async function respondFriendRequest(
  client: GearheadClient,
  friendshipId: string,
  accept: boolean,
) {
  const { error } = await client.rpc("respond_friend_request", {
    p_friendship_id: friendshipId,
    p_accept: accept,
  });
  if (error) fail(error);
}

/** Desfaz amizade ou retira pedido (qualquer um dos dois lados). */
export async function removeFriendship(client: GearheadClient, friendshipId: string) {
  const { data, error } = await client
    .from("friendships")
    .delete()
    .eq("id", friendshipId)
    .select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Vínculo não encontrado.");
}

export async function blockUser(client: GearheadClient, userId: string) {
  const { error } = await client.rpc("block_user", { p_user_id: userId });
  if (error) fail(error);
}

export async function unblockUser(client: GearheadClient, userId: string) {
  const { error } = await client.rpc("unblock_user", { p_user_id: userId });
  if (error) fail(error);
}

export async function listMyBlocks(client: GearheadClient): Promise<BlockedUser[]> {
  const { data, error } = await client.rpc("my_blocks");
  if (error) fail(error);
  return data;
}

export async function submitReport(client: GearheadClient, input: ReportInput) {
  const { error } = await client.from("reports").insert({
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  if (error) {
    if (error.code === "23505") {
      throw new GearheadDataError(
        "invalid_file",
        "Você já denunciou este conteúdo; nossa equipe está analisando.",
      );
    }
    fail(error);
  }
}

// ---------------------------------------------------------------------------
// Administração
// ---------------------------------------------------------------------------

export interface AdminReport {
  id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  reporter_username: string | null;
  same_target_open: number;
}

export async function adminListReports(
  client: GearheadClient,
  status: ReportStatus = "open",
): Promise<AdminReport[]> {
  const { data, error } = await client.rpc("admin_list_reports", { p_status: status });
  if (error) fail(error);
  return data;
}

export async function resolveReport(
  client: GearheadClient,
  reportId: string,
  status: Exclude<ReportStatus, "open">,
  note: string | null,
) {
  const { error } = await client.rpc("resolve_report", {
    p_report_id: reportId,
    p_status: status,
    p_note: note ?? undefined,
  });
  if (error) fail(error);
}

export async function moderateHideVehicle(client: GearheadClient, vehicleId: string, note: string) {
  const { error } = await client.rpc("moderate_hide_vehicle", {
    p_vehicle_id: vehicleId,
    p_note: note,
  });
  if (error) fail(error);
}

/** Caminho da página do alvo de uma denúncia (para o painel admin). */
export function reportTargetPath(
  type: ReportTarget,
  id: string,
  username?: string | null,
): string | null {
  switch (type) {
    case "vehicle":
      return `/garagem/${id}`;
    case "business":
      return `/admin/parceiros/${id}`;
    case "event":
      return `/eventos/${id}`;
    case "offer":
      return `/ofertas/${id}`;
    case "profile":
      return username ? `/u/${username}` : null;
  }
}
