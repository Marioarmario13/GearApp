import { APP_NAME } from "@gearhead/shared";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {APP_NAME}
      </Text>
      <Text style={styles.subtitle}>Garagem, profissionais verificados, eventos e comunidade.</Text>
      <Text style={styles.badge}>Em desenvolvimento</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0e0e0f",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  title: {
    color: "#ededed",
    fontSize: 36,
    fontWeight: "700",
  },
  subtitle: {
    color: "#a3a3a3",
    fontSize: 16,
    textAlign: "center",
  },
  badge: {
    color: "#fb923c",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
});
