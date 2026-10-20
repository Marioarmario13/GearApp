import {
  clearPresence,
  coarsenCoordinate,
  dataErrorMessage,
  formatAge,
  formatRemaining,
  getMyLocationSession,
  listMyFriendships,
  listNearbyFriends,
  listSharedWithMe,
  LOCATION_PURPOSE_LABELS,
  LOCATION_PURPOSES,
  LOCATION_UPDATE_INTERVAL_MS,
  setPresence,
  SHARE_DURATIONS_MIN,
  startLocationSession,
  stopLocationSession,
  updateSessionLocation,
  type Friendship,
  type LocationPurpose,
  type MyLocationSession,
  type NearbyFriend,
  type SharedLocation,
} from "@gearhead/shared";
import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MapWebView } from "@/components/MapWebView";
import { Button, Card, colors, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

interface Data {
  friends: Friendship[];
  session: MyLocationSession | null;
  shared: SharedLocation[];
}

async function foregroundPermission(): Promise<boolean> {
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

export function LocationScreen() {
  const [data, setData] = useState<Data | null>(null);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        listMyFriendships(supabase),
        getMyLocationSession(supabase),
        listSharedWithMe(supabase),
      ])
        .then(([links, session, shared]) => {
          if (active)
            setData({ friends: links.filter((f) => f.status === "accepted"), session, shared });
        })
        .catch((e: unknown) => active && setMessage({ error: dataErrorMessage(e) }));
    void load();
    // Atualiza quem compartilha comigo a cada minuto, só com a tela aberta.
    const t = setInterval(() => void load(), LOCATION_UPDATE_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [reload]);

  const refresh = useCallback(() => setReload((n) => n + 1), []);

  if (!data) {
    return message.error ? (
      <Message error={message.error} />
    ) : (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando"
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.muted}>
        Desligada por padrão. Você escolhe com quem e por quanto tempo, e pode parar a qualquer
        momento. Nada é enviado com o app fechado.
      </Text>
      <Message error={message.error} success={message.success} />
      {data.session ? (
        <ActiveShare session={data.session} onStopped={refresh} onMessage={setMessage} />
      ) : (
        <StartShare friends={data.friends} onStarted={refresh} onMessage={setMessage} />
      )}
      <SharedWithMe shared={data.shared} />
      <Presence onMessage={setMessage} />
    </ScrollView>
  );
}

type OnMessage = (m: { error?: string; success?: string }) => void;

function StartShare({
  friends,
  onStarted,
  onMessage,
}: {
  friends: Friendship[];
  onStarted: () => void;
  onMessage: OnMessage;
}) {
  const [purpose, setPurpose] = useState<LocationPurpose>("meetup");
  const [minutes, setMinutes] = useState(60);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      if (!(await foregroundPermission())) {
        onMessage({ error: "Sem permissão de localização. Ative nas configurações do aparelho." });
        return;
      }
      await startLocationSession(supabase, {
        purpose,
        minutes,
        recipientIds: selected,
        note: null,
      });
      onMessage({ success: "Compartilhamento iniciado." });
      onStarted();
    } catch (e) {
      onMessage({ error: dataErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>
        Compartilhar minha localização
      </Text>
      {friends.length === 0 ? (
        <Text style={styles.muted}>Você só pode compartilhar com amigos.</Text>
      ) : (
        <>
          <Chips
            value={purpose}
            onChange={setPurpose}
            options={LOCATION_PURPOSES.map((p) => ({
              value: p,
              label: LOCATION_PURPOSE_LABELS[p],
            }))}
          />
          <Chips
            value={minutes}
            onChange={setMinutes}
            options={SHARE_DURATIONS_MIN.map((m) => ({
              value: m as number,
              label: m < 60 ? `${m} min` : `${m / 60} h`,
            }))}
          />
          <Text style={styles.label}>Com quem</Text>
          {friends.map((f) => {
            const on = selected.includes(f.other_id);
            return (
              <Pressable
                key={f.other_id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() =>
                  setSelected((s) => (on ? s.filter((x) => x !== f.other_id) : [...s, f.other_id]))
                }
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={{ color: on ? "#fff" : colors.text }}>
                  {f.display_name ?? f.username}
                </Text>
              </Pressable>
            );
          })}
          <Button onPress={() => void start()} loading={busy}>
            Iniciar compartilhamento
          </Button>
        </>
      )}
    </Card>
  );
}

function ActiveShare({
  session,
  onStopped,
  onMessage,
}: {
  session: MyLocationSession;
  onStopped: () => void;
  onMessage: OnMessage;
}) {
  const [lastSent, setLastSent] = useState<string | null>(session.position_at);

  // Posição em primeiro plano, no máximo a cada 60 s; para ao sair da tela.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    void (async () => {
      if (!(await foregroundPermission()) || cancelled) return;
      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL_MS,
          distanceInterval: 25,
        },
        (pos) => {
          void updateSessionLocation(supabase, session.id, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
            .then(() => setLastSent(new Date().toISOString()))
            .catch((e: unknown) => onMessage({ error: dataErrorMessage(e) }));
        },
      );
      if (cancelled) sub.remove();
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [session.id, onMessage]);

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>
        Você está compartilhando
      </Text>
      <Text style={styles.text}>
        {LOCATION_PURPOSE_LABELS[session.purpose]} · {formatRemaining(session.expires_at)}
      </Text>
      <Text style={styles.muted}>
        Com: {session.recipients.map((r) => r.display_name ?? r.username).join(", ")} · última
        posição {formatAge(lastSent)}
      </Text>
      <Button
        variant="secondary"
        onPress={() =>
          void stopLocationSession(supabase, session.id)
            .then(() => {
              onMessage({ success: "Compartilhamento encerrado. Sua posição foi apagada." });
              onStopped();
            })
            .catch((e: unknown) => onMessage({ error: dataErrorMessage(e) }))
        }
      >
        Parar de compartilhar agora
      </Button>
    </Card>
  );
}

