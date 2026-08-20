import { MetricCardSkeletonGrid } from "@/components/MetricCardSkeleton";

export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-8 w-64 rounded bg-slate-800" />
      <div className="mb-2 h-4 w-48 rounded bg-slate-800" />
      <div className="mt-8">
        <MetricCardSkeletonGrid count={4} />
      </div>
    </div>
  );
}
