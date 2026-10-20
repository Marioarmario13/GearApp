"use client";

import {
  formatAge,
  formatRemaining,
  LOCATION_PURPOSE_LABELS,
  LOCATION_PURPOSES,
  LOCATION_UPDATE_INTERVAL_MS,
  PRESENCE_DURATIONS_MIN,
  SHARE_DURATIONS_MIN,
  type Friendship,
  type MyLocationSession,
  type NearbyFriend,
  type SharedLocation,
} from "@gearhead/shared";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  clearPresenceAction,
  nearbyFriendsAction,
  setPresenceAction,
  startShareAction,
  stopShareAction,
  updateShareAction,
} from "@/app/actions/social-gps";
import { FormMessage, SelectField, SubmitButton } from "@/components/form";
import { LazyMapView } from "@/components/map/lazy-map";
import type { FormState } from "@/lib/forms";

function getPosition(highAccuracy: boolean): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("sem geolocalização"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      maximumAge: 30_000,
      timeout: 20_000,
    });
  });
}

const PURPOSE_OPTIONS = LOCATION_PURPOSES.map((p) => ({
  value: p,
  label: LOCATION_PURPOSE_LABELS[p],
}));
const DURATION_OPTIONS = SHARE_DURATIONS_MIN.map((m) => ({
  value: String(m),
  label: m < 60 ? `${m} minutos` : `${m / 60} hora(s)`,
}));

export function LocationCenter({
  friends,
  session,
  shared,
}: {
  friends: Friendship[];
  session: MyLocationSession | null;
  shared: SharedLocation[];
}) {
  const router = useRouter();

  // Atualiza a lista de quem compartilha comigo a cada minuto (sem recarregar a página).
  useEffect(() => {
    const t = setInterval(() => router.refresh(), LOCATION_UPDATE_INTERVAL_MS);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex flex-col gap-8">
      {session ? <ActiveShare session={session} /> : <StartShare friends={friends} />}
      <SharedWithMe shared={shared} />
      <Presence />
    </div>
  );
}

function StartShare({ friends }: { friends: Friendship[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(startShareAction, {});
  const e = state.fieldErrors ?? {};
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Compartilhar minha localização</h2>
      {friends.length === 0 ? (
        <p className="text-muted">
          Você só pode compartilhar com amigos. Adicione amigos pelo perfil deles.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <FormMessage error={state.error} success={state.success} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Finalidade"
              name="purpose"
              options={PURPOSE_OPTIONS}
              defaultValue="meetup"
              errors={e.purpose}
            />
            <SelectField
              label="Por quanto tempo"
              name="minutes"
              options={DURATION_OPTIONS}
              defaultValue="60"
              errors={e.minutes}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Com quem (só amigos)</legend>
            {friends.map((f) => (
              <label key={f.other_id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recipientIds" value={f.other_id} />
                {f.display_name ?? "Sem nome"}{" "}
                {f.username && <span className="text-muted">@{f.username}</span>}
              </label>
            ))}
            {e.recipientIds && (
              <p className="text-sm text-red-600 dark:text-red-400">{e.recipientIds.join(" ")}</p>
            )}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Observação (opcional)</span>
            <input
              name="note"
              maxLength={120}
              className="rounded-lg border border-line bg-surface px-3 py-2"
            />
          </label>
          <p className="text-xs text-muted">
            Só os amigos escolhidos veem sua posição exata, até o prazo acabar ou você encerrar.
            Guardamos apenas a última posição, que é apagada ao final. Nada é enviado com a página
            fechada.
          </p>
          <div>
            <SubmitButton pendingText="Iniciando…">Iniciar compartilhamento</SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}

function ActiveShare({ session }: { session: MyLocationSession }) {
  const router = useRouter();
  const [status, setStatus] = useState<FormState>({});
  const [lastSent, setLastSent] = useState<string | null>(session.position_at);
  const [pending, start] = useTransition();
  const sending = useRef(false);

  const send = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      const pos = await getPosition(true);
      const result = await updateShareAction(session.id, {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      });
      setStatus(result);
      if (!result.error) setLastSent(new Date().toISOString());
    } catch {
      setStatus({
        error: "Não foi possível obter sua localização. Verifique a permissão do navegador.",
      });
    } finally {
      sending.current = false;
    }
  }, [session.id]);

  // Envia ao abrir e depois a cada minuto, só enquanto esta página estiver aberta.
  useEffect(() => {
    const first = setTimeout(() => void send(), 0);
    const t = setInterval(() => void send(), LOCATION_UPDATE_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [send]);

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border-2 border-accent bg-surface p-5"
      aria-live="polite"
    >
      <h2 className="text-xl font-semibold">Você está compartilhando sua localização</h2>
      <p className="text-sm">
        {LOCATION_PURPOSE_LABELS[session.purpose]}
        {session.purpose_note ? ` · ${session.purpose_note}` : ""} ·{" "}
        {formatRemaining(session.expires_at)}
      </p>
      <p className="text-sm text-muted">
        Com: {session.recipients.map((r) => r.display_name ?? r.username ?? "?").join(", ")} ·
        última posição enviada {formatAge(lastSent)}
      </p>
      <FormMessage error={status.error} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await stopShareAction(session.id);
              setStatus(r);
              router.refresh();
            })
          }
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "Encerrando…" : "Parar de compartilhar agora"}
        </button>
      </div>
    </section>
  );
}

