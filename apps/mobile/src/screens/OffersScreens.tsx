import {
  cancelCoupon,
  claimOffer,
  COUPON_STATUS_LABELS,
  dataErrorMessage,
  effectiveCouponStatus,
  formatCouponCode,
  getOffer,
  listActiveOffers,
  listMyCoupons,
  offerRemaining,
  type Coupon,
  type Offer,
} from "@gearhead/shared";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { Button, Card, colors, Message } from "@/components/ui";
import { supabase } from "@/lib/supabase";

const dateBR = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function OffersScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Offer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listActiveOffers(supabase)
      .then((r) => active && setItems(r))
      .catch((e: unknown) => active && setError(dataErrorMessage(e)));
    return () => {
      active = false;
    };
  }, []);

  if (error) return <Message error={error} />;
  if (!items)
    return (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando ofertas"
      />
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(o) => o.id}
      contentContainerStyle={styles.container}
      ListHeaderComponent={
        <Button variant="secondary" onPress={() => router.push("/cupons")}>
          Meus cupons
        </Button>
      }
      ListEmptyComponent={<Text style={styles.title}>Nenhuma oferta no momento</Text>}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.discount_label}, ${item.title}`}
          onPress={() => router.push(`/ofertas/${item.id}`)}
          style={styles.card}
        >
          <Text style={styles.discount}>{item.discount_label}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.muted}>
            ✓ {item.business?.name} · até {dateBR(item.ends_at)}
          </Text>
        </Pressable>
      )}
    />
  );
}

export function OfferScreen({ id }: { id: string }) {
  const [offer, setOffer] = useState<Offer | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getOffer(supabase, id)
      .then((o) => active && setOffer(o))
      .catch((e: unknown) => active && setMessage(dataErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [id]);

  async function claim() {
    setBusy(true);
    setMessage(null);
    try {
      setCode((await claimOffer(supabase, id)).code);
    } catch (e) {
      setMessage(dataErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (offer === undefined) {
    return message ? (
      <Message error={message} />
    ) : (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando"
      />
    );
  }
  if (offer === null)
    return <Text style={[styles.title, { padding: 16 }]}>Oferta não encontrada</Text>;
  const remaining = offerRemaining(offer);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: offer.discount_label }} />
      <Text style={styles.discountBig}>{offer.discount_label}</Text>
      <Text accessibilityRole="header" style={styles.h1}>
        {offer.title}
      </Text>
      <Text style={styles.muted}>
        ✓ {offer.business?.name} · válida até {dateBR(offer.ends_at)}
        {remaining !== null ? ` · ${remaining} restante(s)` : ""}
      </Text>
      {offer.description ? <Text style={styles.text}>{offer.description}</Text> : null}
      {offer.terms ? <Text style={styles.muted}>Regras: {offer.terms}</Text> : null}
      <Message error={message} />
      {code ? (
        <Card>
          <Text style={styles.muted}>Apresente este código no estabelecimento:</Text>
          <Text accessibilityLabel={`Código ${code.split("").join(" ")}`} style={styles.code}>
            {formatCouponCode(code)}
          </Text>
        </Card>
      ) : (
        <Button onPress={() => void claim()} loading={busy}>
          Pegar cupom
        </Button>
      )}
      <Text style={styles.hint}>
        O desconto é concedido pelo estabelecimento. O Gearhead não processa pagamentos.
      </Text>
    </ScrollView>
  );
}

export function CouponsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [items, setItems] = useState<Coupon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    listMyCoupons(supabase, userId)
      .then((r) => active && setItems(r))
      .catch((e: unknown) => active && setError(dataErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [userId, reload]);

  if (error) return <Message error={error} />;
  if (!items)
    return (
      <ActivityIndicator
        style={{ marginTop: 40 }}
        color={colors.accent}
        accessibilityLabel="Carregando cupons"
      />
    );

  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.container}
      ListEmptyComponent={<Text style={styles.muted}>Você ainda não pegou cupons.</Text>}
      renderItem={({ item }) => {
        const status = effectiveCouponStatus(item);
        return (
          <View style={styles.card}>
            <Text style={styles.title}>
              {item.offer?.discount_label} · {item.offer?.title}
            </Text>
            <Text style={styles.muted}>
              {item.offer?.business?.name} · {COUPON_STATUS_LABELS[status]}
              {status === "issued" ? ` até ${dateBR(item.expires_at)}` : ""}
            </Text>
            <Text
              style={[
                styles.code,
                status !== "issued" && { color: colors.muted, textDecorationLine: "line-through" },
              ]}
            >
              {formatCouponCode(item.code)}
            </Text>
            {status === "issued" && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void cancelCoupon(supabase, item.id).then(() => setReload((n) => n + 1))
                }
              >
                <Text style={{ color: colors.danger }}>Desistir do cupom</Text>
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  discount: { color: colors.accent, fontSize: 22, fontWeight: "700" },
  discountBig: { color: colors.accent, fontSize: 34, fontWeight: "800" },
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
  h1: { color: colors.text, fontSize: 22, fontWeight: "700" },
  text: { color: colors.text, fontSize: 15 },
  muted: { color: colors.muted, fontSize: 14 },
  hint: { color: colors.muted, fontSize: 12 },
  code: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    fontFamily: "monospace",
  },
});
