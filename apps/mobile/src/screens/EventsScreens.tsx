import {
  dataErrorMessage,
  EVENT_KIND_HINTS,
  EVENT_KIND_LABELS,
  formatEventPeriod,
  getEvent,
  isGoing,
  leaveEvent,
  listUpcomingEvents,
  rsvpEvent,
  spotsLeft,
  type GearEvent,
} from "@gearhead/shared";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { MapWebView } from "@/components/MapWebView";
import { Button, Card, colors, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { ReportSection } from "@/screens/CommunityScreens";

export function EventsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<GearEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listUpcomingEvents(supabase)
      .then((r) => active && setItems(r.items))
      .catch((e: unknown) => active && setError(dataErrorMessage(e)));
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Message error={error} />;
  if (!items)
    return (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando eventos"
      />
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <Text style={styles.muted}>
          Encontros e passeios da comunidade. Velocidade, só em autódromo. Para criar eventos, use o
          site.
        </Text>
      }
      ListEmptyComponent={<Text style={styles.title}>Nenhum evento agendado</Text>}
      renderItem={({ item }) => {
        const spots = spotsLeft(item);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => router.push(`/eventos/${item.id}`)}
            style={styles.card}
          >
            <Text style={styles.when}>{formatEventPeriod(item.starts_at, item.ends_at)}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.muted}>
              {EVENT_KIND_LABELS[item.kind]} · {item.city}/{item.state}
            </Text>
            <Text style={styles.muted}>
              {item.attendee_count} confirmado(s)
              {spots !== null ? ` · ${spots === 0 ? "lotado" : `${spots} vaga(s)`}` : ""}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

export function EventScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [event, setEvent] = useState<GearEvent | null | undefined>(undefined);
  const [going, setGoing] = useState(false);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [e, g] = await Promise.all([
      getEvent(supabase, id),
      userId ? isGoing(supabase, id, userId) : Promise.resolve(false),
    ]);
    return { e, g };
  }, [id, userId]);

  useEffect(() => {
    let active = true;
    load()
      .then(({ e, g }) => {
        if (!active) return;
        setEvent(e);
        setGoing(g);
      })
      .catch((err: unknown) => active && setMessage({ error: dataErrorMessage(err) }));
    return () => {
      active = false;
    };
  }, [load]);

  async function toggle() {
    if (!userId || !event) return;
    setBusy(true);
    setMessage({});
    try {
      if (going) await leaveEvent(supabase, event.id, userId);
      else await rsvpEvent(supabase, event.id);
      const { e, g } = await load();
      setEvent(e);
      setGoing(g);
      setMessage({ success: g ? "Presença confirmada." : "Presença cancelada." });
    } catch (err) {
      setMessage({ error: dataErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (event === undefined) {
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
  if (event === null)
    return <Text style={[styles.title, { padding: 16 }]}>Evento não encontrado</Text>;

  const spots = spotsLeft(event);
  const open = event.status === "scheduled" && new Date(event.ends_at) > new Date();
  const hint = EVENT_KIND_HINTS[event.kind];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: event.title }} />
      {event.status !== "scheduled" && (
        <Message
          error={`Evento ${event.status === "cancelled" ? "cancelado" : "removido"}${event.status_note ? `: ${event.status_note}` : "."}`}
        />
      )}
      <Text style={styles.when}>{formatEventPeriod(event.starts_at, event.ends_at)}</Text>
      <Text accessibilityRole="header" style={styles.h1}>
        {event.title}
      </Text>
      <Text style={styles.muted}>
        {EVENT_KIND_LABELS[event.kind]} · {event.venue_name} · {event.city}/{event.state}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {event.description ? <Text style={styles.text}>{event.description}</Text> : null}
      <Card>
        <Text style={styles.text}>
          {event.attendee_count} confirmado(s)
          {spots !== null ? ` · ${spots === 0 ? "lotado" : `${spots} vaga(s)`}` : ""}
        </Text>
        <Message error={message.error} success={message.success} />
        {open && (going || spots !== 0) ? (
          <Button
            variant={going ? "secondary" : "primary"}
            onPress={() => void toggle()}
            loading={busy}
          >
            {going ? "Cancelar minha presença" : "Confirmar presença"}
          </Button>
        ) : (
          <Text style={styles.muted}>
            {open ? "Não há mais vagas." : "Este evento não está aberto."}
          </Text>
        )}
      </Card>
      {event.latitude !== null && event.longitude !== null && (
        <MapWebView
          accessibilityLabel={`Local do evento ${event.title}`}
          state={{
            center: { latitude: event.latitude, longitude: event.longitude },
            zoom: 15,
            markers: [
              {
                id: event.id,
                latitude: event.latitude,
                longitude: event.longitude,
                highlighted: true,
              },
            ],
          }}
          style={{ height: 220 }}
        />
      )}
      {userId !== event.organizer_id && <ReportSection targetType="event" targetId={event.id} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  when: { color: colors.accent, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  h1: { color: colors.text, fontSize: 24, fontWeight: "700" },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  hint: { color: colors.accent, fontSize: 13 },
});
