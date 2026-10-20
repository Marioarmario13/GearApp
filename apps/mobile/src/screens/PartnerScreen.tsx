import {
  BUSINESS_KIND_LABELS,
  CREDENTIAL_TYPE_LABELS,
  dataErrorMessage,
  directionsUrl,
  formatPhone,
  getBusiness,
  isExpired,
  whatsappLink,
  type BusinessDetails,
} from "@gearhead/shared";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { MapWebView } from "@/components/MapWebView";
import { Button, Card, colors, Message } from "@/components/ui";
import { ReportSection } from "@/screens/CommunityScreens";
import { supabase } from "@/lib/supabase";

const dateBR = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR");

export function PartnerScreen({ id }: { id: string }) {
  const [business, setBusiness] = useState<BusinessDetails | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getBusiness(supabase, id)
      .then((b) => active && setBusiness(b))
      .catch((e: unknown) => active && setError(dataErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);

  if (error) return <Message error={error} />;
  if (business === undefined) {
    return (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando"
      />
    );
  }
  if (business === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Parceiro não encontrado</Text>
        <Text style={styles.muted}>Ele não existe ou ainda não foi verificado.</Text>
      </View>
    );
  }

  // A página do diretório só mostra credenciais conferidas.
  const credentials = business.credentials.filter((c) => c.status === "approved");
  const whatsapp = whatsappLink(business.phone, business.phone_is_whatsapp);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: business.name }} />
      <View style={{ gap: 4 }}>
        <Text accessibilityRole="header" style={styles.title}>
          {business.name}
        </Text>
        <Text style={styles.muted}>
          {BUSINESS_KIND_LABELS[business.kind]} · {business.city}/{business.state}
        </Text>
        {business.status === "approved" && business.reviewed_at ? (
          <Text style={styles.badge}>✓ Registro conferido em {dateBR(business.reviewed_at)}</Text>
        ) : (
          <Text style={styles.pending}>Pré-visualização: ainda não está público.</Text>
        )}
      </View>

      {business.description ? <Text style={styles.text}>{business.description}</Text> : null}

      <Card>
        <Text style={styles.section}>Contato</Text>
        {business.phone ? (
          <Button
            variant="secondary"
            onPress={() => void Linking.openURL(`tel:+55${business.phone}`)}
          >
            {`Ligar ${formatPhone(business.phone) ?? ""}`}
          </Button>
        ) : null}
        {whatsapp ? (
          <Button onPress={() => void Linking.openURL(whatsapp)}>Conversar no WhatsApp</Button>
        ) : null}
        {!business.phone && <Text style={styles.muted}>Sem telefone informado.</Text>}
      </Card>

      {business.latitude !== null && business.longitude !== null && (
        <View style={{ gap: 8 }}>
          <MapWebView
            accessibilityLabel={`Localização de ${business.name}`}
            state={{
              center: { latitude: business.latitude, longitude: business.longitude },
              zoom: 15,
              markers: [
                {
                  id: business.id,
                  latitude: business.latitude,
                  longitude: business.longitude,
                  highlighted: true,
                },
              ],
            }}
            style={{ height: 220 }}
          />
          <Button
            variant="secondary"
            onPress={() =>
              void Linking.openURL(directionsUrl(business.latitude!, business.longitude!))
            }
          >
            Como chegar
          </Button>
        </View>
      )}

      {business.specialties.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text style={styles.section}>Especialidades</Text>
          <Text style={styles.text}>{business.specialties.map((s) => s.name).join(" · ")}</Text>
          <Text style={styles.hint}>Informadas pelo próprio estabelecimento.</Text>
        </View>
      )}

      <View style={{ gap: 8 }}>
        <Text style={styles.section}>Documentos e certificações conferidos</Text>
        {credentials.length === 0 ? (
          <Text style={styles.muted}>Nenhuma certificação conferida ainda.</Text>
        ) : (
          credentials.map((c) => (
            <View key={c.id} style={styles.credential}>
              <Text style={styles.text}>✓ {c.title}</Text>
              <Text style={styles.muted}>
                {CREDENTIAL_TYPE_LABELS[c.type]}
                {c.issuer ? ` · ${c.issuer}` : ""}
                {c.expires_on
                  ? ` · ${isExpired(c.expires_on) ? "vencido em" : "válido até"} ${dateBR(c.expires_on)}`
                  : ""}
              </Text>
            </View>
          ))
        )}
      </View>
      <ReportSection targetType="business" targetId={business.id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  section: { color: colors.text, fontSize: 18, fontWeight: "600" },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12 },
  badge: { color: colors.success, fontSize: 13, fontWeight: "600" },
  pending: { color: colors.accent, fontSize: 13 },
  credential: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    gap: 2,
  },
});
