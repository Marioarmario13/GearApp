import { signUpSchema } from "@gearhead/shared";
import { describe, expect, it } from "vitest";
import { fieldErrorsFrom, formValues, safeNextPath } from "./forms";

describe("safeNextPath", () => {
  it.each(["/conta", "/conta?aba=perfil"])("aceita caminho interno %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "conta", null, undefined, 42])(
    "rejeita %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/conta");
    },
  );
});

describe("formValues", () => {
  it("nunca devolve a senha nem campos internos do Next", () => {
    const fd = new FormData();
    fd.set("email", "a@b.test");
    fd.set("password", "segredo123");
    fd.set("$ACTION_ID_abc", "");
    expect(formValues(fd)).toEqual({ email: "a@b.test" });
  });
});

describe("fieldErrorsFrom", () => {
  it("agrupa mensagens por campo", () => {
    const result = signUpSchema.safeParse({
      email: "x",
      password: "1",
      username: "A",
      displayName: "",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = fieldErrorsFrom(result.error);
    expect(Object.keys(errors).sort()).toEqual(["displayName", "email", "password", "username"]);
  });
});
