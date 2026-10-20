import { z } from "zod";
import { fail, GearheadDataError, type GearheadClient } from "./data-core";
import { BRAZIL_STATES, type BrazilState } from "./profile";

/** Eventos e presença. Regras críticas ficam no banco (ver *_events_offers.sql). */

export const EVENT_KINDS = [
  "meetup",
  "exhibition",
  "cruise",
  "track_day",
  "workshop",
  "charity",
  "other",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  meetup: "Encontro",
  exhibition: "Exposição",
  cruise: "Passeio/comboio",
  track_day: "Track day (em autódromo)",
  workshop: "Palestra/oficina",
  charity: "Beneficente",
  other: "Outro",
};

/** Avisos de segurança exibidos no cadastro, conforme o tipo. */
export const EVENT_KIND_HINTS: Partial<Record<EventKind, string>> = {
  cruise: "Passeios seguem as leis de trânsito. Não organize disputas nem trechos de velocidade.",
  track_day:
    "Somente em autódromo ou kartódromo autorizado, com regras de segurança do local. Nunca em via pública.",
};

export type EventStatus = "scheduled" | "cancelled" | "removed";

export const EVENT_LIST_PAGE_SIZE = 20;
export const MAX_EVENT_DAYS = 7;

export interface GearEvent {
  id: string;
  organizer_id: string;
  business_id: string | null;
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  venue_name: string;
  street: string | null;
  street_number: string | null;
  district: string | null;
  city: string;
  state: BrazilState;
  latitude: number | null;
  longitude: number | null;
  capacity: number | null;
  attendee_count: number;
  status: EventStatus;
  status_note: string | null;
}

const EVENT_COLUMNS =
  "id, organizer_id, business_id, kind, title, description, starts_at, ends_at, venue_name, street, street_number, district, city, state, latitude, longitude, capacity, attendee_count, status, status_note";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .nullish()
    .transform((v) => (v ? v : null));

/** "2026-11-05T09:00" (datetime-local, horário de Brasília) ou ISO → Date. */
const dateTime = (message: string) =>
  z.preprocess(
    (v) => {
      if (typeof v !== "string" || !v.trim()) return undefined;
      const s = v.trim();
      // datetime-local não tem fuso: interpretamos como horário de Brasília (UTC−3).
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? new Date(`${s}:00-03:00`) : new Date(s);
    },
    z.date(message).refine((d) => !Number.isNaN(d.getTime()), message),
  );

export function eventInputSchema(now: Date = new Date()) {
  return z
    .object({
      kind: z.enum(EVENT_KINDS, "Escolha o tipo"),
      title: z
        .string()
        .trim()
        .min(3, "Mínimo de 3 caracteres")
        .max(120, "Máximo de 120 caracteres"),
      description: optionalText(2000),
      startsAt: dateTime("Informe data e hora de início"),
      endsAt: dateTime("Informe data e hora de término"),
      venueName: z.string().trim().min(2, "Informe o local").max(120, "Máximo de 120 caracteres"),
      street: optionalText(120),
      streetNumber: optionalText(20),
      district: optionalText(80),
      city: z.string().trim().min(1, "Informe a cidade").max(80, "Máximo de 80 caracteres"),
      state: z.enum(BRAZIL_STATES, "Escolha a UF"),
      capacity: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
        z.number().int("Número inteiro").min(1, "Mínimo 1").max(10000, "Máximo 10.000").nullable(),
      ),
      businessId: z
        .string()
        .nullish()
        .transform((v) => (v ? v : null)),
    })
    .refine((e) => e.startsAt > now, {
      message: "O evento precisa começar no futuro",
      path: ["startsAt"],
    })
    .refine((e) => e.endsAt > e.startsAt, {
      message: "O término deve ser depois do início",
      path: ["endsAt"],
    })
    .refine((e) => e.endsAt.getTime() - e.startsAt.getTime() <= MAX_EVENT_DAYS * 86_400_000, {
      message: `O evento pode durar no máximo ${MAX_EVENT_DAYS} dias`,
      path: ["endsAt"],
    });
}
export type EventInput = z.infer<ReturnType<typeof eventInputSchema>>;

function toEventRow(input: EventInput) {
  return {
    kind: input.kind,
    title: input.title,
    description: input.description,
    starts_at: input.startsAt.toISOString(),
    ends_at: input.endsAt.toISOString(),
    venue_name: input.venueName,
    street: input.street,
    street_number: input.streetNumber,
    district: input.district,
    city: input.city,
    state: input.state,
    capacity: input.capacity,
    business_id: input.businessId,
  };
}

export interface EventFilters {
  state?: BrazilState | null;
  city?: string | null;
  page?: number;
}

