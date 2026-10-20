import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  profileUpdateSchema,
  signInSchema,
  signUpSchema,
  toProfileRow,
  usernameSchema,
} from "./profile";

describe("usernameSchema", () => {
  it("normaliza para minúsculas e aceita formato válido", () => {
    expect(usernameSchema.parse("  Piloto_01 ")).toBe("piloto_01");
  });

  it.each(["ab", "nome com espaço", "acentuação", "a".repeat(31), "hífen-no-meio"])(
    "rejeita %s",
    (value) => {
      expect(usernameSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("signUpSchema", () => {
  const valid = {
    email: "Piloto@Gearhead.TEST",
    password: "senha1234",
    username: "piloto",
    displayName: "Piloto",
  };

  it("aceita cadastro válido e normaliza o e-mail", () => {
    expect(signUpSchema.parse(valid).email).toBe("piloto@gearhead.test");
  });

  it.each([
    ["curta", "abc123"],
    ["sem números", "somenteletras"],
    ["sem letras", "12345678"],
  ])("rejeita senha %s", (_label, password) => {
    expect(signUpSchema.safeParse({ ...valid, password }).success).toBe(false);
  });

  it("rejeita e-mail inválido", () => {
    expect(signUpSchema.safeParse({ ...valid, email: "nao-e-email" }).success).toBe(false);
  });
});

describe("signInSchema", () => {
  it("exige senha", () => {
    expect(signInSchema.safeParse({ email: "a@b.test", password: "" }).success).toBe(false);
  });
});

describe("profileUpdateSchema", () => {
  it("converte campos vazios em null", () => {
    const parsed = profileUpdateSchema.parse({
      username: "piloto",
      displayName: "Piloto",
      city: "  ",
      state: "",
    });
    expect(toProfileRow(parsed)).toEqual({
      username: "piloto",
      display_name: "Piloto",
      city: null,
      state: null,
    });
  });

  it("aceita UF válida e rejeita inválida", () => {
    const base = { username: "piloto", displayName: "Piloto", city: "Recife" };
    expect(profileUpdateSchema.parse({ ...base, state: "PE" }).state).toBe("PE");
    expect(profileUpdateSchema.safeParse({ ...base, state: "XX" }).success).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("traduz códigos conhecidos", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("E-mail ou senha incorretos.");
    expect(authErrorMessage({ code: "23505" })).toBe("Este nome de usuário já está em uso.");
  });

  it("usa mensagem genérica para códigos desconhecidos (não vaza detalhes internos)", () => {
    expect(authErrorMessage({ code: "xyz", message: "stack trace" })).toBe(
      "Não foi possível concluir a operação. Tente novamente.",
    );
  });
});
