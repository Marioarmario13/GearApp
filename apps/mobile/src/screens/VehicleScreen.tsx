import {
  dataErrorMessage,
  deleteVehicle,
  deleteVehiclePhoto,
  getVehicle,
  MAX_PHOTOS_PER_VEHICLE,
  signPhotoUrls,
  updateVehicle,
  uploadVehiclePhoto,
  vehicleTitle,
  VISIBILITY_LABELS,
  type VehiclePhoto,
  type VehicleWithPlate,
} from "@gearhead/shared";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Card, colors, Message } from "@/components/ui";
import { VehicleForm } from "@/components/VehicleForm";
import { pickVehiclePhoto } from "@/lib/photos";
import { supabase } from "@/lib/supabase";

interface Loaded {
  vehicle: VehicleWithPlate | null;
  urls: Record<string, string>;
}

export function VehicleScreen({ id }: { id: string }) {
  const { session } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getVehicle(supabase, id)
      .then(async (vehicle) => {
        const urls = vehicle
          ? await signPhotoUrls(
              supabase,
              vehicle.photos.map((p) => p.storage_path),
            )
          : {};
        if (active) setLoaded({ vehicle, urls });
      })
      .catch((e: unknown) => {
        if (active) setError(dataErrorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  if (error && !loaded) return <Message error={error} />;
  if (!loaded) {
    return (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando veículo"
      />
    );
  }
  const { vehicle, urls } = loaded;
  if (!vehicle) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Veículo não encontrado</Text>
        <Text style={styles.muted}>Ele não existe ou é privado.</Text>
      </View>
    );
  }

  const isOwner = vehicle.owner_id === session?.user.id;

  async function addPhoto() {
    if (!vehicle || !session) return;
    setError(null);
    try {
      const picked = await pickVehiclePhoto();
      if (!picked) return;
      setBusy(true);
      await uploadVehiclePhoto(supabase, { ownerId: session.user.id, vehicle, ...picked });
      reload();
    } catch (e) {
      setError(dataErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(photo: VehiclePhoto) {
    Alert.alert("Remover foto?", "A foto será apagada.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          deleteVehiclePhoto(supabase, photo)
            .then(reload)
            .catch((e: unknown) => setError(dataErrorMessage(e)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert("Excluir veículo?", "Remove o veículo, a placa e todas as fotos.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          deleteVehicle(supabase, vehicle!.id)
            .then(() => router.back())
            .catch((e: unknown) => {
              setError(dataErrorMessage(e));
              setBusy(false);
            });
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: vehicleTitle(vehicle) }} />
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={styles.title}>
          {vehicleTitle(vehicle)}
        </Text>
        <Text style={styles.muted}>
          {vehicle.make} {vehicle.model} · {vehicle.year} · {VISIBILITY_LABELS[vehicle.visibility]}
        </Text>
      </View>
      <Message error={error} />

      <Text style={styles.section}>Fotos ({vehicle.photos.length})</Text>
      {vehicle.photos.length === 0 ? (
        <Text style={styles.muted}>Nenhuma foto ainda.</Text>
      ) : (
        <ScrollView
          horizontal
          contentContainerStyle={{ gap: 10 }}
          showsHorizontalScrollIndicator={false}
        >
          {vehicle.photos.map((photo, i) => (
            <View key={photo.id} style={styles.photoBox}>
              {urls[photo.storage_path] ? (
                <Image
                  source={{ uri: urls[photo.storage_path] }}
                  style={styles.photo}
                  accessibilityLabel={`Foto ${i + 1}`}
                />
              ) : (
                <View style={[styles.photo, styles.center]}>
                  <Text style={styles.muted}>Indisponível</Text>
                </View>
              )}
              {isOwner && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover foto ${i + 1}`}
                  onPress={() => removePhoto(photo)}
                  style={styles.removeBtn}
                >
                  <Text style={{ color: "#fff", fontSize: 12 }}>Remover</Text>
                </Pressable>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {isOwner && (
        <>
          {vehicle.photos.length < MAX_PHOTOS_PER_VEHICLE ? (
            <Button variant="secondary" onPress={addPhoto} loading={busy}>
              Adicionar foto
            </Button>
          ) : (
            <Text style={styles.muted}>Limite de {MAX_PHOTOS_PER_VEHICLE} fotos atingido.</Text>
          )}

          <Card>
            <Text style={styles.section}>Dados do veículo</Text>
            <VehicleForm
              key={vehicle.updated_at}
              vehicle={vehicle}
              submitLabel="Salvar alterações"
              onSubmit={async (input) => {
                try {
                  await updateVehicle(supabase, vehicle.id, input);
                } catch (e) {
                  throw new Error(dataErrorMessage(e));
                }
                reload();
                return "Veículo atualizado.";
              }}
            />
          </Card>

          <Pressable
            accessibilityRole="button"
            onPress={confirmDelete}
            disabled={busy}
            style={styles.danger}
          >
            <Text style={{ color: colors.danger, fontWeight: "600" }}>Excluir veículo</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  section: { color: colors.text, fontSize: 18, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 14 },
  photoBox: { borderRadius: 12, overflow: "hidden" },
  photo: { width: 180, height: 180, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  danger: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
});
