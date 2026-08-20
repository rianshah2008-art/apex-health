"use client";

const PHASE_TONES: Record<string, string> = {
  base: "bg-apex-cyan/15 text-apex-cyan",
  build: "bg-apex-amber/15 text-apex-amber",
  peak: "bg-apex-purple/15 text-apex-purple",
  taper: "bg-apex-green/15 text-apex-green",
  race_week: "bg-apex-red/15 text-apex-red",
};

const PHASE_LABELS: Record<string, string> = {
  base: "Base",
  build: "Build",
  peak: "Peak",
  taper: "Taper",
  race_week: "Race week",
};

export function PlanPhaseBadge({
  phase,
  highlighted = false,
}: {
  phase: string;
  highlighted?: boolean;
}) {
  const tone = PHASE_TONES[phase] ?? "bg-slate-800 text-slate-300";
  const label = PHASE_LABELS[phase] ?? phase.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide capitalize ${tone} ${
        highlighted ? "ring-apex-cyan/50 ring-2" : ""
      }`}
    >
      {label}
    </span>
  );
}

export function planPhaseLabel(phase: string): string {
  return PHASE_LABELS[phase] ?? phase.replace(/_/g, " ");
}
