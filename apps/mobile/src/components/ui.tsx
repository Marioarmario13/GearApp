import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

export const colors = {
  background: "#0e0e0f",
  surface: "#18181a",
  line: "#2a2a2d",
  text: "#ededed",
  muted: "#a3a3a3",
  accent: "#fb923c",
  danger: "#f87171",
  success: "#4ade80",
};

interface FieldProps extends TextInputProps {
  label: string;
  errors?: string[];
}

export function Field({ label, errors, ...input }: FieldProps) {
  const hasError = Boolean(errors?.length);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, hasError && styles.inputError]}
        {...input}
      />
      {hasError && <Text style={styles.error}>{errors?.join(" ")}</Text>}
    </View>
  );
}

export function Button({
  children,
  onPress,
  loading,
  variant = "primary",
}: {
  children: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: loading, busy: loading }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        (pressed || loading) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : colors.text} />
      ) : (
        <Text style={[styles.buttonText, variant === "secondary" && { color: colors.text }]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

export function Message({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <Text accessibilityRole="alert" style={[styles.message, { color: colors.danger }]}>
        {error}
      </Text>
    );
  }
  if (success) {
    return <Text style={[styles.message, { color: colors.success }]}>{success}</Text>;
  }
  return null;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: "500" },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13 },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  message: { fontSize: 14 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
});
