"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { formatPace, parsePaceToSeconds } from "@/lib/format";

export type FieldSpec = {
  name: string;
  label: string;
  /** `pace` accepts "M:SS" or raw seconds and submits seconds. */
  kind?: "number" | "pace" | "select";
  unit?: string;
  hint?: string;
  options?: string[];
  step?: number;
  min?: number;
  max?: number;
};

/** What the form submits: only scalars a user can type. */
export type FieldValues = Record<string, number | string | undefined>;

/**
 * Stored day rows carry fields this form does not edit (arrays like `hrTrend`,
 * plus `source` and `date`), so seeding reads from a loose shape and ignores
 * anything that is not a scalar.
 */
function toInputValue(value: unknown, kind: FieldSpec["kind"]): string {
  if (typeof value === "number") {
    return kind === "pace" ? formatPace(value) : String(value);
  }
  return typeof value === "string" ? value : "";
}

function seedValues(
  fields: FieldSpec[],
  initialValues: Record<string, unknown>,
): Record<string, string> {
  const seeded: Record<string, string> = {};
  for (const field of fields) {
    seeded[field.name] = toInputValue(initialValues[field.name], field.kind);
  }
  return seeded;
}

export function MetricEntryForm({
  title,
  description,
  fields,
  initialValues,
  onSubmit,
}: {
  title: string;
  description: string;
  fields: FieldSpec[];
  /**
   * The day's stored values. Callers pass `key={date}` so switching days
   * remounts the form and re-seeds the inputs.
   */
  initialValues: Record<string, unknown>;
  onSubmit: (values: FieldValues) => Promise<unknown>;
}) {
  const toast = useToast();
  const [values, setValues] = useState(() => seedValues(fields, initialValues));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed: FieldValues = {};
    const nextErrors: Record<string, string> = {};

    for (const field of fields) {
      const raw = (values[field.name] ?? "").trim();
      if (raw.length === 0) {
        continue;
      }
      if (field.kind === "select") {
        parsed[field.name] = raw;
        continue;
      }
      if (field.kind === "pace") {
        const seconds = parsePaceToSeconds(raw);
        if (seconds === undefined) {
          nextErrors[field.name] = "Use M:SS or seconds";
          continue;
        }
        parsed[field.name] = seconds;
        continue;
      }
      const numeric = Number(raw);
      if (!Number.isFinite(numeric)) {
        nextErrors[field.name] = "Must be a number";
        continue;
      }
      if (field.min !== undefined && numeric < field.min) {
        nextErrors[field.name] = `Must be at least ${field.min}`;
        continue;
      }
      if (field.max !== undefined && numeric > field.max) {
        nextErrors[field.name] = `Must be at most ${field.max}`;
        continue;
      }
      parsed[field.name] = numeric;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (Object.keys(parsed).length === 0) {
      toast({ tone: "info", title: "Nothing to save", body: "Fill in at least one field." });
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsed);
      toast({ tone: "success", title: `${title} saved` });
    } catch (error) {
      toast({
        tone: "error",
        title: `Could not save ${title.toLowerCase()}`,
        body: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-apex-border bg-apex-card rounded-2xl border p-6"
    >
      <div className="mb-5">
        <h2 className="text-base font-bold text-slate-100">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <label key={field.name} className="block">
            <span className="text-xs tracking-wide text-slate-400 uppercase">
              {field.label}
              {field.unit !== undefined && (
                <span className="ml-1 normal-case text-slate-500">
                  ({field.unit})
                </span>
              )}
            </span>
            {field.kind === "select" ? (
              <select
                value={values[field.name] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                className="border-apex-border focus:border-apex-cyan mt-2 w-full rounded-lg border bg-[#0a0e1a] px-3 py-2 text-slate-100 outline-none"
              >
                <option value="">—</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.kind === "pace" ? "text" : "number"}
                inputMode={field.kind === "pace" ? "text" : "decimal"}
                step={field.step ?? "any"}
                min={field.min}
                max={field.max}
                placeholder={field.kind === "pace" ? "M:SS" : undefined}
                value={values[field.name] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
                className="border-apex-border focus:border-apex-cyan mt-2 w-full rounded-lg border bg-[#0a0e1a] px-3 py-2 text-slate-100 outline-none"
              />
            )}
            {errors[field.name] !== undefined ? (
              <span className="text-apex-red mt-1 block text-xs">
                {errors[field.name]}
              </span>
            ) : (
              field.hint !== undefined && (
                <span className="mt-1 block text-xs text-slate-600">
                  {field.hint}
                </span>
              )
            )}
          </label>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-apex-cyan hover:bg-apex-cyan-bright flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#04121f] transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </button>
        <p className="text-xs text-slate-600">
          Blank fields are left unchanged.
        </p>
      </div>
    </form>
  );
}