function SharedWithMe({ shared }: { shared: SharedLocation[] }) {
  const withPos = shared.filter((s) => s.latitude !== null && s.longitude !== null);
  return (
    <View style={{ gap: 8 }}>
      <Text accessibilityRole="header" style={styles.section}>
        Compartilhando com você ({shared.length})
      </Text>
      {shared.length === 0 && (
        <Text style={styles.muted}>Ninguém está compartilhando com você agora.</Text>
      )}
      {withPos[0] && (
        <MapWebView
          accessibilityLabel="Mapa com amigos que compartilham localização com você"
          state={{
            center: { latitude: withPos[0].latitude!, longitude: withPos[0].longitude! },
            zoom: 13,
            markers: withPos.map((s) => ({
              id: s.session_id,
              latitude: s.latitude!,
              longitude: s.longitude!,
            })),
          }}
        />
      )}
      {shared.map((s) => (
        <Text key={s.session_id} style={styles.text}>
          {s.display_name ?? s.username} · {LOCATION_PURPOSE_LABELS[s.purpose]} · posição{" "}
          {formatAge(s.position_at)}
        </Text>
      ))}
    </View>
  );
}

function Presence({ onMessage }: { onMessage: OnMessage }) {
  const [nearby, setNearby] = useState<NearbyFriend[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function coarsePosition() {
    if (!(await foregroundPermission())) throw new Error("permissão");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    return {
      latitude: coarsenCoordinate(pos.coords.latitude),
      longitude: coarsenCoordinate(pos.coords.longitude),
    };
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onMessage({
        error:
          e instanceof Error && e.message === "permissão"
            ? "Sem permissão de localização."
            : dataErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text accessibilityRole="header" style={styles.section}>
        Amigos por perto
      </Text>
      <Text style={styles.muted}>
        Seus amigos veem só uma faixa de distância, nunca sua posição.
      </Text>
      <Button
        loading={busy}
        onPress={() =>
          void run(async () => {
            await setPresence(supabase, await coarsePosition(), 60);
            onMessage({ success: "Você aparece para amigos por perto por 1 hora." });
          })
        }
      >
        Aparecer por 1 hora
      </Button>
      <Button
        variant="secondary"
        onPress={() =>
          void run(async () => setNearby(await listNearbyFriends(supabase, await coarsePosition())))
        }
      >
        Ver amigos por perto
      </Button>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          void run(async () => {
            await clearPresence(supabase);
            onMessage({ success: "Você não aparece mais." });
          })
        }
      >
        <Text style={styles.muted}>Parar de aparecer</Text>
      </Pressable>
      {nearby?.length === 0 && <Text style={styles.muted}>Nenhum amigo visível por perto.</Text>}
      {nearby?.map((n) => (
        <Text key={n.user_id} style={styles.text}>
          {n.display_name ?? n.username} · {n.distance_band}
        </Text>
      ))}
    </Card>
  );
}

function Chips<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Pressable
          key={String(o.value)}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.chip, o.value === value && styles.optionOn]}
        >
          <Text style={{ color: o.value === value ? "#fff" : colors.text, fontSize: 13 }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  section: { color: colors.text, fontSize: 18, fontWeight: "600" },
  label: { color: colors.text, fontSize: 14, fontWeight: "500" },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 13 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10 },
  optionOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
