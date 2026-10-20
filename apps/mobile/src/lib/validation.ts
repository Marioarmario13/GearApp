import type { z } from "zod";

export type FieldErrors = Partial<Record<string, string[]>>;

export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