/** Próximos eventos agendados (não encerrados), paginados. */
export async function listUpcomingEvents(
  client: GearheadClient,
  filters: EventFilters = {},
  now: Date = new Date(),
): Promise<{ items: GearEvent[]; hasMore: boolean }> {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  let query = client
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "scheduled")
    .gt("ends_at", now.toISOString());
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.city?.trim()) {
    query = query.ilike("city", `%${filters.city.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const from = (page - 1) * EVENT_LIST_PAGE_SIZE;
  const { data, error } = await query
    .order("starts_at")
    .range(from, from + EVENT_LIST_PAGE_SIZE)
    .overrideTypes<GearEvent[], { merge: false }>();
  if (error) fail(error);
  return {
    items: data.slice(0, EVENT_LIST_PAGE_SIZE),
    hasMore: data.length > EVENT_LIST_PAGE_SIZE,
  };
}

export async function getEvent(client: GearheadClient, id: string): Promise<GearEvent | null> {
  const { data, error } = await client
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .maybeSingle()
    .overrideTypes<GearEvent | null, { merge: false }>();
  if (error) {
    if (error.code === "22P02") return null;
    fail(error);
  }
  return data;
}

/** Eventos organizados pelo usuário (todos os status visíveis a ele). */
export async function listMyEvents(client: GearheadClient, userId: string): Promise<GearEvent[]> {
  const { data, error } = await client
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("organizer_id", userId)
    .order("starts_at", { ascending: false })
    .limit(50)
    .overrideTypes<GearEvent[], { merge: false }>();
  if (error) fail(error);
  return data;
}

/** Eventos em que o usuário confirmou presença. */
export async function listMyRsvps(client: GearheadClient, userId: string): Promise<GearEvent[]> {
  const { data, error } = await client
    .from("event_attendees")
    .select(`event:events(${EVENT_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<{ event: GearEvent | null }[], { merge: false }>();
  if (error) fail(error);
  return data.flatMap((r) => (r.event ? [r.event] : []));
}

export async function isGoing(client: GearheadClient, eventId: string, userId: string) {
  const { data, error } = await client
    .from("event_attendees")
    .select("event_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail(error);
  return Boolean(data);
}

export async function createEvent(client: GearheadClient, input: EventInput): Promise<string> {
  const { data, error } = await client
    .from("events")
    .insert(toEventRow(input))
    .select("id")
    .single();
  if (error) fail(error);
  return data.id;
}

export async function updateEvent(client: GearheadClient, id: string, input: EventInput) {
  const { data, error } = await client
    .from("events")
    .update(toEventRow(input))
    .eq("id", id)
    .select("id");
  if (error) fail(error);
  if (data.length === 0)
    throw new GearheadDataError("not_found", "Evento não encontrado ou já cancelado.");
}

/** Confirma presença; devolve o novo total de confirmados. */
export async function rsvpEvent(client: GearheadClient, eventId: string): Promise<number> {
  const { data, error } = await client.rpc("rsvp_event", { p_event_id: eventId });
  if (error) fail(error);
  return data;
}

export async function leaveEvent(client: GearheadClient, eventId: string, userId: string) {
  const { error } = await client
    .from("event_attendees")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) fail(error);
}

export async function cancelEvent(client: GearheadClient, eventId: string, note: string | null) {
  const { error } = await client.rpc("cancel_event", {
    p_event_id: eventId,
    p_note: note ?? undefined,
  });
  if (error) fail(error);
}

export async function removeEvent(client: GearheadClient, eventId: string, note: string) {
  const { error } = await client.rpc("remove_event", { p_event_id: eventId, p_note: note });
  if (error) fail(error);
}

export async function setEventLocation(
  client: GearheadClient,
  eventId: string,
  location: { latitude: number; longitude: number } | null,
) {
  const { error } = await client.rpc("set_event_location", {
    p_event_id: eventId,
    p_latitude: location?.latitude,
    p_longitude: location?.longitude,
  });
  if (error) fail(error);
}

export interface EventAttendee {
  user_id: string;
  username: string | null;
  display_name: string | null;
  confirmed_at: string;
}

/** Lista de confirmados — só o organizador (ou admin) recebe dados. */
export async function getEventAttendees(
  client: GearheadClient,
  eventId: string,
): Promise<EventAttendee[]> {
  const { data, error } = await client.rpc("get_event_attendees", { p_event_id: eventId });
  if (error) fail(error);
  return data;
}

/** "sáb., 5 de nov. · 09:00–13:00" no fuso de Brasília. */
export function formatEventPeriod(startsAt: string, endsAt: string): string {
  const tz = "America/Sao_Paulo";
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const day = (d: Date) =>
    d.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: tz,
    });
  const time = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
  return day(start) === day(end)
    ? `${day(start)} · ${time(start)}–${time(end)}`
    : `${day(start)} ${time(start)} → ${day(end)} ${time(end)}`;
}

/** ISO → valor de <input type="datetime-local"> em horário de Brasília. */
export function toLocalInputValue(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export function spotsLeft(e: Pick<GearEvent, "capacity" | "attendee_count">): number | null {
  return e.capacity === null ? null : Math.max(e.capacity - e.attendee_count, 0);
}
