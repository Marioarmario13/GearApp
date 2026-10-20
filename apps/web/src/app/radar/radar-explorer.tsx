"use client";

import {
  BRAZIL_CENTER,
  BUSINESS_KIND_LABELS,
  BUSINESS_KINDS,
  coarsenCoordinate,
  DEFAULT_RADIUS_KM,
  formatDistance,
  RADIUS_OPTIONS_KM,
  type BusinessKind,
  type RadarResult,
  type Specialty,
} from "@gearhead/shared";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { searchRadarAction } from "@/app/actions/radar";
import { FormMessage } from "@/components/form";
import { LazyMapView } from "@/components/map/lazy-map";

interface Point {
  latitude: number;
  longitude: number;
}

/** Zoom que enquadra aproximadamente o raio escolhido. */
const zoomForRadius = (km: number) => Math.max(5, Math.min(14, 14.2 - Math.log2(km) * 1.05));

export function RadarExplorer({ specialties }: { specialties: Specialty[] }) {
  const [origin, setOrigin] = useState<Point | null>(null);
  const [mapCenter, setMapCenter] = useState<Point>(BRAZIL_CENTER);
  const [view, setView] = useState<Point & { zoom: number }>({ ...BRAZIL_CENTER });
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  const [kind, setKind] = useState<BusinessKind | "">("");
  const [specialty, setSpecialty] = useState("");
  const [results, setResults] = useState<RadarResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const specialtyName = useMemo(
    () => Object.fromEntries(specialties.map((s) => [s.id, s.name])),
    [specialties],
  );

  function search(
    point: Point,
    overrides: { radiusKm?: number; kind?: string; specialty?: string } = {},
  ) {
    // Privacidade: a posição sai daqui arredondada para ~1 km.
    const p = {
      latitude: coarsenCoordinate(point.latitude),
      longitude: coarsenCoordinate(point.longitude),
    };
    const r = overrides.radiusKm ?? radiusKm;
    setOrigin(p);
    setView({ ...p, zoom: zoomForRadius(r) });
    setError(null);
    startTransition(async () => {
      const res = await searchRadarAction({
        ...p,
        radiusKm: r,
        kind: (overrides.kind ?? kind) || null,
        specialty: (overrides.specialty ?? specialty) || null,
      });
      if ("error" in res) {
        setError(res.error);
        setResults(null);
      } else {
        setResults(res.results);
      }
    });
  }

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setError("Seu navegador não oferece localização. Use o centro do mapa.");
      return;
    }
    setStatus("Obtendo sua localização…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus(null);
        search({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        setStatus(null);
        setError("Não foi possível obter sua localização. Você pode buscar pelo centro do mapa.");
      },
      // Precisão baixa basta (e economiza bateria); posição em cache de até 5 min.
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 },
    );
  }

  // Refaz a busca ao mudar filtros, se já houver uma origem.
  function changeFilter(next: { radiusKm?: number; kind?: string; specialty?: string }) {
    if (next.radiusKm !== undefined) setRadiusKm(next.radiusKm);
    if (next.kind !== undefined) setKind(next.kind as BusinessKind | "");
    if (next.specialty !== undefined) setSpecialty(next.specialty);
    if (origin) search(origin, next);
  }

  const markers = useMemo(
    () =>
      (results ?? []).map((r) => ({
        id: r.id,
        latitude: r.latitude,
        longitude: r.longitude,
        label: r.name,
        href: `/parceiros/${r.id}`,
      })),
    [results],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Raio</span>
          <select
            value={radiusKm}
            onChange={(e) => changeFilter({ radiusKm: Number(e.target.value) })}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            {RADIUS_OPTIONS_KM.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tipo</span>
          <select
            value={kind}
            onChange={(e) => changeFilter({ kind: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">Todos</option>
            {BUSINESS_KINDS.map((k) => (
              <option key={k} value={k}>
                {BUSINESS_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Especialidade</span>
          <select
            value={specialty}
            onChange={(e) => changeFilter({ specialty: e.target.value })}
            className="rounded-lg border border-line bg-surface px-3 py-2"
          >
            <option value="">Todas</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={locateMe}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Usar minha localização
        </button>
        <button
          type="button"
          onClick={() => search(mapCenter)}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface"
        >
          Buscar no centro do mapa
        </button>
      </div>
      <p className="text-xs text-muted">
        Sua localização só é usada para esta busca, sai do aparelho arredondada (~1 km) e não é
        armazenada.
      </p>

      {status && (
        <p role="status" className="text-sm text-muted">
          {status}
        </p>
      )}
      <FormMessage error={error ?? undefined} />

      <LazyMapView
        ariaLabel="Mapa do radar de parceiros"
        center={view}
        zoom={view.zoom}
        markers={markers}
        radius={origin ? { ...origin, km: radiusKm } : null}
        onMoveEnd={(c) => setMapCenter({ latitude: c.latitude, longitude: c.longitude })}
        className="h-[28rem] w-full overflow-hidden rounded-2xl border border-line"
      />

      <section aria-labelledby="resultados" aria-busy={pending} className="flex flex-col gap-3">
        <h2 id="resultados" className="text-xl font-semibold">
          {pending
            ? "Buscando…"
            : results === null
              ? "Escolha um ponto para buscar"
              : `${results.length} parceiro(s) em até ${radiusKm} km`}
        </h2>
        {results !== null && results.length === 0 && !pending && (
          <p className="text-muted">
            Nenhum parceiro verificado nesse raio. Aumente o raio ou{" "}
            <Link href="/parceiros" className="text-accent hover:underline">
              veja o diretório por cidade
            </Link>
            .
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {(results ?? []).map((r) => (
            <li key={r.id}>
              <Link
                href={`/parceiros/${r.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-line bg-surface p-4 hover:border-accent"
              >
                <span>
                  <span className="font-semibold">✓ {r.name}</span>
                  <span className="block text-sm text-muted">
                    {BUSINESS_KIND_LABELS[r.kind]} · {r.city}/{r.state}
                    {r.specialty_ids.length > 0 &&
                      ` · ${r.specialty_ids.map((id) => specialtyName[id] ?? id).join(", ")}`}
                  </span>
                </span>
                <span className="text-sm font-medium">{formatDistance(r.distance_m)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
