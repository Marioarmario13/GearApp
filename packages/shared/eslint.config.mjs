import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/**", "src/database.types.ts"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    // Em testes, `!` documenta uma pré-condição que o próprio teste verifica.
    files: ["**/*.test.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
);
