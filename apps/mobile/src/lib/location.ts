import { coarsenCoordinate } from "@gearhead/shared";
import * as Location from "expo-location";

export type LocateResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: "denied" | "unavailable" };

/**
 * Pede permissão (só quando o usuário toca em "usar minha localização") e devolve
 * a posição JÁ ARREDONDADA (~1 km). Precisão baixa basta para o radar e economiza
 * bateria. Nada é armazenado nem enviado além da consulta. Ver docs/SECURITY.md.
 */
export async function locateForRadar(): Promise<LocateResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { ok: false, reason: "denied" };
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const pos =
      last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return {
      ok: true,
      latitude: coarsenCoordinate(pos.coords.latitude),
      longitude: coarsenCoordinate(pos.coords.longitude),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
