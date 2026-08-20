/** Pulse placeholder matching MetricCard layout during Convex loads. */
export function MetricCardSkeleton() {
  return (
    <div className="border-apex-border bg-apex-card relative animate-pulse rounded-2xl border p-6">
      <div className="absolute top-4 right-4 h-9 w-9 rounded-lg bg-slate-800" />
      <div className="h-3 w-28 rounded bg-slate-800" />
      <div className="mt-3 h-9 w-24 rounded bg-slate-800" />
      <div className="mt-2 h-3 w-36 rounded bg-slate-800" />
    </div>
  );
}

export function MetricCardSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <MetricCardSkeleton key={index} />
      ))}
    </div>
  );
}
