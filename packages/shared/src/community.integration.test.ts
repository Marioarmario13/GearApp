/**
 * Integração com o Supabase LOCAL (API real). Roda via `npm run test:integration`.
 * Usa os usuários fictícios de supabase/seed.sql e sempre desfaz o que cria.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminListReports,
  blockUser,
  getProfileByUsername,
  listMyBlocks,
  listMyFriendships,
  removeFriendship,
  resolveReport,
  respondFriendRequest,
  searchProfiles,
  sendFriendRequest,
  submitReport,
  unblockUser,
} from "./community";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

async function signIn(email: string) {
  const client = createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: "Gearhead123" });
  if (error) throw error;
  return { client: client as GearheadClient, userId: data.user.id };
}

describe.skipIf(!url || !key)("comunidade — integração com Supabase local", () => {
  let piloto: Awaited<ReturnType<typeof signIn>>;
  let admin: Awaited<ReturnType<typeof signIn>>;

  async function cleanup() {
    await unblockUser(piloto.client, admin.userId);
    await unblockUser(admin.client, piloto.userId);
    for (const f of await listMyFriendships(piloto.client)) {
      if (f.other_id === admin.userId) await removeFriendship(piloto.client, f.friendship_id);
    }
  }

  beforeAll(async () => {
    piloto = await signIn("piloto@gearhead.test");
    admin = await signIn("admin@gearhead.test");
    await cleanup();
  });
  afterAll(cleanup);

  it("pedido de amizade, aceite e listagem dos dois lados", async () => {
    expect(await sendFriendRequest(piloto.client, admin.userId)).toBe("pending");
    const incoming = (await listMyFriendships(admin.client)).find(
      (f) => f.other_id === piloto.userId,
    )!;
    expect(incoming).toMatchObject({ incoming: true, status: "pending", username: "piloto_teste" });
    await respondFriendRequest(admin.client, incoming.friendship_id, true);
    const mine = (await listMyFriendships(piloto.client)).find((f) => f.other_id === admin.userId)!;
    expect(mine.status).toBe("accepted");
  });

  it("busca de pessoas por nome respeita bloqueios", async () => {
    const found = await searchProfiles(piloto.client, "Admin");
    expect(found.map((p) => p.username)).toContain("admin_gearhead");
    expect((await searchProfiles(piloto.client, "piloto_teste")).length).toBe(0);
    await blockUser(admin.client, piloto.userId);
    expect(await searchProfiles(piloto.client, "admin_gearhead")).toEqual([]);
    await unblockUser(admin.client, piloto.userId);
    await expect(searchProfiles(piloto.client, "ab")).rejects.toMatchObject({ code: "GH001" });
  });

  it("bloqueio esconde o perfil nos dois sentidos e desfaz a amizade", async () => {
    expect(await getProfileByUsername(admin.client, "piloto_teste")).not.toBeNull();
    await blockUser(piloto.client, admin.userId);
    expect(await getProfileByUsername(admin.client, "piloto_teste")).toBeNull();
    expect(await getProfileByUsername(piloto.client, "admin_gearhead")).toBeNull();
    expect((await listMyFriendships(piloto.client)).some((f) => f.other_id === admin.userId)).toBe(
      false,
    );
    expect((await listMyBlocks(piloto.client)).map((b) => b.user_id)).toContain(admin.userId);
    expect(await listMyBlocks(admin.client)).toEqual([]);
    await expect(sendFriendRequest(admin.client, piloto.userId)).rejects.toMatchObject({
      code: "P0002",
    });
    await unblockUser(piloto.client, admin.userId);
    expect(await getProfileByUsername(admin.client, "piloto_teste")).not.toBeNull();
  });

  it("denúncia chega à fila do admin e pode ser arquivada", async () => {
    const event = "55555555-5555-4555-8555-555555555551";
    await submitReport(admin.client, {
      targetType: "event",
      targetId: event,
      reason: "spam",
      details: "teste",
    }).catch(
      () => undefined, // pode já existir de execução anterior (duplicata aberta)
    );
    await expect(
      submitReport(admin.client, {
        targetType: "event",
        targetId: event,
        reason: "spam",
        details: null,
      }),
    ).rejects.toMatchObject({ code: "invalid_file" });
    const queue = await adminListReports(admin.client);
    const report = queue.find((r) => r.target_id === event)!;
    expect(report.reporter_username).toBe("admin_gearhead");
    expect(await adminListReports(piloto.client)).toEqual([]);
    await resolveReport(admin.client, report.id, "dismissed", "Teste automatizado");
    expect((await adminListReports(admin.client)).some((r) => r.id === report.id)).toBe(false);
  });
});
