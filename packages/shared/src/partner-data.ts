import {
  fail,
  GearheadDataError,
  randomFileName,
  signStorageUrls,
  type GearheadClient,
} from "./data-core";
import {
  DOCUMENT_MIME_TYPES,
  MAX_CREDENTIALS_PER_BUSINESS,
  toBusinessRow,
  validateDocument,
  type BusinessInput,
  type BusinessKind,
  type BusinessStatus,
  type CredentialInput,
  type CredentialStatus,
  type CredentialType,
} from "./partner";
import type { BrazilState } from "./profile";

/** Acesso a dados de parceiros (ver data-core.ts para as regras gerais). */

export const BUSINESS_DOCUMENTS_BUCKET = "business-documents";
export const DIRECTORY_PAGE_SIZE = 20;

export interface Specialty {
  id: string;
  name: string;
}

/** Colunas públicas de um parceiro (sem nota de revisão). */
export interface Business {
  id: string;
  owner_id: string;
  kind: BusinessKind;
  name: string;
  description: string | null;
  phone: string | null;
  phone_is_whatsapp: boolean;
  email: string | null;
  website: string | null;
  street: string | null;
  street_number: string | null;
  district: string | null;
  city: string;
  state: BrazilState;
  postal_code: string | null;
  status: BusinessStatus;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  specialties: Specialty[];
}

/** Credencial como o público vê (sem caminho do documento nem nota). */
export interface PublicCredential {
  id: string;
  type: CredentialType;
  title: string;
  issuer: string | null;
  specialty_id: string | null;
  issued_on: string | null;
  expires_on: string | null;
  status: CredentialStatus;
  reviewed_at: string | null;
}

/** Credencial completa (dono ou admin, via RPC). */
export interface PrivateCredential extends PublicCredential {
  document_path: string;
  review_note: string | null;
  created_at: string;
}

export interface BusinessDetails extends Business {
  /** Para o público: só credenciais aprovadas (RLS). Dono/admin veem todas. */
  credentials: PublicCredential[];
}

export interface BusinessReview {
  status: BusinessStatus;
  review_note: string | null;
  reviewed_at: string | null;
}

const BUSINESS_COLUMNS =
  "id, owner_id, kind, name, description, phone, phone_is_whatsapp, email, website, street, street_number, district, city, state, postal_code, status, reviewed_at, created_at, updated_at, specialties:business_specialties(specialty:specialties(id, name))";

const CREDENTIAL_COLUMNS =
  "id, type, title, issuer, specialty_id, issued_on, expires_on, status, reviewed_at";

type BusinessRow = Omit<Business, "specialties"> & {
  specialties: { specialty: Specialty | null }[] | null;
};

function toBusiness(row: BusinessRow): Business {
  const specialties = (row.specialties ?? [])
    .flatMap((s) => (s.specialty ? [s.specialty] : []))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { ...row, specialties };
}

export async function listSpecialties(client: GearheadClient): Promise<Specialty[]> {
  const { data, error } = await client
    .from("specialties")
    .select("id, name")
    .order("sort")
    .order("name");
  if (error) fail(error);
  return data;
}

export interface DirectoryFilters {
  kind?: BusinessKind | null;
  specialty?: string | null;
  state?: BrazilState | null;
  city?: string | null;
  page?: number;
}

/** Diretório público: só parceiros aprovados (RLS), paginado. */
export async function listDirectory(
  client: GearheadClient,
  filters: DirectoryFilters = {},
): Promise<{ items: Business[]; hasMore: boolean }> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  // Filtrar por especialidade: segunda junção (!inner) só para restringir os parceiros,
  // mantendo a lista completa de especialidades em `specialties`.
  const columns = filters.specialty
    ? `${BUSINESS_COLUMNS}, match:business_specialties!inner(specialty_id)`
    : BUSINESS_COLUMNS;

  let query = client.from("businesses").select(columns).eq("status", "approved");
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.city?.trim()) {
    // Escapa curingas do ILIKE digitados pelo usuário.
    const city = filters.city.trim().replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike("city", `%${city}%`);
  }
  if (filters.specialty) query = query.eq("match.specialty_id", filters.specialty);

  const from = (page - 1) * DIRECTORY_PAGE_SIZE;
  // Pede um a mais para saber se há próxima página sem contar a tabela inteira.
  const { data, error } = await query
    .order("name")
    .range(from, from + DIRECTORY_PAGE_SIZE)
    .overrideTypes<(BusinessRow & { match?: unknown })[], { merge: false }>();
  if (error) fail(error);
  const items = data.slice(0, DIRECTORY_PAGE_SIZE).map(({ match, ...row }) => toBusiness(row));
  return { items, hasMore: data.length > DIRECTORY_PAGE_SIZE };
}

