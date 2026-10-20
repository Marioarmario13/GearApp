import { fail, type GearheadClient } from "./data-core";
import { BUSINESS_DOCUMENTS_BUCKET, getPrivateCredentials, listMyBusinesses } from "./partner-data";
import { listMyVehicles, VEHICLE_PHOTOS_BUCKET } from "./garage-data";

/** Direitos do titular (LGPD): exportação e exclusão. Ver docs/PRIVACY.md. */

export const DELETE_CONFIRMATION = "EXCLUIR";

/** JSON com todos os dados do usuário (acesso e portabilidade). */
export async function exportMyData(client: GearheadClient): Promise<unknown> {
  const { data, error } = await client.rpc("export_my_data");
  if (error) fail(error);
  return data;
}

/**
 * Exclui a conta. Ordem importa: (1) coleta os caminhos dos arquivos, (2) exclui a conta
 * no banco — atômico; se falhar (ex.: único admin), nada foi apagado —, (3) remove os
 * arquivos usando o token da sessão, que segue válido até expirar. Falha no passo 3 deixa
 * só arquivos órfãos, inacessíveis a terceiros, para a limpeza operacional (docs/OPERATIONS.md).
 */
export async function deleteMyAccount(
  client: GearheadClient,
  userId: string,
  confirmation: string,
) {
  const [vehicles, businesses] = await Promise.all([
    listMyVehicles(client, userId),
    listMyBusinesses(client, userId),
  ]);
  const photos = vehicles.flatMap((v) => v.photos.map((p) => p.storage_path));
  const docs = (
    await Promise.all(businesses.map((b) => getPrivateCredentials(client, b.id)))
  ).flatMap((list) => list.map((c) => c.document_path));

  const { error } = await client.rpc("delete_my_account", { p_confirmation: confirmation });
  if (error) fail(error);

  if (photos.length > 0) await client.storage.from(VEHICLE_PHOTOS_BUCKET).remove(photos);
  if (docs.length > 0) await client.storage.from(BUSINESS_DOCUMENTS_BUCKET).remove(docs);
  await client.auth.signOut().catch(() => undefined);
}
