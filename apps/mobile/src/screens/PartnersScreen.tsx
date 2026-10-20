import {
  BUSINESS_KIND_LABELS,
  BUSINESS_KINDS,
  dataErrorMessage,
  listDirectory,
  type Business,
  type BusinessKind,
} from "@gearhead/shared";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Button, colors, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

interface Query {
  kind: BusinessKind | null;
  city: string;
  page: number;
}

export function PartnersScreen() {
  const router = useRouter();
  const [query, setQuery] = useState<Query>({ kind: null, city: "", page: 1 });
  const [cityInput, setCityInput] = useState("");
  const [items, setItems] = useState<Business[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listDirectory(supabase, { kind: query.kind, city: query.city, page: query.page })
      .then((res) => {
        if (!active) return;
        // Página 1 substitui a lista; as seguintes acrescentam ("carregar mais").
        setItems((prev) => (query.page === 1 ? res.items : [...(prev ?? []), ...res.items]));
        setHasMore(res.hasMore);
        setError(null);
      })
      .catch((e: unknown) => {
        if (active) setError(dataErrorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [query]);

  const applyFilters = (patch: Partial<Query>) => {
    setItems(null);
    setQuery((q) => ({ ...q, ...patch, page: 1 }));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>
        Só aparecem estabelecimentos com registro (CNPJ/MEI) conferido pela equipe Gearhead.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {[null, ...BUSINESS_KINDS].map((k) => {
          const selected = query.kind === k;
          return (
            <Pressable
              key={k ?? "all"}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => applyFilters({ kind: k })}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && { color: "#fff" }]}>
                {k ? BUSINESS_KIND_LABELS[k] : "Todos"}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TextInput
        accessibilityLabel="Cidade"
        placeholder="Filtrar por cidade"
        placeholderTextColor={colors.muted}
        value={cityInput}
        onChangeText={setCityInput}
        onSubmitEditing={() => applyFilters({ city: cityInput.trim() })}
        returnKeyType="search"
        style={styles.input}
      />
      <Message error={error} />
      {items === null && !error ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Carregando parceiros" />
      ) : items && items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nenhum parceiro encontrado</Text>
          <Text style={styles.muted}>Tente remover algum filtro.</Text>
        </View>
      ) : (
        <FlatList
          data={items ?? []}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => router.push(`/parceiros/${item.id}`)}
              style={styles.card}
            >
              <Text style={styles.title}>✓ {item.name}</Text>
              <Text style={styles.muted}>
                {BUSINESS_KIND_LABELS[item.kind]} · {item.city}/{item.state}
              </Text>
              {item.specialties.length > 0 && (
                <Text style={styles.meta} numberOfLines={2}>
                  {item.specialties.map((s) => s.name).join(" · ")}
                </Text>
              )}
            </Pressable>
          )}
          ListFooterComponent={
            hasMore ? (
              <Button
                variant="secondary"
                onPress={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
              >
                Carregar mais
              </Button>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  intro: { color: colors.muted, fontSize: 13 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  empty: { alignItems: "center", gap: 4, paddingVertical: 40 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12 },
});
