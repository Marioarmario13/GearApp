/**
 * Integração com o Supabase LOCAL (API + Storage reais). Roda via `npm run test:integration`,
 * que injeta SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY a partir de `supabase status`.
 * Usa os usuários fictícios de supabase/seed.sql. Nunca aponte para produção.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./database.types";
import {
  createVehicle,
  deleteVehicle,
  deleteVehiclePhoto,
  getVehicle,
  listMyVehicles,
  signPhotoUrls,
  updateVehicle,
  uploadVehiclePhoto,
  VEHICLE_PHOTOS_BUCKET,
  type GearheadClient,
} from "./garage-data";
import { vehicleInputSchema } from "./vehicle";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const SEED_PASSWORD = "Gearhead123";

// PNG 1x1 válido.
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
).buffer;

async function signIn(email: string): Promise<{ client: GearheadClient; userId: string }> {
  const client = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return { client, userId: data.user.id };
}

const parse = (input: unknown) => vehicleInputSchema().parse(input);

describe.skipIf(!url || !key)("garagem — integração com Supabase local", () => {
  let owner: Awaited<ReturnType<typeof signIn>>;
  let other: Awaited<ReturnType<typeof signIn>>;
  let vehicleId: string;

  beforeAll(async () => {
    owner = await signIn("piloto@gearhead.test");
    other = await signIn("admin@gearhead.test");
  });

  afterAll(async () => {
    // Limpeza best-effort caso algum teste falhe no meio.
    if (vehicleId && (await getVehicle(owner.client, vehicleId))) {
      await deleteVehicle(owner.client, vehicleId);
    }
  });

  it("cria veículo privado com placa visível só para o dono", async () => {
    vehicleId = await createVehicle(
      owner.client,
      parse({ make: "Chevrolet", model: "Opala", year: "1978", plate: "opa-1978" }),
    );
    const mine = await getVehicle(owner.client, vehicleId);
    expect(mine).toMatchObject({ model: "Opala", visibility: "private", plate: "OPA1978" });
    expect((await listMyVehicles(owner.client, owner.userId)).map((v) => v.id)).toContain(
      vehicleId,
    );

    expect(await getVehicle(other.client, vehicleId)).toBeNull();
  });

  it("envia foto pelo Storage e só o dono assina a URL enquanto privado", async () => {
    const vehicle = (await getVehicle(owner.client, vehicleId))!;
    const photo = await uploadVehiclePhoto(owner.client, {
      ownerId: owner.userId,
      vehicle,
      body: PNG,
      contentType: "image/png",
    });
    expect(photo.storage_path.startsWith(`${owner.userId}/${vehicleId}/`)).toBe(true);

    const ownUrls = await signPhotoUrls(owner.client, [photo.storage_path]);
    const res = await fetch(ownUrls[photo.storage_path]!);
    expect(res.status).toBe(200);

    expect(await signPhotoUrls(other.client, [photo.storage_path])).toEqual({});
  });

  it("ao tornar público, outro usuário vê o veículo e a foto, mas não a placa", async () => {
    await updateVehicle(
      owner.client,
      vehicleId,
      parse({
        make: "Chevrolet",
        model: "Opala",
        year: 1978,
        plate: "OPA1978",
        visibility: "public",
      }),
    );
    const seen = await getVehicle(other.client, vehicleId);
    expect(seen).toMatchObject({ model: "Opala", visibility: "public", plate: null });
    expect(seen!.photos).toHaveLength(1);

    const path = seen!.photos[0]!.storage_path;
    const urls = await signPhotoUrls(other.client, [path]);
    expect((await fetch(urls[path]!)).status).toBe(200);
  });

  it("outro usuário não altera nem exclui o veículo", async () => {
    await expect(
      updateVehicle(other.client, vehicleId, parse({ make: "X", model: "Y", year: 2000 })),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteVehicle(other.client, vehicleId)).rejects.toMatchObject({
      code: "not_found",
    });
    expect((await getVehicle(owner.client, vehicleId))!.model).toBe("Opala");
  });

  it("o bucket rejeita tipo não permitido e upload fora da própria pasta", async () => {
    const bucket = owner.client.storage.from(VEHICLE_PHOTOS_BUCKET);
    const gif = await bucket.upload(`${owner.userId}/${vehicleId}/x.gif`, PNG, {
      contentType: "image/gif",
    });
    expect(gif.error).not.toBeNull();

    const foreign = await bucket.upload(`${other.userId}/${vehicleId}/x.png`, PNG, {
      contentType: "image/png",
    });
    expect(foreign.error).not.toBeNull();
  });

  it("remove foto e, ao excluir o veículo, apaga os arquivos do Storage", async () => {
    const vehicle = (await getVehicle(owner.client, vehicleId))!;
    await deleteVehiclePhoto(owner.client, vehicle.photos[0]!);
    expect((await getVehicle(owner.client, vehicleId))!.photos).toHaveLength(0);

    const again = await uploadVehiclePhoto(owner.client, {
      ownerId: owner.userId,
      vehicle: (await getVehicle(owner.client, vehicleId))!,
      body: PNG,
      contentType: "image/png",
    });

    await deleteVehicle(owner.client, vehicleId);
    expect(await getVehicle(owner.client, vehicleId)).toBeNull();

    const { data } = await owner.client.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .list(`${owner.userId}/${vehicleId}`);
    expect(data ?? []).toHaveLength(0);
    expect(again.storage_path).toBeTruthy();
    vehicleId = "";
  });
});
