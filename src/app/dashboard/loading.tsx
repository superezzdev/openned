import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8 space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 bg-white/10 rounded-xl" />
          <Skeleton className="h-4 w-96 bg-white/5 rounded-lg" />
        </div>
      </div>

      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 rounded-3xl border border-white/10 bg-white/[0.02] space-y-4"
          >
            <Skeleton className="w-10 h-10 rounded-xl bg-white/10" />
            <Skeleton className="h-5 w-36 bg-white/10 rounded-md" />
            <Skeleton className="h-3.5 w-full bg-white/5 rounded-md" />
            <Skeleton className="h-3.5 w-3/4 bg-white/5 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
