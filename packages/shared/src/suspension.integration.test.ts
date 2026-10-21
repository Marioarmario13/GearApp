/**
 * Integração com o Supabase LOCAL (API real). Roda via `npm run test:integration`.
 * Suspende o piloto do seed e SEMPRE reativa no final.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";
import { listMyVehicles } from "./garage-data";
import { ACCOUNT_SUSPENDED_MESSAGE } from "./profile";
import { adminListSuspensions, adminSuspendUser, adminUnsuspendUser } from "./suspension";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

function newClient() {
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signIn(email: string) {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: "Gearhead123" });
  if (error) throw error;
  return { client: client as GearheadClient, userId: data.user.id };
}

describe.skipIf(!url || !key)("suspensão de conta — integração com Supabase local", () => {
  let piloto: Awaited<ReturnType<typeof signIn>>;
  let admin: Awaited<ReturnType<typeof signIn>>;

  beforeAll(async () => {
    admin = await signIn("admin@gearhead.test");
    piloto = await signIn("piloto@gearhead.test");
  });
  afterAll(async () => {
    await adminUnsuspendUser(admin.client, piloto.userId, "Fim do teste").catch(() => undefined);
  });

  it("bloqueia API, sessão e novo login; reativar devolve o acesso", async () => {
    expect(Array.isArray(await listMyVehicles(piloto.client, piloto.userId))).toBe(true);
    await adminSuspendUser(admin.client, piloto.userId, "Teste de integração");
    expect((await adminListSuspensions(admin.client)).map((s) => s.user_id)).toContain(
      piloto.userId,
    );

    // Token de acesso ainda válido: o pre-request do PostgREST recusa.
    await expect(listMyVehicles(piloto.client, piloto.userId)).rejects.toMatchObject({
      message: ACCOUNT_SUSPENDED_MESSAGE,
    });
    // Sessão encerrada no Auth.
    expect((await piloto.client.auth.getUser()).error).not.toBeNull();
    // Novo login recusado pelo hook.
    const { error } = await newClient().auth.signInWithPassword({
      email: "piloto@gearhead.test",
      password: "Gearhead123",
    });
    expect(error?.message).toBe(ACCOUNT_SUSPENDED_MESSAGE);

    await adminUnsuspendUser(admin.client, piloto.userId, "Teste encerrado");
    const back = await signIn("piloto@gearhead.test");
    expect(Array.isArray(await listMyVehicles(back.client, back.userId))).toBe(true);
  });

  it("usuário comum não suspende ninguém", async () => {
    await expect(adminSuspendUser(piloto.client, admin.userId, "tentativa")).rejects.toMatchObject({
      code: "42501",
    });
  });
});
