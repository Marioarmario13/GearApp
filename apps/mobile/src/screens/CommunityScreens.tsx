import {
  dataErrorMessage,
  listMyBlocks,
  listMyFriendships,
  removeFriendship,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  respondFriendRequest,
  searchProfiles,
  sendFriendRequest,
  submitReport,
  unblockUser,
  type BlockedUser,
  type Friendship,
  type PersonResult,
  type ReportReason,
  type ReportTarget,
} from "@gearhead/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, colors, Field, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export function FriendsScreen() {
  const [data, setData] = useState<{ links: Friendship[]; blocks: BlockedUser[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([listMyFriendships(supabase), listMyBlocks(supabase)])
      .then(([links, blocks]) => active && setData({ links, blocks }))
      .catch((e: unknown) => active && setError(dataErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [reload]);

  const act = (fn: () => Promise<unknown>) => {
    fn()
      .then(() => setReload((n) => n + 1))
      .catch((e: unknown) => setError(dataErrorMessage(e)));
  };

  if (!data) {
    return error ? (
      <Message error={error} />
    ) : (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando"
      />
    );
  }
  const incoming = data.links.filter((f) => f.status === "pending" && f.incoming);
  const friends = data.links.filter((f) => f.status === "accepted");
  const name = (f: { display_name: string | null; username: string | null }) =>
    `${f.display_name ?? "Sem nome"}${f.username ? ` @${f.username}` : ""}`;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <PeopleSearch
        knownIds={new Set(data.links.map((f) => f.other_id))}
        onAdded={() => setReload((n) => n + 1)}
      />
      <Message error={error} />
      <Text accessibilityRole="header" style={styles.section}>
        Pedidos recebidos ({incoming.length})
      </Text>
      {incoming.length === 0 && <Text style={styles.muted}>Nenhum pedido pendente.</Text>}
      {incoming.map((f) => (
        <View key={f.friendship_id} style={styles.row}>
          <Text style={styles.name}>{name(f)}</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => act(() => respondFriendRequest(supabase, f.friendship_id, true))}
            >
              <Text style={styles.accept}>Aceitar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => act(() => respondFriendRequest(supabase, f.friendship_id, false))}
            >
              <Text style={styles.muted}>Recusar</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Text accessibilityRole="header" style={styles.section}>
        Amigos ({friends.length})
      </Text>
      {friends.length === 0 && (
        <Text style={styles.muted}>Busque alguém acima para adicionar.</Text>
      )}
      {friends.map((f) => (
        <View key={f.friendship_id} style={styles.row}>
          <Text style={styles.name}>{name(f)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Desfazer amizade com ${name(f)}`}
            onPress={() => act(() => removeFriendship(supabase, f.friendship_id))}
          >
            <Text style={styles.danger}>Desfazer</Text>
          </Pressable>
        </View>
      ))}
      <Text accessibilityRole="header" style={styles.section}>
        Bloqueados ({data.blocks.length})
      </Text>
      {data.blocks.map((b) => (
        <View key={b.user_id} style={styles.row}>
          <Text style={styles.name}>{name(b)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => act(() => unblockUser(supabase, b.user_id))}
          >
            <Text style={styles.accept}>Desbloquear</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/** Busca por nome/@usuário com pedido de amizade direto do resultado. */
function PeopleSearch({ knownIds, onAdded }: { knownIds: Set<string>; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonResult[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    setResult({});
    try {
      setResults(await searchProfiles(supabase, query));
    } catch (e) {
      setResults(null);
      setResult({ error: dataErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function add(p: PersonResult) {
    try {
      const status = await sendFriendRequest(supabase, p.id);
      setSent((s) => new Set(s).add(p.id));
      setResult({
        success:
          status === "accepted" ? `Agora você e @${p.username} são amigos.` : "Pedido enviado.",
      });
      onAdded();
    } catch (e) {
      setResult({ error: dataErrorMessage(e) });
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Field
        label="Buscar pessoas"
        placeholder="Nome ou @usuário"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
        returnKeyType="search"
        onSubmitEditing={search}
      />
      <Button variant="secondary" onPress={search} loading={busy}>
        Buscar
      </Button>
      <Message error={result.error} success={result.success} />
      {results?.length === 0 && <Text style={styles.muted}>Ninguém encontrado.</Text>}
      {results?.map((p) => {
        const label = `${p.display_name ?? p.username} @${p.username}`;
        const done = knownIds.has(p.id) || sent.has(p.id);
        return (
          <View key={p.id} style={styles.row}>
            <Text style={styles.name}>
              {label}
              {p.city ? `\n${p.city}${p.state ? `/${p.state}` : ""}` : ""}
            </Text>
            {done ? (
              <Text style={styles.muted}>Adicionado</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Adicionar ${label}`}
                onPress={() => add(p)}
              >
                <Text style={styles.accept}>Adicionar</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** "Denunciar" recolhível para telas de detalhe. */
export function ReportSection({
  targetType,
  targetId,
}: {
  targetType: ReportTarget;
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!reason) return setResult({ error: "Escolha o motivo." });
    setBusy(true);
    try {
      await submitReport(supabase, { targetType, targetId, reason, details: null });
      setResult({ success: "Denúncia enviada. Obrigado!" });
    } catch (e) {
      setResult({ error: dataErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}>
        <Text style={styles.muted}>Denunciar</Text>
      </Pressable>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <Message error={result.error} success={result.success} />
      {!result.success && (
        <>
          {REPORT_REASONS.map((r) => (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ selected: reason === r }}
              onPress={() => setReason(r)}
              style={[styles.option, reason === r && styles.optionSelected]}
            >
              <Text style={{ color: reason === r ? "#fff" : colors.text }}>
                {REPORT_REASON_LABELS[r]}
              </Text>
            </Pressable>
          ))}
          <Button variant="secondary" onPress={() => void send()} loading={busy}>
            Enviar denúncia
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10 },
  section: { color: colors.text, fontSize: 18, fontWeight: "600", marginTop: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  name: { color: colors.text, fontSize: 15, flexShrink: 1 },
  actions: { flexDirection: "row", gap: 16 },
  accept: { color: colors.accent, fontWeight: "600" },
  danger: { color: colors.danger },
  option: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 10 },
  optionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
