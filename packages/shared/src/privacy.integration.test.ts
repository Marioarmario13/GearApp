/**
 * Integração com o Supabase LOCAL (API + Storage reais). Roda via `npm run test:integration`.
 * Cria um usuário descartável (cadastro local sem confirmação de e-mail) e o exclui.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";
import {
  createVehicle,
  uploadVehiclePhoto,
  VEHICLE_PHOTOS_BUCKET,
  getVehicle,
} from "./garage-data";
import { deleteMyAccount, exportMyData } from "./privacy";
import { vehicleInputSchema } from "./vehicle";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
).buffer;

describe.skipIf(!url || !key)("privacidade — integração com Supabase local", () => {
  it("exporta os dados e exclui a conta com os arquivos", async () => {
    const client = createClient<Database>(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as GearheadClient;
    const email = `exclusao-${Date.now()}@gearhead.test`;
    const { data, error } = await client.auth.signUp({
      email,
      password: "Teste12345",
      options: {
        data: { username: `exc_${Date.now().toString(36)}`, display_name: "Teste Exclusão" },
      },
    });
    if (error) throw error;
    const userId = data.user!.id;

    const vehicleId = await createVehicle(
      client,
      vehicleInputSchema().parse({ make: "Fiat", model: "147", year: 1979, plate: "AAA1A11" }),
    );
    const vehicle = (await getVehicle(client, vehicleId))!;
    const photo = await uploadVehiclePhoto(client, {
      ownerId: userId,
      vehicle,
      body: PNG,
      contentType: "image/png",
    });

    const exported = (await exportMyData(client)) as {
      conta: { email: string };
      veiculos: { placa: string; fotos: string[] }[];
    };
    expect(exported.conta.email).toBe(email);
    expect(exported.veiculos[0]).toMatchObject({ placa: "AAA1A11", fotos: [photo.storage_path] });

    await expect(deleteMyAccount(client, userId, "sim")).rejects.toMatchObject({ code: "GH001" });
    expect(await getVehicle(client, vehicleId)).not.toBeNull();

    await deleteMyAccount(client, userId, "EXCLUIR");

    const admin = createClient<Database>(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await admin.auth.signInWithPassword({ email: "admin@gearhead.test", password: "Gearhead123" });
    const { data: left } = await admin.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .list(`${userId}/${vehicleId}`);
    expect(left ?? []).toHaveLength(0);
    const relogin = await createClient<Database>(url!, key!, {
      auth: { persistSession: false },
    }).auth.signInWithPassword({
      email,
      password: "Teste12345",
    });
    expect(relogin.error).not.toBeNull();
  });
});
