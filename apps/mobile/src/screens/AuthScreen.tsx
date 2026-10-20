import { APP_NAME, authErrorMessage, signInSchema, signUpSchema } from "@gearhead/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, Field, Message } from "../components/ui";
import { supabase } from "../lib/supabase";
import { fieldErrorsFrom, type FieldErrors } from "../lib/validation";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [form, setForm] = useState({ email: "", password: "", username: "", displayName: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setMessage({});
    // Validação no cliente melhora a UX; o Supabase Auth e o banco validam de novo.
    const parsed =
      mode === "signin"
        ? { mode, result: signInSchema.safeParse(form) }
        : { mode, result: signUpSchema.safeParse(form) };
    if (!parsed.result.success) {
      setErrors(fieldErrorsFrom(parsed.result.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      if (parsed.mode === "signup" && parsed.result.success) {
        const { email, password, username, displayName } = parsed.result.data;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, display_name: displayName } },
        });
        if (error) setMessage({ error: authErrorMessage(error) });
        else if (!data.session) setMessage({ success: "Conta criada! Confira seu e-mail." });
      } else if (parsed.mode === "signin" && parsed.result.success) {
        const { error } = await supabase.auth.signInWithPassword(parsed.result.data);
        if (error) setMessage({ error: authErrorMessage(error) });
      }
    } catch {
      setMessage({ error: "Sem conexão com o servidor. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setErrors({});
    setMessage({});
  }

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {APP_NAME}
      </Text>
      <Card>
        <Text style={styles.subtitle}>{mode === "signin" ? "Entrar" : "Criar conta"}</Text>
        <Message error={message.error} success={message.success} />
        {mode === "signup" && (
          <>
            <Field
              label="Nome"
              value={form.displayName}
              onChangeText={set("displayName")}
              errors={errors.displayName}
              autoComplete="name"
            />
            <Field
              label="Nome de usuário"
              value={form.username}
              onChangeText={set("username")}
              errors={errors.username}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}
        <Field
          label="E-mail"
          value={form.email}
          onChangeText={set("email")}
          errors={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <Field
          label="Senha"
          value={form.password}
          onChangeText={set("password")}
          errors={errors.password}
          secureTextEntry
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
        />
        <Button onPress={submit} loading={loading}>
          {mode === "signin" ? "Entrar" : "Criar conta"}
        </Button>
        <Pressable accessibilityRole="button" onPress={toggleMode}>
          <Text style={styles.link}>
            {mode === "signin" ? "Ainda não tem conta? Criar conta" : "Já tem conta? Entrar"}
          </Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, gap: 20 },
  title: { color: colors.text, fontSize: 32, fontWeight: "700", textAlign: "center" },
  subtitle: { color: colors.text, fontSize: 22, fontWeight: "700" },
  link: { color: colors.accent, textAlign: "center", fontWeight: "500" },
});
