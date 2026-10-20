/**
 * Integração com o Supabase LOCAL (API real). Roda via `npm run test:integration`.
 * Cria amizade piloto↔admin (seed), compartilha e desfaz tudo no final.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listMyFriendships,
  removeFriendship,
  respondFriendRequest,
  sendFriendRequest,
} from "./community";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";
import {
  clearPresence,
  getMyLocationSession,
  listNearbyFriends,
  listSharedWithMe,
  setPresence,
  startLocationSession,
  stopLocationSession,
  updateSessionLocation,
} from "./social-gps";

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

describe.skipIf(!url || !key)("GPS social — integração com Supabase local", () => {
  let piloto: Awaited<ReturnType<typeof signIn>>;
  let admin: Awaited<ReturnType<typeof signIn>>;
  let sessionId = "";

  beforeAll(async () => {
    piloto = await signIn("piloto@gearhead.test");
    admin = await signIn("admin@gearhead.test");
    await sendFriendRequest(piloto.client, admin.userId);
    const req = (await listMyFriendships(admin.client)).find((f) => f.other_id === piloto.userId);
    if (req?.status === "pending" && req.incoming)
      await respondFriendRequest(admin.client, req.friendship_id, true);
  });

  afterAll(async () => {
    if (sessionId) await stopLocationSession(piloto.client, sessionId).catch(() => undefined);
    await clearPresence(admin.client);
    for (const f of await listMyFriendships(piloto.client)) {
      if (f.other_id === admin.userId) await removeFriendship(piloto.client, f.friendship_id);
    }
  });

  it("amigo vê a posição exata só enquanto a sessão está ativa", async () => {
    sessionId = await startLocationSession(piloto.client, {
      purpose: "convoy",
      minutes: 30,
      recipientIds: [admin.userId],
      note: "Teste",
    });
    expect((await getMyLocationSession(piloto.client))?.recipients.map((r) => r.id)).toEqual([
      admin.userId,
    ]);
    await updateSessionLocation(piloto.client, sessionId, {
      latitude: -25.4284,
      longitude: -49.2733,
      accuracy: 20,
    });

    const seen = (await listSharedWithMe(admin.client)).find((s) => s.session_id === sessionId)!;
    expect(seen).toMatchObject({
      latitude: -25.4284,
      longitude: -49.2733,
      username: "piloto_teste",
    });
    const anon = newClient() as GearheadClient;
    await expect(listSharedWithMe(anon)).rejects.toMatchObject({ code: "42501" });

    await stopLocationSession(piloto.client, sessionId);
    sessionId = "";
    expect(await listSharedWithMe(admin.client)).toEqual([]);
    expect(await getMyLocationSession(piloto.client)).toBeNull();
  });

  it("presença aproximada mostra só faixa de distância para amigos", async () => {
    await setPresence(admin.client, { latitude: -25.43, longitude: -49.27 }, 30);
    const near = await listNearbyFriends(piloto.client, { latitude: -25.44, longitude: -49.28 });
    const friend = near.find((n) => n.user_id === admin.userId)!;
    expect(friend.distance_band).toBe("até 5 km");
    expect(Object.keys(friend)).not.toContain("latitude");
    await clearPresence(admin.client);
    expect(
      (await listNearbyFriends(piloto.client, { latitude: -25.44, longitude: -49.28 })).length,
    ).toBe(0);
  });
});