/** null se não existe ou não é visível para quem consulta (RLS). */
export async function getBusiness(
  client: GearheadClient,
  id: string,
): Promise<BusinessDetails | null> {
  const { data, error } = await client
    .from("businesses")
    .select(`${BUSINESS_COLUMNS}, credentials(${CREDENTIAL_COLUMNS})`)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<
      (BusinessRow & { credentials: PublicCredential[] | null }) | null,
      { merge: false }
    >();
  if (error) {
    if (error.code === "22P02") return null;
    fail(error);
  }
  if (!data) return null;
  const { credentials, ...row } = data;
  return { ...toBusiness(row), credentials: credentials ?? [] };
}

export async function listMyBusinesses(
  client: GearheadClient,
  ownerId: string,
): Promise<Business[]> {
  const { data, error } = await client
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .overrideTypes<BusinessRow[], { merge: false }>();
  if (error) fail(error);
  return data.map(toBusiness);
}

/** Sincroniza as especialidades (remove as desmarcadas, insere as novas). */
async function setSpecialties(client: GearheadClient, businessId: string, wanted: string[]) {
  const { data: current, error } = await client
    .from("business_specialties")
    .select("specialty_id")
    .eq("business_id", businessId);
  if (error) fail(error);
  const have = new Set(current.map((r) => r.specialty_id));
  const want = new Set(wanted);
  const toRemove = [...have].filter((s) => !want.has(s));
  const toAdd = [...want].filter((s) => !have.has(s));

  if (toRemove.length > 0) {
    const res = await client
      .from("business_specialties")
      .delete()
      .eq("business_id", businessId)
      .in("specialty_id", toRemove);
    if (res.error) fail(res.error);
  }
  if (toAdd.length > 0) {
    const res = await client
      .from("business_specialties")
      .insert(toAdd.map((specialty_id) => ({ business_id: businessId, specialty_id })));
    if (res.error) fail(res.error);
  }
}

export async function createBusiness(
  client: GearheadClient,
  input: BusinessInput,
): Promise<string> {
  const { data, error } = await client
    .from("businesses")
    .insert(toBusinessRow(input))
    .select("id")
    .single();
  if (error) fail(error);
  try {
    await setSpecialties(client, data.id, input.specialties);
  } catch (e) {
    await client.from("businesses").delete().eq("id", data.id);
    throw e;
  }
  return data.id;
}

export async function updateBusiness(
  client: GearheadClient,
  id: string,
  input: BusinessInput,
): Promise<void> {
  const { data, error } = await client
    .from("businesses")
    .update(toBusinessRow(input))
    .eq("id", id)
    .select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Parceiro não encontrado.");
  await setSpecialties(client, id, input.specialties);
}

/** Situação da revisão com a nota (dono ou admin). null para terceiros. */
export async function getBusinessReview(
  client: GearheadClient,
  businessId: string,
): Promise<BusinessReview | null> {
  const { data, error } = await client.rpc("get_business_review", { p_business_id: businessId });
  if (error) fail(error);
  return data[0] ?? null;
}

/** Credenciais com documento e nota (dono ou admin). Vazio para terceiros. */
export async function getPrivateCredentials(
  client: GearheadClient,
  businessId: string,
): Promise<PrivateCredential[]> {
  const { data, error } = await client.rpc("get_business_credentials", {
    p_business_id: businessId,
  });
  if (error) fail(error);
  return data;
}

/**
 * Apaga o parceiro (credenciais e especialidades saem em cascata) e depois os
 * arquivos — a policy do Storage só libera documentos sem credencial aprovada.
 */
export async function deleteBusiness(client: GearheadClient, id: string): Promise<void> {
  const docs = await getPrivateCredentials(client, id);
  const { data, error } = await client.from("businesses").delete().eq("id", id).select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Parceiro não encontrado.");
  if (docs.length > 0) {
    // Falha aqui deixa só arquivos órfãos, invisíveis a terceiros (limpeza na Etapa 9).
    await client.storage.from(BUSINESS_DOCUMENTS_BUCKET).remove(docs.map((d) => d.document_path));
  }
}

