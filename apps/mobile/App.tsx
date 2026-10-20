import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AuthProvider, useAuth } from "./src/auth/AuthProvider";
import { colors } from "./src/components/ui";
import { AccountScreen } from "./src/screens/AccountScreen";
import { AuthScreen } from "./src/screens/AuthScreen";

export default function App() {
  return (
    <AuthProvider>
      <View style={styles.container}>
        <Root />
        <StatusBar style="light" />
      </View>
    </AuthProvider>
  );
}

function Root() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <ActivityIndicator
        style={{ flex: 1 }}
        color={colors.accent}
        accessibilityLabel="Carregando"
      />
    );
  }
  if (!session) return <AuthScreen />;
  return <AccountScreen userId={session.user.id} email={session.user.email ?? null} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