function SharedWithMe({ shared }: { shared: SharedLocation[] }) {
  const withPos = shared.filter((s) => s.latitude !== null && s.longitude !== null);
  // Recalculado a cada atualização (uma por minuto): poucos marcadores.
  const markers = withPos.map((s) => ({
    id: s.session_id,
    latitude: s.latitude!,
    longitude: s.longitude!,
    label: `${s.display_name ?? s.username ?? "Amigo"} · ${formatAge(s.position_at)}`,
  }));

  const center = markers[0] ?? { latitude: -14.235, longitude: -51.9253 };
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">Compartilhando com você ({shared.length})</h2>
      {shared.length === 0 ? (
        <p className="text-muted">Nenhum amigo está compartilhando a localização com você agora.</p>
      ) : (
        <>
          {markers.length > 0 && (
            <LazyMapView
              ariaLabel="Mapa com amigos que compartilham localização com você"
              center={center}
              zoom={13}
              markers={markers}
              fitToMarkers
              className="h-80 w-full overflow-hidden rounded-xl border border-line"
            />
          )}
          <ul className="flex flex-col gap-2">
            {shared.map((s) => (
              <li
                key={s.session_id}
                className="rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <span className="font-semibold">{s.display_name ?? s.username}</span> ·{" "}
                {LOCATION_PURPOSE_LABELS[s.purpose]}
                {s.purpose_note ? ` (${s.purpose_note})` : ""} · posição {formatAge(s.position_at)}{" "}
                · {formatRemaining(s.expires_at)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Presence() {
  const [minutes, setMinutes] = useState<number>(60);
  const [status, setStatus] = useState<FormState>({});
  const [nearby, setNearby] = useState<NearbyFriend[] | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch {
        setStatus({
          error: "Não foi possível obter sua localização. Verifique a permissão do navegador.",
        });
      }
    });

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Amigos por perto</h2>
      <p className="text-sm text-muted">
        Opcional e temporário. Seus amigos veem apenas uma faixa de distância (ex.: “até 5 km”),
        nunca sua posição.
      </p>
      <FormMessage error={status.error} success={status.success} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Aparecer por</span>
          <select
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            {PRESENCE_DURATIONS_MIN.map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const p = await getPosition(false);
              setStatus(
                await setPresenceAction(
                  { latitude: p.coords.latitude, longitude: p.coords.longitude },
                  minutes,
                ),
              );
            })
          }
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Aparecer para amigos
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(async () => setStatus(await clearPresenceAction()))}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Parar de aparecer
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const p = await getPosition(false);
              const r = await nearbyFriendsAction({
                latitude: p.coords.latitude,
                longitude: p.coords.longitude,
              });
              if (r.error) setStatus({ error: r.error });
              setNearby(r.friends ?? []);
            })
          }
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          Ver amigos por perto
        </button>
      </div>
      {nearby !== null &&
        (nearby.length === 0 ? (
          <p className="text-sm text-muted">Nenhum amigo visível por perto agora.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {nearby.map((n) => (
              <li key={n.user_id}>
                <span className="font-medium">{n.display_name ?? n.username}</span> ·{" "}
                {n.distance_band}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