export async function uploadCredential(
  client: GearheadClient,
  params: {
    ownerId: string;
    businessId: string;
    input: CredentialInput;
    body: ArrayBuffer | Blob;
    contentType: string;
  },
): Promise<string> {
  const size = params.body instanceof ArrayBuffer ? params.body.byteLength : params.body.size;
  const problem = validateDocument({ type: params.contentType, size });
  if (problem) throw new GearheadDataError("invalid_file", problem);

  const existing = await getPrivateCredentials(client, params.businessId);
  if (existing.length >= MAX_CREDENTIALS_PER_BUSINESS) {
    throw new GearheadDataError(
      "invalid_file",
      `Limite de ${MAX_CREDENTIALS_PER_BUSINESS} documentos por parceiro atingido.`,
    );
  }

  const ext = DOCUMENT_MIME_TYPES[params.contentType as keyof typeof DOCUMENT_MIME_TYPES];
  const path = `${params.ownerId}/${params.businessId}/${randomFileName()}.${ext}`;
  const bucket = client.storage.from(BUSINESS_DOCUMENTS_BUCKET);
  const upload = await bucket.upload(path, params.body, {
    contentType: params.contentType,
    upsert: false,
  });
  if (upload.error) fail({ code: "storage_error", message: upload.error.message });

  const { input } = params;
  const { data, error } = await client
    .from("credentials")
    .insert({
      business_id: params.businessId,
      type: input.type,
      title: input.title,
      issuer: input.issuer,
      specialty_id: input.specialtyId,
      issued_on: input.issuedOn,
      expires_on: input.expiresOn,
      document_path: path,
    })
    .select("id")
    .single();
  if (error) {
    await bucket.remove([path]);
    fail(error);
  }
  return data.id;
}

/** Remove a credencial; o arquivo só é apagado se não for evidência de aprovação. */
export async function deleteCredential(client: GearheadClient, credential: PrivateCredential) {
  const { data, error } = await client
    .from("credentials")
    .delete()
    .eq("id", credential.id)
    .select("id");
  if (error) fail(error);
  if (data.length === 0) throw new GearheadDataError("not_found", "Documento não encontrado.");
  await client.storage.from(BUSINESS_DOCUMENTS_BUCKET).remove([credential.document_path]);
}

/** URLs assinadas curtas (5 min) para documentos (dono ou admin). */
export async function signDocumentUrls(
  client: GearheadClient,
  paths: string[],
): Promise<Record<string, string>> {
  return signStorageUrls(client, BUSINESS_DOCUMENTS_BUCKET, paths, 300);
}

// ---------------------------------------------------------------------------
// Administração (as RPCs verificam o papel de admin no banco)
// ---------------------------------------------------------------------------

export interface ReviewQueue {
  /** Parceiros aguardando aprovação. */
  businesses: Business[];
  /** Ids de parceiros (de qualquer status) com documentos aguardando conferência. */
  businessIdsWithPendingCredentials: string[];
}

export async function getReviewQueue(client: GearheadClient): Promise<ReviewQueue> {
  const [pending, creds] = await Promise.all([
    client
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .eq("status", "pending")
      .order("created_at")
      .limit(100)
      .overrideTypes<BusinessRow[], { merge: false }>(),
    client.from("credentials").select("business_id").eq("status", "pending").limit(500),
  ]);
  if (pending.error) fail(pending.error);
  if (creds.error) fail(creds.error);
  return {
    businesses: pending.data.map(toBusiness),
    businessIdsWithPendingCredentials: [...new Set(creds.data.map((c) => c.business_id))],
  };
}

export async function listBusinessesByIds(
  client: GearheadClient,
  ids: string[],
): Promise<Business[]> {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .in("id", ids.slice(0, 100))
    .order("name")
    .overrideTypes<BusinessRow[], { merge: false }>();
  if (error) fail(error);
  return data.map(toBusiness);
}

export async function reviewCredential(
  client: GearheadClient,
  credentialId: string,
  decision: Exclude<CredentialStatus, "pending">,
  note: string | null,
) {
  const { error } = await client.rpc("review_credential", {
    p_credential_id: credentialId,
    p_decision: decision,
    p_note: note ?? undefined,
  });
  if (error) fail(error);
}

export async function reviewBusiness(
  client: GearheadClient,
  businessId: string,
  decision: Exclude<BusinessStatus, "pending">,
  note: string | null,
) {
  const { error } = await client.rpc("review_business", {
    p_business_id: businessId,
    p_decision: decision,
    p_note: note ?? undefined,
  });
  if (error) fail(error);
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: unknown;
  created_at: string;
}

/** Histórico de auditoria de uma entidade (somente admin — RLS). */
export async function listAuditLog(
  client: GearheadClient,
  entityIds: string[],
): Promise<AuditEntry[]> {
  if (entityIds.length === 0) return [];
  const { data, error } = await client
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, details, created_at")
    .in("entity_id", entityIds)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail(error);
  return data;
}
