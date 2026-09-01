import { Skeleton } from "@/components/ui/skeleton";

export default function ResumeLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Bar Skeleton */}
      <div className="bg-[#121212]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-48 bg-white/10 rounded-xl" />
              <Skeleton className="h-5 w-16 bg-white/10 rounded-full" />
            </div>
            <Skeleton className="h-4 w-72 sm:w-96 bg-white/5 rounded-lg" />
          </div>
          <Skeleton className="h-10 w-40 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Quick Dropzone Skeleton */}
      <div className="border-2 border-dashed border-white/10 rounded-3xl p-6 sm:p-8 text-center bg-[#121212]/50 space-y-3">
        <Skeleton className="w-10 h-10 rounded-xl bg-white/10 mx-auto" />
        <Skeleton className="h-4 w-64 bg-white/10 rounded-md mx-auto" />
        <Skeleton className="h-3 w-80 sm:w-96 bg-white/5 rounded-md mx-auto" />
      </div>

      {/* Resumes List Skeleton */}
      <div className="bg-[#121212]/80 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <Skeleton className="h-4 w-36 bg-white/10 rounded-md" />
          <Skeleton className="h-4 w-44 bg-emerald-500/20 rounded-full" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1">
                <Skeleton className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-48 bg-white/10 rounded-md" />
                    <Skeleton className="h-4 w-14 bg-white/10 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-36 bg-white/5 rounded-md" />
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <Skeleton className="h-8 w-16 bg-white/10 rounded-lg" />
                <Skeleton className="h-8 w-24 bg-white/10 rounded-lg" />
                <Skeleton className="h-8 w-8 bg-white/10 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
