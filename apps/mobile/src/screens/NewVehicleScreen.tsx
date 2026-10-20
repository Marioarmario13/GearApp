import { createVehicle, dataErrorMessage } from "@gearhead/shared";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { colors } from "@/components/ui";
import { VehicleForm } from "@/components/VehicleForm";
import { supabase } from "@/lib/supabase";

export function NewVehicleScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <VehicleForm
        submitLabel="Cadastrar veículo"
        onSubmit={async (input) => {
          try {
            const id = await createVehicle(supabase, input);
            router.replace(`/veiculo/${id}`);
          } catch (e) {
            throw new Error(dataErrorMessage(e));
          }
        }}
      />
      <Text style={styles.hint}>Depois de cadastrar, você poderá adicionar fotos.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
