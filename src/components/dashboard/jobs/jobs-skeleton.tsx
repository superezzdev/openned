"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function JobsSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome Banner Skeleton */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/[0.04] via-white/[0.02] to-transparent p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-28 bg-white/10 rounded-full" />
              <Skeleton className="h-4 w-20 bg-emerald-500/20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-72 sm:w-96 bg-white/10 rounded-xl" />
            <Skeleton className="h-4 w-60 sm:w-80 bg-white/5 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32 bg-white/10 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Selectable Platform Cards Skeleton */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-36 bg-white/10 rounded-md" />
          <Skeleton className="h-3 w-20 bg-white/5 rounded-md" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="w-8 h-8 rounded-xl bg-white/10" />
                <Skeleton className="h-4 w-12 bg-white/10 rounded-full" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-24 bg-white/10 rounded-md" />
                <Skeleton className="h-3 w-16 bg-white/5 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: Job Cards (Left/Center) + Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Job Feed */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2">
            <Skeleton className="h-10 w-full sm:w-64 bg-white/10 rounded-xl" />
            <div className="flex gap-2 w-full sm:w-auto">
              <Skeleton className="h-10 w-24 bg-white/10 rounded-xl" />
              <Skeleton className="h-10 w-24 bg-white/10 rounded-xl" />
            </div>
          </div>

          {/* Job Card Listing Skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-4 sm:p-5 md:p-6 rounded-2xl sm:rounded-3xl border border-white/10 bg-[#111113]/80"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                {/* Left + Middle */}
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 shrink-0" />
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="space-y-1.5">
                      <Skeleton className="h-5 w-48 sm:w-64 bg-white/10 rounded-md" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-4 w-28 bg-white/5 rounded-md" />
                        <Skeleton className="h-4 w-16 bg-white/5 rounded-full" />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Skeleton className="h-3.5 w-16 bg-white/5 rounded-md" />
                      <Skeleton className="h-3.5 w-24 bg-white/5 rounded-md" />
                      <Skeleton className="h-3.5 w-20 bg-white/5 rounded-md" />
                      <Skeleton className="h-3.5 w-24 bg-white/5 rounded-md" />
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <Skeleton className="h-5 w-24 bg-white/5 rounded-lg" />
                      <Skeleton className="h-5 w-20 bg-white/5 rounded-lg" />
                      <Skeleton className="h-5 w-16 bg-white/5 rounded-lg" />
                    </div>
                  </div>
                </div>

                {/* Right: Match + Buttons */}
                <div className="flex items-center justify-between lg:justify-end gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/5 shrink-0">
                  <div className="space-y-1.5 min-w-[120px]">
                    <Skeleton className="h-5 w-20 bg-white/10 rounded-md" />
                    <Skeleton className="h-1.5 w-28 sm:w-32 bg-white/10 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-20 bg-emerald-500/20 rounded-md" />
                      <Skeleton className="h-2.5 w-16 bg-white/5 rounded-md" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0 min-w-[100px]">
                    <Skeleton className="h-9 sm:h-10 w-full bg-indigo-600/30 rounded-xl" />
                    <Skeleton className="h-8 sm:h-9 w-full bg-white/5 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right Sidebar Skeleton */}
        <div className="space-y-6">
          {/* Profile Completeness Card */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36 bg-white/10 rounded-md" />
              <Skeleton className="h-4 w-12 bg-white/10 rounded-md" />
            </div>
            <div className="flex items-center justify-center py-3">
              <Skeleton className="w-24 h-24 rounded-full bg-white/10" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full bg-white/5 rounded-md" />
              <Skeleton className="h-3 w-3/4 bg-white/5 rounded-md" />
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
            <Skeleton className="h-4 w-28 bg-white/10 rounded-md" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-lg bg-white/10 shrink-0" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3 w-3/4 bg-white/10 rounded-md" />
                    <Skeleton className="h-2 w-1/3 bg-white/5 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
