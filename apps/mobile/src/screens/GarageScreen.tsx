import {
  dataErrorMessage,
  listMyVehicles,
  signPhotoUrls,
  vehicleTitle,
  VISIBILITY_LABELS,
  type Vehicle,
} from "@gearhead/shared";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Button, colors, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

interface State {
  vehicles: Vehicle[];
  covers: Record<string, string>;
}

export function GarageScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const userId = session?.user.id;
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recarrega ao voltar para a tela (ex.: depois de criar/excluir um veículo).
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      listMyVehicles(supabase, userId)
        .then(async (vehicles) => {
          const paths = vehicles.flatMap((v) => (v.photos[0] ? [v.photos[0].storage_path] : []));
          const covers = await signPhotoUrls(supabase, paths);
          if (active) {
            setState({ vehicles, covers });
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (active) setError(dataErrorMessage(e));
        });
      return () => {
        active = false;
      };
    }, [userId]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Button onPress={() => router.push("/veiculo/novo")}>Adicionar veículo</Button>
        <View style={styles.links}>
          <Link href="/radar" style={styles.link} accessibilityRole="link">
            Radar
          </Link>
          <Link href="/parceiros" style={styles.link} accessibilityRole="link">
            Parceiros
          </Link>
          <Link href="/eventos" style={styles.link} accessibilityRole="link">
            Eventos
          </Link>
          <Link href="/ofertas" style={styles.link} accessibilityRole="link">
            Ofertas
          </Link>
          <Link href="/conta" style={styles.link} accessibilityRole="link">
            Minha conta
          </Link>
        </View>
      </View>
      <Message error={error} />
      {!state && !error ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel="Carregando veículos" />
      ) : state && state.vehicles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sua garagem está vazia</Text>
          <Text style={styles.muted}>Cadastre seu primeiro veículo para começar.</Text>
        </View>
      ) : (
        <FlatList
          data={state?.vehicles ?? []}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const cover = item.photos[0] && state?.covers[item.photos[0].storage_path];
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={vehicleTitle(item)}
                onPress={() => router.push(`/veiculo/${item.id}`)}
                style={styles.card}
              >
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    style={styles.cover}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View style={[styles.cover, styles.noCover]}>
                    <Text style={styles.muted}>Sem foto</Text>
                  </View>
                )}
                <View style={{ padding: 12, gap: 2 }}>
                  <Text style={styles.title}>{vehicleTitle(item)}</Text>
                  <Text style={styles.muted}>
                    {item.make} {item.model} · {item.year}
                  </Text>
                  <Text style={styles.meta}>
                    {VISIBILITY_LABELS[item.visibility]} · {item.photos.length} foto(s)
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  toolbar: { gap: 10 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", rowGap: 4 },
  link: { color: colors.accent, textAlign: "center", fontWeight: "500", paddingVertical: 4 },
  empty: { alignItems: "center", gap: 4, paddingVertical: 40 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cover: { width: "100%", aspectRatio: 16 / 9, backgroundColor: colors.background },
  noCover: { alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 17, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
});
