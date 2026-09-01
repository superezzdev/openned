import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSourcesLoading() {
  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 p-6 md:p-10 font-sans animate-pulse">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800/80">
          <div className="space-y-2">
            <Skeleton className="h-8 w-80 bg-slate-800 rounded-xl" />
            <Skeleton className="h-4 w-96 bg-slate-800/60 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 bg-slate-800 rounded-xl" />
            <Skeleton className="h-9 w-36 bg-emerald-500/20 rounded-xl" />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <Skeleton className="h-4 w-32 bg-slate-800 rounded" />
              <Skeleton className="h-8 w-20 bg-slate-800 rounded-lg" />
              <Skeleton className="h-3 w-40 bg-slate-800/60 rounded" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-6 space-y-4">
          <Skeleton className="h-10 w-full bg-slate-800/60 rounded-xl" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full bg-slate-800/30 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
