/**
 * Integração com o Supabase LOCAL (API real). Roda via `npm run test:integration`.
 * Usa os usuários e parceiros fictícios de supabase/seed.sql. Nunca aponte para produção.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";
import { getBusiness } from "./partner-data";
import { searchNearby, setBusinessLocation } from "./radar";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

// Parceiros do seed (supabase/seed.sql).
const APPROVED = "33333333-3333-4333-8333-333333333331"; // Curitiba, aprovado
const PENDING = "33333333-3333-4333-8333-333333333332"; // Curitiba, pendente
const ORIGINAL = { latitude: -25.4284, longitude: -49.2733 };

function newClient() {
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string): Promise<GearheadClient> {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password: "Gearhead123" });
  if (error) throw error;
  return client;
}

describe.skipIf(!url || !key)("radar — integração com Supabase local", () => {
  let owner: GearheadClient;
  let other: GearheadClient;
  const anon = url && key ? newClient() : (null as unknown as GearheadClient);

  beforeAll(async () => {
    owner = await signIn("piloto@gearhead.test");
    other = await signIn("admin@gearhead.test");
  });

  afterAll(async () => {
    await setBusinessLocation(owner, APPROVED, ORIGINAL);
  });

  it("anônimo encontra o parceiro aprovado por raio, sem o pendente", async () => {
    const results = await searchNearby(anon, { latitude: -25.43, longitude: -49.27, radiusKm: 5 });
    const ids = results.map((r) => r.id);
    expect(ids).toContain(APPROVED);
    expect(ids).not.toContain(PENDING);
    const hit = results.find((r) => r.id === APPROVED)!;
    expect(hit.distance_m).toBeLessThan(1000);
    expect(hit.specialty_ids).toContain("injecao-eletronica");
  });

  it("raio pequeno longe do parceiro não o retorna", async () => {
    const results = await searchNearby(anon, { latitude: -23.55, longitude: -46.63, radiusKm: 2 });
    expect(results.map((r) => r.id)).not.toContain(APPROVED);
  });

  it("dono move o pin; outro usuário não consegue", async () => {
    await setBusinessLocation(owner, APPROVED, { latitude: -25.5, longitude: -49.3 });
    const moved = await getBusiness(anon, APPROVED);
    expect(moved).toMatchObject({ latitude: -25.5, longitude: -49.3 });

    await expect(
      setBusinessLocation(other, APPROVED, { latitude: -25.4, longitude: -49.2 }),
    ).rejects.toMatchObject({ code: "P0002" });
    await expect(
      setBusinessLocation(anon, APPROVED, { latitude: -25.4, longitude: -49.2 }),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("servidor rejeita raio fora do limite", async () => {
    await expect(
      searchNearby(anon, { latitude: -25.43, longitude: -49.27, radiusKm: 100 }),
    ).resolves.toBeInstanceOf(Array);
    // clampRadius impede >100 no cliente; chamando a RPC direto, o banco recusa.
    const { error } = await anon.rpc("search_nearby_businesses", {
      p_latitude: -25.43,
      p_longitude: -49.27,
      p_radius_km: 500,
    });
    expect(error?.code).toBe("GH001");
  });
});
