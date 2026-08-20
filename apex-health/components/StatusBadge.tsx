"use client";

const STATUS_TONES: Record<string, string> = {
  Productive: "bg-apex-green/15 text-apex-green",
  Maintaining: "bg-apex-cyan/15 text-apex-cyan",
  Peaking: "bg-apex-purple/15 text-apex-purple",
  Recovery: "bg-apex-green/15 text-apex-green",
  Unproductive: "bg-apex-amber/15 text-apex-amber",
  Overreaching: "bg-apex-red/15 text-apex-red",
  Detraining: "bg-apex-amber/15 text-apex-amber",
  Balanced: "bg-apex-green/15 text-apex-green",
  Unbalanced: "bg-apex-amber/15 text-apex-amber",
  Low: "bg-apex-red/15 text-apex-red",
};

const FALLBACK_TONE = "bg-slate-800 text-slate-300";

/**
 * Colored pill for Training Status and HRV Status. Unknown strings still render
 * so a new Garmin phrase doesn't blank the card.
 */
export function StatusBadge({
  status,
  warning = false,
}: {
  status: string;
  /** HRV "Unbalanced"/"Low" also show a warning treatment. */
  warning?: boolean;
}) {
  const tone = STATUS_TONES[status] ?? FALLBACK_TONE;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${tone} ${
        warning ? "ring-apex-amber/40 ring-1" : ""
      }`}
    >
      {status}
    </span>
  );
}

export function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (["Productive", "Recovery", "Balanced", "Peaking"].includes(status)) {
    return "good";
  }
  if (["Unproductive", "Detraining", "Unbalanced", "Maintaining"].includes(status)) {
    return "warn";
  }
  if (["Overreaching", "Low"].includes(status)) {
    return "bad";
  }
  return "neutral";
}
