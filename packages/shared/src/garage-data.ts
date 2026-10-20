import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { authErrorMessage } from "./profile";
import {
  isAllowedPhotoType,
  MAX_PHOTOS_PER_VEHICLE,
  PHOTO_MAX_BYTES,
  PHOTO_MIME_TYPES,
  type VehicleInput,
  type VehicleVisibility,
} from "./vehicle";

/**
 * Acesso a dados da garagem, compartilhado entre web e mobile. Recebe o cliente
 * Supabase autenticado do chamador: toda autorização é aplicada pelo banco (RLS,
 * grants e políticas do Storage) — estas funções não substituem essa proteção.
 */
export type GearheadClient = SupabaseClient<Database>;

export const VEHICLE_PHOTOS_BUCKET = "vehicle-photos";

export interface VehiclePhoto {
  id: string;
  storage_path: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
  visibility: VehicleVisibility;
  created_at: string;
  updated_at: string;
  photos: VehiclePhoto[];
}

export interface VehicleWithPlate extends Vehicle {
  /** Só vem preenchida para o dono (RLS de vehicle_private). */
  plate: string | null;
}

export class GearheadDataError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GearheadDataError";
  }
}

/** Mensagem pt-BR segura para exibir na UI a partir de um erro da camada de dados. */
export function dataErrorMessage(e: unknown): string {
  if (e instanceof GearheadDataError) {
    switch (e.code) {
      case "invalid_photo":
      case "photo_limit":
        return e.message;
      case "not_found":
        return "Veículo ou foto não encontrado.";
      case "storage_error":
        return "Falha ao enviar ou remover a foto. Tente novamente.";
      case "23514":
        // Mensagens de limite vêm dos nossos triggers, já em pt-BR.
        return e.message.startsWith("Limite")
          ? `${e.message}.`
          : "Algum campo está em formato inválido.";
      case "42501":
        return "Você não tem permissão para esta ação.";
      default:
        return authErrorMessage({ code: e.code });
    }
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

function fail(error: { code?: string; message: string }): never {
  throw new GearheadDataError(error.code ?? "unknown", error.message);
}

// Colunas explícitas: `role` e afins não têm grant de leitura, então nunca usar "*".
const VEHICLE_COLUMNS =
  "id, owner_id, make, model, year, nickname, visibility, created_at, updated_at, photos:vehicle_photos(id, storage_path, created_at)";

type VehicleRow = Omit<Vehicle, "photos"> & { photos: VehiclePhoto[] | null };

function toVehicle(row: VehicleRow): Vehicle {
  const photos = [...(row.photos ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ...row, photos };
}

/** Veículos do usuário, mais recentes primeiro (máx. 20 por usuário, sem paginação). */
export async function listMyVehicles(client: GearheadClient, ownerId: string): Promise<Vehicle[]> {
  const { data, error } = await client
    .from("vehicles")
    .select(VEHICLE_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<VehicleRow[], { merge: false }>();
  if (error) fail(error);
  return data.map(toVehicle);
}

/** Retorna null se o veículo não existe ou não é visível para o usuário (RLS). */
export async function getVehicle(
  client: GearheadClient,
  id: string,
): Promise<VehicleWithPlate | null> {
  const { data, error } = await client
    .from("vehicles")
    .select(`${VEHICLE_COLUMNS}, private:vehicle_private(plate)`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      (VehicleRow & { private: { plate: string | null } | null }) | null,
      { merge: false }
    >();
  if (error) {
    // id malformado: tratar como inexistente.
    if (error.code === "22P02") return null;
    fail(error);
  }
  if (!data) return null;
  const { private: priv, ...row } = data;
  return { ...toVehicle(row), plate: priv?.plate ?? null };
}

function vehicleColumns(input: VehicleInput) {
  return {
    make: input.make,
    model: input.model,
    year: input.year,
    nickname: input.nickname,
    visibility: input.visibility,
  };
}

async function savePlate(client: GearheadClient, vehicleId: string, plate: string | null) {
  const table = client.from("vehicle_private");
  if (!plate) {
    const { error } = await table.delete().eq("vehicle_id", vehicleId);
    if (error) fail(error);
    return;
  }
  // Sem upsert: ON CONFLICT DO UPDATE exigiria grant de UPDATE em vehicle_id.
  const updated = await table.update({ plate }).eq("vehicle_id", vehicleId).select("vehicle_id");
  if (updated.error) fail(updated.error);
  if (updated.data.length > 0) return;
  const { error } = await table.insert({ vehicle_id: vehicleId, plate });
  if (error) fail(error);
}

export async function createVehicle(client: GearheadClient, input: VehicleInput): Promise<string> {
  const { data, error } = await client
    .from("vehicles")
    .insert(vehicleColumns(input))
    .select("id")
    .single();
  if (error) fail(error);

  if (input.plate) {
    try {
      await savePlate(client, data.id, input.plate);
    } catch (e) {
      // Sem transação pela API: desfaz o veículo para não deixar cadastro pela metade.
      await client.from("vehicles").delete().eq("id", data.id);
      throw e;
    }
  }
  return data.id;
}

export async function updateVehicle(
  client: GearheadClient,
  id: string,
  input: VehicleInput,
): Promise<void> {
  const { data, error } = await client
    .from("vehicles")
    .update(vehicleColumns(input))
    .eq("id", id)
    .select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Veículo não encontrado");
  await savePlate(client, id, input.plate);
}

/** Remove os arquivos do Storage e depois o veículo (fotos e placa saem em cascata). */
export async function deleteVehicle(client: GearheadClient, id: string): Promise<void> {
  const vehicle = await getVehicle(client, id);
  if (!vehicle) throw new GearheadDataError("not_found", "Veículo não encontrado");

  const paths = vehicle.photos.map((p) => p.storage_path);
  if (paths.length > 0) {
    const { error } = await client.storage.from(VEHICLE_PHOTOS_BUCKET).remove(paths);
    if (error) fail({ code: "storage_error", message: error.message });
  }

  const { data, error } = await client.from("vehicles").delete().eq("id", id).select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Veículo não encontrado");
}

/** Valida tipo e tamanho antes do upload (o bucket também rejeita). */
export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!isAllowedPhotoType(file.type)) return "Envie uma imagem JPG, PNG ou WebP.";
  if (file.size <= 0) return "Arquivo vazio.";
  if (file.size > PHOTO_MAX_BYTES) return "A foto deve ter no máximo 5 MB.";
  return null;
}

function randomName() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function uploadVehiclePhoto(
  client: GearheadClient,
  params: {
    ownerId: string;
    vehicle: Pick<Vehicle, "id" | "photos">;
    body: ArrayBuffer | Blob;
    contentType: string;
  },
): Promise<VehiclePhoto> {
  const size = params.body instanceof ArrayBuffer ? params.body.byteLength : params.body.size;
  const problem = validatePhoto({ type: params.contentType, size });
  if (problem) throw new GearheadDataError("invalid_photo", problem);
  if (params.vehicle.photos.length >= MAX_PHOTOS_PER_VEHICLE) {
    throw new GearheadDataError(
      "photo_limit",
      `Limite de ${MAX_PHOTOS_PER_VEHICLE} fotos por veículo atingido`,
    );
  }

  const ext = PHOTO_MIME_TYPES[params.contentType as keyof typeof PHOTO_MIME_TYPES];
  const path = `${params.ownerId}/${params.vehicle.id}/${randomName()}.${ext}`;
  const bucket = client.storage.from(VEHICLE_PHOTOS_BUCKET);

  const upload = await bucket.upload(path, params.body, {
    contentType: params.contentType,
    upsert: false,
  });
  if (upload.error) fail({ code: "storage_error", message: upload.error.message });

  const { data, error } = await client
    .from("vehicle_photos")
    .insert({ vehicle_id: params.vehicle.id, storage_path: path })
    .select("id, storage_path, created_at")
    .single();
  if (error) {
    await bucket.remove([path]);
    fail(error);
  }
  return data;
}

export async function deleteVehiclePhoto(client: GearheadClient, photo: VehiclePhoto) {
  const { data, error } = await client
    .from("vehicle_photos")
    .delete()
    .eq("id", photo.id)
    .select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Foto não encontrada");
  // Se a remoção do arquivo falhar, sobra um órfão invisível (sem linha em vehicle_photos,
  // ninguém além do dono lê). Aceitável; limpeza periódica entra na operação (Etapa 9).
  await client.storage.from(VEHICLE_PHOTOS_BUCKET).remove([photo.storage_path]);
}

/**
 * URLs assinadas (bucket privado). Caminhos sem permissão de leitura são omitidos.
 * Validade curta: uma URL já emitida continua válida até expirar, mesmo que o
 * veículo fique privado depois.
 */
export async function signPhotoUrls(
  client: GearheadClient,
  paths: string[],
  expiresIn = 600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await client.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error) fail({ code: "storage_error", message: error.message });
  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}
