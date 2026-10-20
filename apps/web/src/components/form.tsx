"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useId } from "react";
import { useFormStatus } from "react-dom";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
}

export function Field({ label, name, errors, hint, ...input }: FieldProps) {
  const id = useId();
  const describedBy = [errors?.length ? `${id}-err` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent aria-invalid:border-red-600"
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-err`} className="text-sm text-red-600 dark:text-red-400">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

function FieldShell({
  id,
  label,
  errors,
  hint,
  children,
}: {
  id: string;
  label: string;
  errors?: string[];
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {errors?.length ? (
        <p id={`${id}-err`} className="text-sm text-red-600 dark:text-red-400">
          {errors.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, errors?: string[], hint?: string) =>
  [errors?.length ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") ||
  undefined;

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  name: string;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  errors?: string[];
  hint?: string;
}

export function SelectField({
  label,
  name,
  options,
  placeholder,
  errors,
  hint,
  defaultValue,
  ...select
}: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} errors={errors} hint={hint}>
      <select
        // key força remontagem: o reset de formulário do React 19 não reaplica defaultValue em <select>.
        key={String(defaultValue ?? "")}
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, errors, hint)}
        className="rounded-lg border border-line bg-surface px-3 py-2 aria-invalid:border-red-600"
        {...select}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
}

export function TextAreaField({ label, name, errors, hint, ...textarea }: TextAreaFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} errors={errors} hint={hint}>
      <textarea
        id={id}
        name={name}
        rows={4}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy(id, errors, hint)}
        className="rounded-lg border border-line bg-surface px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-accent aria-invalid:border-red-600"
        {...textarea}
      />
    </FieldShell>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-accent text-white hover:opacity-90",
  secondary: "border border-line hover:bg-background",
  danger: "bg-red-600 text-white hover:bg-red-700",
} as const;

export function SubmitButton({
  children,
  pendingText,
  name,
  value,
  variant = "primary",
}: {
  children: ReactNode;
  pendingText: string;
  /** Para formulários com mais de uma ação (ex.: name="decision" value="approved"). */
  name?: string;
  value?: string;
  variant?: keyof typeof BUTTON_VARIANTS;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`rounded-lg px-4 py-2.5 font-semibold transition-opacity disabled:opacity-60 ${BUTTON_VARIANTS[variant]}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
      >
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p
        role="status"
        className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
      >
        {success}
      </p>
    );
  }
  return null;
}
