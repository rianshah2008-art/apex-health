"use client";

/**
 * Thin labeled progress track used on metric cards (steps, stress, heat, etc.).
 */
export function ProgressBar({
  value,
  max,
  color = "bg-apex-cyan",
  label,
}: {
  value: number;
  max: number;
  /** Tailwind background class for the filled portion. */
  color?: string;
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="w-full">
      {label !== undefined && (
        <p className="mb-1.5 text-xs text-slate-500">{label}</p>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(max)}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
