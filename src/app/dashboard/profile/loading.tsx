import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-pulse">
      {/* 1. Header Hero Card Skeleton */}
      <div className="bg-[#121214]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl space-y-6 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-4 sm:gap-5">
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-7 w-48 bg-white/10 rounded-xl" />
                <Skeleton className="h-5 w-24 bg-emerald-500/20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-60 bg-white/5 rounded-md" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-36 bg-white/5 rounded-2xl hidden sm:block" />
            <Skeleton className="h-10 w-32 bg-white/10 rounded-xl" />
          </div>
        </div>

        {/* 2. Stat Cards Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-20 bg-white/10 rounded" />
                <Skeleton className="w-6 h-6 rounded-lg bg-white/10" />
              </div>
              <Skeleton className="h-7 w-16 bg-white/10 rounded-lg" />
              <Skeleton className="h-3 w-28 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tab Container & Content Skeleton */}
      <div className="bg-[#121214]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl space-y-6 shadow-xl">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-white/10">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-9 w-24 sm:w-28 bg-white/10 rounded-xl shrink-0" />
          ))}
        </div>

        {/* Form Fields Skeleton */}
        <div className="space-y-6 pt-2">
          <div className="space-y-1">
            <Skeleton className="h-5 w-44 bg-white/10 rounded-md" />
            <Skeleton className="h-3.5 w-72 bg-white/5 rounded-md" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20 bg-white/10 rounded" />
              <Skeleton className="h-10 w-full bg-white/[0.04] rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-20 bg-white/10 rounded" />
              <Skeleton className="h-10 w-full bg-white/[0.04] rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 bg-white/10 rounded" />
              <Skeleton className="h-10 w-full bg-white/[0.04] rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 bg-white/10 rounded" />
              <Skeleton className="h-10 w-full bg-white/[0.04] rounded-xl" />
            </div>
          </div>

          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 bg-white/10 rounded" />
            <Skeleton className="h-24 w-full bg-white/[0.04] rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
