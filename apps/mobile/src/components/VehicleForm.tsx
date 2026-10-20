import {
  vehicleInputSchema,
  type VehicleInput,
  type VehicleVisibility,
  type VehicleWithPlate,
} from "@gearhead/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fieldErrorsFrom, type FieldErrors } from "@/lib/validation";
import { Button, colors, Field, Message } from "./ui";

const VISIBILITY_OPTIONS: { value: VehicleVisibility; label: string; hint: string }[] = [
  { value: "private", label: "Privado", hint: "Só você vê" },
  { value: "public", label: "Público", hint: "Membros do Gearhead podem ver" },
];

export function VehicleForm({
  vehicle,
  submitLabel,
  onSubmit,
}: {
  vehicle?: VehicleWithPlate;
  submitLabel: string;
  /** Deve lançar erro em caso de falha; a mensagem vira `dataErrorMessage` no chamador. */
  onSubmit: (input: VehicleInput) => Promise<string | void>;
}) {
  const [form, setForm] = useState({
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: vehicle ? String(vehicle.year) : "",
    nickname: vehicle?.nickname ?? "",
    plate: vehicle?.plate ?? "",
    visibility: (vehicle?.visibility ?? "private") as VehicleVisibility,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setMessage({});
    const parsed = vehicleInputSchema().safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const success = await onSubmit(parsed.data);
      if (success) setMessage({ success });
    } catch (e) {
      setMessage({ error: e instanceof Error ? e.message : "Não foi possível salvar." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Message error={message.error} success={message.success} />
      <Field label="Marca" value={form.make} onChangeText={set("make")} errors={errors.make} />
      <Field label="Modelo" value={form.model} onChangeText={set("model")} errors={errors.model} />
      <Field
        label="Ano"
        value={form.year}
        onChangeText={set("year")}
        errors={errors.year}
        keyboardType="number-pad"
        maxLength={4}
      />
      <Field
        label="Apelido (opcional)"
        value={form.nickname}
        onChangeText={set("nickname")}
        errors={errors.nickname}
      />
      <Field
        label="Placa (opcional, só você vê)"
        value={form.plate}
        onChangeText={set("plate")}
        errors={errors.plate}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <View style={{ gap: 6 }}>
        <Text style={styles.label}>Visibilidade</Text>
        <View accessibilityRole="radiogroup" style={styles.segment}>
          {VISIBILITY_OPTIONS.map((opt) => {
            const selected = form.visibility === opt.value;
            return (
              <Pressable
                key={opt.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${opt.label}: ${opt.hint}`}
                onPress={() => setForm((f) => ({ ...f, visibility: opt.value }))}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionLabel, selected && { color: "#fff" }]}>{opt.label}</Text>
                <Text style={[styles.optionHint, selected && { color: "#fff" }]}>{opt.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Button onPress={submit} loading={loading}>
        {submitLabel}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.text, fontSize: 14, fontWeight: "500" },
  segment: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  optionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  optionLabel: { color: colors.text, fontWeight: "600" },
  optionHint: { color: colors.muted, fontSize: 12 },
});
