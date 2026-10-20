/**
 * Integração com o Supabase LOCAL (API + Storage reais). Roda via `npm run test:integration`.
 * Usa os usuários fictícios de supabase/seed.sql. Nunca aponte para produção.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { GearheadClient } from "./data-core";
import type { Database } from "./database.types";
import { businessInputSchema, credentialInputSchema } from "./partner";
import {
  BUSINESS_DOCUMENTS_BUCKET,
  createBusiness,
  deleteBusiness,
  deleteCredential,
  getBusiness,
  getBusinessReview,
  getPrivateCredentials,
  getReviewQueue,
  listAuditLog,
  listDirectory,
  listSpecialties,
  reviewBusiness,
  reviewCredential,
  signDocumentUrls,
  updateBusiness,
  uploadCredential,
} from "./partner-data";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const SEED_PASSWORD = "Gearhead123";

// PDF mínimo válido.
const PDF = new TextEncoder().encode(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
).buffer as ArrayBuffer;

function newClient() {
  return createClient<Database>(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string): Promise<{ client: GearheadClient; userId: string }> {
  const client = newClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw error;
  return { client, userId: data.user.id };
}

const business = (overrides: Record<string, unknown> = {}) =>
  businessInputSchema.parse({
    kind: "tuner",
    name: "Preparadora Integração",
    city: "Florianópolis",
    state: "SC",
    phone: "48999990000",
    phoneIsWhatsapp: true,
    specialties: ["preparacao-motor", "remap"],
    ...overrides,
  });

describe.skipIf(!url || !key)("parceiros — integração com Supabase local", () => {
  let owner: Awaited<ReturnType<typeof signIn>>;
  let admin: Awaited<ReturnType<typeof signIn>>;
  let anon: GearheadClient;
  let businessId = "";

  beforeAll(async () => {
    owner = await signIn("piloto@gearhead.test");
    admin = await signIn("admin@gearhead.test");
    anon = newClient();
  });

  afterAll(async () => {
    if (businessId && (await getBusiness(owner.client, businessId))) {
      await deleteBusiness(owner.client, businessId);
    }
  });

  it("lista especialidades e o diretório público para anônimos", async () => {
    expect((await listSpecialties(anon)).length).toBeGreaterThanOrEqual(18);
    const { items } = await listDirectory(anon, { state: "PR" });
    expect(items.map((b) => b.name)).toContain("Oficina Exemplo Turbo");
    expect(items.every((b) => b.status === "approved")).toBe(true);
  });

  it("cadastra parceiro pendente, invisível no diretório", async () => {
    businessId = await createBusiness(owner.client, business());
    const mine = await getBusiness(owner.client, businessId);
    expect(mine).toMatchObject({ status: "pending", name: "Preparadora Integração" });
    expect(mine!.specialties.map((s) => s.id).sort()).toEqual(["preparacao-motor", "remap"]);

    expect(await getBusiness(anon, businessId)).toBeNull();
    const { items } = await listDirectory(anon, { state: "SC" });
    expect(items.map((b) => b.id)).not.toContain(businessId);
  });

  it("envia documentos privados; só dono e admin acessam o arquivo", async () => {
    await uploadCredential(owner.client, {
      ownerId: owner.userId,
      businessId,
      input: credentialInputSchema.parse({ type: "business_registration", title: "CNPJ teste" }),
      body: PDF,
      contentType: "application/pdf",
    });
    await uploadCredential(owner.client, {
      ownerId: owner.userId,
      businessId,
      input: credentialInputSchema.parse({ type: "certification", title: "Curso remap" }),
      body: PDF,
      contentType: "application/pdf",
    });
    const docs = await getPrivateCredentials(owner.client, businessId);
    expect(docs).toHaveLength(2);

    const ownerUrls = await signDocumentUrls(owner.client, [docs[0]!.document_path]);
    expect((await fetch(ownerUrls[docs[0]!.document_path]!)).status).toBe(200);
    const adminUrls = await signDocumentUrls(admin.client, [docs[0]!.document_path]);
    expect((await fetch(adminUrls[docs[0]!.document_path]!)).status).toBe(200);

    // Outro usuário (anônimo aqui) não assina nem baixa.
    expect(await signDocumentUrls(anon, [docs[0]!.document_path])).toEqual({});
    const direct = await anon.storage
      .from(BUSINESS_DOCUMENTS_BUCKET)
      .download(docs[0]!.document_path);
    expect(direct.error).not.toBeNull();
  });

  it("bucket rejeita tipo não permitido", async () => {
    const bad = await owner.client.storage
      .from(BUSINESS_DOCUMENTS_BUCKET)
      .upload(`${owner.userId}/${businessId}/x.zip`, PDF, { contentType: "application/zip" });
    expect(bad.error).not.toBeNull();
  });

  it("aparece na fila do admin; aprovar sem registro conferido é bloqueado", async () => {
    const queue = await getReviewQueue(admin.client);
    expect(queue.businesses.map((b) => b.id)).toContain(businessId);
    expect(queue.businessIdsWithPendingCredentials).toContain(businessId);

    await expect(reviewBusiness(admin.client, businessId, "approved", null)).rejects.toMatchObject({
      code: "GH001",
    });
    // Dono também não consegue aprovar.
    await expect(reviewBusiness(owner.client, businessId, "approved", null)).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("admin confere o registro, aprova o parceiro e a auditoria registra", async () => {
    const docs = await getPrivateCredentials(admin.client, businessId);
    const reg = docs.find((d) => d.type === "business_registration")!;
    const cert = docs.find((d) => d.type === "certification")!;
    await reviewCredential(admin.client, reg.id, "approved", null);
    await reviewCredential(admin.client, cert.id, "rejected", "Certificado ilegível");
    await reviewBusiness(admin.client, businessId, "approved", "Conferido");

    const publicView = await getBusiness(anon, businessId);
    expect(publicView).toMatchObject({ status: "approved" });
    expect(publicView!.credentials.map((c) => c.title)).toEqual(["CNPJ teste"]);

    const { items } = await listDirectory(anon, { specialty: "remap", state: "SC" });
    expect(items.map((b) => b.id)).toContain(businessId);
    expect(items.find((b) => b.id === businessId)!.specialties).toHaveLength(2);

    const ownerDocs = await getPrivateCredentials(owner.client, businessId);
    expect(ownerDocs.find((d) => d.id === cert.id)!.review_note).toBe("Certificado ilegível");

    const audit = await listAuditLog(admin.client, [businessId, reg.id, cert.id]);
    expect(audit.map((a) => a.action).sort()).toEqual([
      "business.approved",
      "credential.approved",
      "credential.rejected",
    ]);
    expect(await listAuditLog(owner.client, [businessId])).toEqual([]);
  });

  it("dono não apaga o arquivo de um documento aprovado", async () => {
    const reg = (await getPrivateCredentials(owner.client, businessId)).find(
      (d) => d.status === "approved",
    )!;
    const { data } = await owner.client.storage
      .from(BUSINESS_DOCUMENTS_BUCKET)
      .remove([reg.document_path]);
    expect(data ?? []).toHaveLength(0);
    const urls = await signDocumentUrls(admin.client, [reg.document_path]);
    expect((await fetch(urls[reg.document_path]!)).status).toBe(200);
  });

  it("renomear volta para conferência e sai do diretório", async () => {
    await updateBusiness(owner.client, businessId, business({ name: "Preparadora Renomeada" }));
    const review = await getBusinessReview(owner.client, businessId);
    expect(review).toMatchObject({ status: "pending" });
    expect(review!.review_note).toContain("aguardando nova conferência");
    expect(await getBusiness(anon, businessId)).toBeNull();
  });

  it("dono remove documento recusado e exclui o parceiro com os arquivos", async () => {
    const rejected = (await getPrivateCredentials(owner.client, businessId)).find(
      (d) => d.status === "rejected",
    )!;
    await deleteCredential(owner.client, rejected);
    expect(await getPrivateCredentials(owner.client, businessId)).toHaveLength(1);

    await deleteBusiness(owner.client, businessId);
    expect(await getBusiness(owner.client, businessId)).toBeNull();
    const { data } = await owner.client.storage
      .from(BUSINESS_DOCUMENTS_BUCKET)
      .list(`${owner.userId}/${businessId}`);
    expect(data ?? []).toHaveLength(0);
    businessId = "";
  });
});
