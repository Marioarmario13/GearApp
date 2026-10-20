import type { AppRole, PublicProfile } from "@gearhead/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button, Card, colors, Message } from "../components/ui";
import { supabase } from "../lib/supabase";

const PROFILE_COLUMNS =
  "id, username, display_name, city, state, avatar_url, created_at, updated_at";

export function AccountScreen({ userId, email }: { userId: string; email: string | null }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle<PublicProfile>(),
      supabase.rpc("current_user_role"),
    ])
      .then(([p, r]) => {
        if (!active) return;
        setError(p.error || r.error ? "Não foi possível carregar seu perfil." : null);
        setProfile(p.data ?? null);
        setRole((r.data as AppRole | null) ?? null);
      })
      .catch(() => {
        if (active) setError("Sem conexão com o servidor.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Minha conta
      </Text>
      <Card>
        {loading ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel="Carregando perfil" />
        ) : (
          <>
            <Message error={error} />
            <Text style={styles.name}>{profile?.display_name ?? "Sem nome"}</Text>
            <Text style={styles.muted}>
              {profile?.username ? `@${profile.username}` : "Sem nome de usuário"}
            </Text>
            <Text style={styles.muted}>{email}</Text>
            {profile?.city && (
              <Text style={styles.muted}>
                {profile.city}
                {profile.state ? ` — ${profile.state}` : ""}
              </Text>
            )}
            {role === "admin" && <Text style={styles.badge}>Administrador</Text>}
          </>
        )}
        <Button variant="secondary" onPress={() => void supabase.auth.signOut()}>
          Sair
        </Button>
      </Card>
      <Text style={styles.hint}>
        A edição do perfil no app chega junto com a Garagem (Etapa 3).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20, gap: 20 },
  title: { color: colors.text, fontSize: 28, fontWeight: "700" },
  name: { color: colors.text, fontSize: 20, fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 15 },
  badge: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center" },
});
