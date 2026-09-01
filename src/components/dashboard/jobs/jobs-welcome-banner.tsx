"use client";

import React from "react";
import { Sparkles, RefreshCw, Radio, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface JobsWelcomeBannerProps {
  userName: string;
  isSyncing: boolean;
  onSync: () => void;
  lastFetched: string | null;
  isCached: boolean;
  totalMatches: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function JobsWelcomeBanner({
  userName,
  isSyncing,
  onSync,
  lastFetched,
  isCached,
  totalMatches,
  searchQuery,
  onSearchChange,
}: JobsWelcomeBannerProps) {
  // Format last synced text
  const formatSyncTime = () => {
    if (!lastFetched) return "Just now";
    try {
      const diffMinutes = Math.floor(
        (new Date().getTime() - new Date(lastFetched).getTime()) / (1000 * 60)
      );
      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      const diffHours = Math.floor(diffMinutes / 60);
      return `${diffHours}h ago`;
    } catch {
      return "Recently";
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#121212] via-[#0C0C0C] to-[#080808] p-6 sm:p-8 shadow-2xl">
      {/* Background Decorative Mesh Glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Text & Badges */}
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold tracking-wide">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              AI Agent Active
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white/70 text-xs font-mono">
              <Clock className="w-3 h-3 text-white/50" />
              {isCached ? `Cached • ${formatSyncTime()}` : `Live • ${formatSyncTime()}`}
            </span>

            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
              {totalMatches} Roles Discovered
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>Welcome back, {userName || "Candidate"}</span>
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            </h1>
            <p className="text-sm sm:text-base text-white/60 mt-1 leading-relaxed">
              Curated roles aggregated from <span className="text-sky-400 font-medium">LinkedIn</span>,{" "}
              <span className="text-emerald-400 font-medium">Glassdoor</span>,{" "}
              <span className="text-red-400 font-medium">Google Jobs</span>,{" "}
              <span className="text-blue-400 font-medium">Indeed</span>,{" "}
              <span className="text-amber-400 font-medium">Workday</span>, and 14+ top job providers.
            </p>

          </div>
        </div>

        {/* Right: Actions & Sync */}
        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
          <Button
            onClick={onSync}
            disabled={isSyncing}
            className={cn(
              "relative group h-11 px-5 rounded-2xl bg-white text-black font-semibold shadow-lg shadow-white/10 hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2",
              isSyncing && "opacity-80"
            )}
          >
            <RefreshCw
              className={cn(
                "w-4 h-4 text-black transition-transform duration-700",
                isSyncing ? "animate-spin" : "group-hover:rotate-180"
              )}
            />
            <span>{isSyncing ? "Syncing Brave API..." : "Sync Latest Roles"}</span>
          </Button>

          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Quick search title, tech..."
              className="pl-9 h-11 bg-white/[0.04] border-white/10 text-white placeholder:text-white/35 rounded-2xl focus-visible:ring-emerald-500/30 text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
