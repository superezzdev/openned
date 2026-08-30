"use client";

import React, { useState, useMemo } from "react";
import {
  Briefcase,
  Bookmark,
  Sparkles,
  CheckCircle,
  ArrowUpDown,
  FilterX,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JobRecord } from "@/lib/jobs-service";
import { JobCard } from "./job-card";

interface JobListProps {
  jobs: JobRecord[];
  selectedPlatform: string;
  searchQuery: string;
  onClearFilters: () => void;
  onToggleSave: (jobId: string, currentSaved: boolean) => Promise<void>;
  onToggleApplied: (jobId: string, currentApplied: boolean) => Promise<void>;
}

type TabFilter = "all" | "saved" | "high_match" | "applied";
type SortOption = "match_desc" | "newest";

export function JobList({
  jobs,
  selectedPlatform,
  searchQuery,
  onClearFilters,
  onToggleSave,
  onToggleApplied,
}: JobListProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("match_desc");

  // Filtering & Sorting
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // 1. Platform Filter
    if (selectedPlatform && selectedPlatform !== "all") {
      result = result.filter(
        (j) => j.platform?.toLowerCase() === selectedPlatform.toLowerCase()
      );
    }

    // 2. Tab Filter
    if (activeTab === "saved") {
      result = result.filter((j) => Boolean(j.saved_status));
    } else if (activeTab === "applied") {
      result = result.filter((j) => Boolean(j.applied_status));
    } else if (activeTab === "high_match") {
      result = result.filter((j) => (j.match_score || 0) >= 90);
    }

    // 3. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((j) => {
        const titleMatch = j.title?.toLowerCase().includes(q);
        const compMatch = j.company?.toLowerCase().includes(q);
        const locMatch = j.location?.toLowerCase().includes(q);
        const tagsMatch = (j.tags || []).some((t) => t.toLowerCase().includes(q));
        return titleMatch || compMatch || locMatch || tagsMatch;
      });
    }

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === "match_desc") {
        return (b.match_score || 0) - (a.match_score || 0);
      }
      return (
        new Date(b.fetched_at || b.created_at).getTime() -
        new Date(a.fetched_at || a.created_at).getTime()
      );
    });

    return result;
  }, [jobs, selectedPlatform, activeTab, searchQuery, sortBy]);

  const savedCount = jobs.filter((j) => j.saved_status).length;
  const appliedCount = jobs.filter((j) => j.applied_status).length;
  const highMatchCount = jobs.filter((j) => (j.match_score || 0) >= 90).length;

  const tabs = [
    { id: "all", label: "All Matches", count: jobs.length, icon: Layers },
    { id: "high_match", label: "Top Match (>90%)", count: highMatchCount, icon: Sparkles },
    { id: "saved", label: "Saved Roles", count: savedCount, icon: Bookmark },
    { id: "applied", label: "Applied", count: appliedCount, icon: CheckCircle },
  ];

  return (
    <div className="space-y-5">
      {/* Top Controls: Tabs & Sort Dropdown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-white/10">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap",
                  isActive
                    ? "bg-white text-black shadow-md font-bold"
                    : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isActive ? "text-black" : "text-white/50")} />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                    isActive ? "bg-black/10 text-black font-bold" : "bg-white/10 text-white/60"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-white/40" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-[#121212] border border-white/10 text-xs text-white/80 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-white/30 cursor-pointer font-medium"
          >
            <option value="match_desc">Highest Match %</option>
            <option value="newest">Latest Discovered</option>
          </select>
        </div>
      </div>

      {/* Active Filter Indicators */}
      {(selectedPlatform !== "all" || searchQuery.trim()) && (
        <div className="flex items-center justify-between bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-white/70">
            <span className="text-white/40">Filtered by:</span>
            {selectedPlatform !== "all" && (
              <span className="font-semibold text-emerald-400 capitalize">
                Platform: {selectedPlatform}
              </span>
            )}
            {searchQuery.trim() && (
              <span className="font-medium text-white/90">
                &ldquo;{searchQuery}&rdquo;
              </span>
            )}
            <span className="text-white/40">({filteredJobs.length} results)</span>
          </div>

          <button
            onClick={onClearFilters}
            className="text-white/50 hover:text-white flex items-center gap-1 font-medium cursor-pointer transition-colors"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      )}

      {/* Job Card Feed */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-4">
          {filteredJobs.map((job, idx) => (
            <JobCard
              key={job.id || `${job.platform}-${job.job_url || idx}-${idx}`}
              job={job}
              onToggleSave={onToggleSave}
              onToggleApplied={onToggleApplied}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.01] p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-white/40">
            <Briefcase className="w-7 h-7" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-base text-white">No roles found</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              {activeTab === "saved"
                ? "You haven't bookmarked any jobs yet. Click the 'Save' button on any role to keep track of it."
                : activeTab === "applied"
                ? "No applications recorded yet. When you apply to a role, mark it as applied to track status."
                : "No matching roles found for your current filter criteria. Try clearing search filters or syncing fresh roles."}
            </p>
          </div>

          <Button
            onClick={onClearFilters}
            variant="outline"
            className="h-9 px-4 rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/10 text-xs font-semibold"
          >
            Reset Filters
          </Button>
        </div>
      )}
    </div>
  );
}
