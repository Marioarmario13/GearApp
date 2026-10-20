import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { colors } from "@/components/ui";

const screenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
} as const;

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} accessibilityLabel="Carregando" />
      </View>
    );
  }

  // Guardas só controlam navegação; a proteção dos dados é a RLS do banco.
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Protected guard={Boolean(session)} redirectTo="/entrar">
        <Stack.Screen name="index" options={{ title: "Minha garagem" }} />
        <Stack.Screen name="conta" options={{ title: "Minha conta" }} />
        <Stack.Screen name="veiculo/novo" options={{ title: "Novo veículo" }} />
        <Stack.Screen name="veiculo/[id]" options={{ title: "Veículo" }} />
        <Stack.Screen name="parceiros/index" options={{ title: "Parceiros verificados" }} />
        <Stack.Screen name="radar" options={{ title: "Radar" }} />
        <Stack.Screen name="parceiros/[id]" options={{ title: "Parceiro" }} />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
