"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Briefcase,
  Bookmark,
  Sparkles,
  CheckCircle,
  ArrowUpDown,
  FilterX,
  Layers,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobRecord, ActiveJobFilters } from "@/lib/jobs-constants";
import { JobCard } from "./job-card";
import { JobsFilterBar } from "./jobs-filter-bar";

interface JobListProps {
  jobs: JobRecord[];
  selectedPlatform: string;
  searchQuery: string;
  onClearFilters: () => void;
  onToggleSave: (jobId: string, currentSaved: boolean) => Promise<void>;
  onToggleApplied: (jobId: string, currentApplied: boolean) => Promise<void>;
}

type TabFilter = "all" | "saved" | "high_match" | "applied";
type SortOption = "match_desc" | "newest" | "salary_desc";

const INITIAL_FILTERS: ActiveJobFilters = {
  country: "all",
  jobType: "all",
  workplace: "all",
  experienceLevel: "all",
  salaryMin: "all",
  datePosted: "all",
};

const PAGE_SIZE = 16;

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
  const [filters, setFilters] = useState<ActiveJobFilters>(INITIAL_FILTERS);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Reset pagination when filter criteria change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedPlatform, activeTab, searchQuery, filters, sortBy]);

  const handleFilterChange = <K extends keyof ActiveJobFilters>(
    key: K,
    value: ActiveJobFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetAllFilters = () => {
    setFilters(INITIAL_FILTERS);
    onClearFilters();
  };

  // Comprehensive Multi-dimensional Filtering & Sorting
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // 1. Platform Filter
    if (selectedPlatform && selectedPlatform !== "all") {
      const p = selectedPlatform.toLowerCase();
      result = result.filter((j) => {
        const jp = (j.platform || "").toLowerCase();
        return jp === p || jp.includes(p) || p.includes(jp);
      });
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
        const descMatch = j.description?.toLowerCase().includes(q);
        const tagsMatch = (j.tags || []).some((t) => t.toLowerCase().includes(q));
        return titleMatch || compMatch || locMatch || descMatch || tagsMatch;
      });
    }

    // 4. Country Filter
    if (filters.country && filters.country !== "all") {
      const c = filters.country.toLowerCase();
      result = result.filter((j) => {
        const jc = (j.country || "").toLowerCase();
        const jl = (j.location || "").toLowerCase();

        if (c === "remote") {
          return (
            jc.includes("remote") ||
            jc.includes("worldwide") ||
            jl.includes("remote") ||
            j.remote_type === "remote"
          );
        }
        if (c === "us") {
          return (
            jc.includes("united states") ||
            jc === "us" ||
            jl.includes("usa") ||
            jl.includes(", us") ||
            jl.includes("san francisco") ||
            jl.includes("new york") ||
            jl.includes("austin") ||
            jl.includes("seattle")
          );
        }
        if (c === "gb") {
          return (
            jc.includes("united kingdom") ||
            jc === "gb" ||
            jc === "uk" ||
            jl.includes("uk") ||
            jl.includes("london") ||
            jl.includes("manchester")
          );
        }
        if (c === "in") {
          return (
            jc.includes("india") ||
            jc === "in" ||
            jl.includes("india") ||
            jl.includes("bengaluru") ||
            jl.includes("bangalore") ||
            jl.includes("mumbai") ||
            jl.includes("delhi") ||
            jl.includes("hyderabad")
          );
        }
        if (c === "ca") {
          return (
            jc.includes("canada") ||
            jc === "ca" ||
            jl.includes("canada") ||
            jl.includes("toronto") ||
            jl.includes("vancouver") ||
            jl.includes("montreal")
          );
        }
        if (c === "de") {
          return (
            jc.includes("germany") ||
            jc === "de" ||
            jl.includes("germany") ||
            jl.includes("berlin") ||
            jl.includes("munich")
          );
        }
        if (c === "fr") {
          return (
            jc.includes("france") ||
            jc === "fr" ||
            jl.includes("france") ||
            jl.includes("paris")
          );
        }
        if (c === "au") {
          return (
            jc.includes("australia") ||
            jc === "au" ||
            jl.includes("australia") ||
            jl.includes("sydney") ||
            jl.includes("melbourne")
          );
        }
        if (c === "nl") {
          return (
            jc.includes("netherlands") ||
            jc === "nl" ||
            jl.includes("netherlands") ||
            jl.includes("amsterdam")
          );
        }
        if (c === "sg") {
          return jc.includes("singapore") || jc === "sg" || jl.includes("singapore");
        }
        return jc.includes(c) || jl.includes(c);
      });
    }

    // 5. Job Type Filter (Full-time, Contract, Internship, Part-time)
    if (filters.jobType && filters.jobType !== "all") {
      const jt = filters.jobType.toLowerCase();
      result = result.filter((j) => {
        const typeStr = (j.job_type || "").toLowerCase();
        const titleStr = (j.title || "").toLowerCase();
        const descStr = (j.description || "").toLowerCase();
        return (
          typeStr.includes(jt) ||
          titleStr.includes(jt) ||
          descStr.includes(jt)
        );
      });
    }

    // 6. Workplace / Remote Filter (Remote, Hybrid, On-site)
    if (filters.workplace && filters.workplace !== "all") {
      const wp = filters.workplace.toLowerCase();
      result = result.filter((j) => {
        if (wp === "remote") {
          return (
            j.remote_type === "remote" ||
            (j.location || "").toLowerCase().includes("remote") ||
            (j.title || "").toLowerCase().includes("remote")
          );
        }
        if (wp === "hybrid") {
          return (
            j.remote_type === "hybrid" ||
            (j.location || "").toLowerCase().includes("hybrid") ||
            (j.description || "").toLowerCase().includes("hybrid")
          );
        }
        if (wp === "onsite") {
          return (
            j.remote_type === "onsite" ||
            (j.location || "").toLowerCase().includes("on-site") ||
            (j.location || "").toLowerCase().includes("onsite") ||
            (j.location || "").toLowerCase().includes("in office")
          );
        }
        return true;
      });
    }

    // 7. Experience Level Filter
    if (filters.experienceLevel && filters.experienceLevel !== "all") {
      const exp = filters.experienceLevel.toLowerCase();
      result = result.filter((j) => {
        const level = (j.experience_level || "").toLowerCase();
        const title = (j.title || "").toLowerCase();
        if (exp === "junior") {
          return (
            level.includes("junior") ||
            level.includes("entry") ||
            title.includes("junior") ||
            title.includes("entry") ||
            title.includes("intern")
          );
        }
        if (exp === "mid") {
          return (
            level.includes("mid") ||
            (!title.includes("senior") &&
              !title.includes("lead") &&
              !title.includes("principal") &&
              !title.includes("junior"))
          );
        }
        if (exp === "senior") {
          return (
            level.includes("senior") ||
            title.includes("senior") ||
            title.includes("sr.") ||
            title.includes("sr ")
          );
        }
        if (exp === "lead") {
          return (
            level.includes("lead") ||
            level.includes("staff") ||
            title.includes("lead") ||
            title.includes("staff") ||
            title.includes("principal") ||
            title.includes("director")
          );
        }
        return level.includes(exp);
      });
    }

    // 8. Minimum Salary Filter
    if (filters.salaryMin && filters.salaryMin !== "all") {
      const targetMinK = parseInt(filters.salaryMin.replace("k", ""), 10) * 1000;
      result = result.filter((j) => {
        if (j.salary_min && j.salary_min > 0) {
          return j.salary_min >= targetMinK;
        }
        if (j.salary_max && j.salary_max > 0) {
          return j.salary_max >= targetMinK;
        }
        const match = (j.salary || "").match(/\$(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10) * 1000;
          return num >= targetMinK;
        }
        return true;
      });
    }

    // 9. Date Posted / Freshness Filter
    if (filters.datePosted && filters.datePosted !== "all") {
      const now = Date.now();
      const maxAgeMs =
        filters.datePosted === "24h"
          ? 24 * 60 * 60 * 1000
          : filters.datePosted === "3d"
          ? 3 * 24 * 60 * 60 * 1000
          : filters.datePosted === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;

      result = result.filter((j) => {
        const timeStr = j.posted_at || j.fetched_at || j.created_at;
        if (!timeStr) return true;
        const jobTime = new Date(timeStr).getTime();
        return !isNaN(jobTime) ? now - jobTime <= maxAgeMs : true;
      });
    }

    // 10. Sorting
    result.sort((a, b) => {
      if (sortBy === "match_desc") {
        return (b.match_score || 0) - (a.match_score || 0);
      }
      if (sortBy === "salary_desc") {
        const salA = a.salary_min || a.salary_max || 0;
        const salB = b.salary_min || b.salary_max || 0;
        return salB - salA;
      }
      return (
        new Date(b.posted_at || b.fetched_at || b.created_at).getTime() -
        new Date(a.posted_at || a.fetched_at || a.created_at).getTime()
      );
    });

    return result;
  }, [jobs, selectedPlatform, activeTab, searchQuery, filters, sortBy]);

  const savedCount = jobs.filter((j) => j.saved_status).length;
  const appliedCount = jobs.filter((j) => j.applied_status).length;
  const highMatchCount = jobs.filter((j) => (j.match_score || 0) >= 90).length;

  const tabs = [
    { id: "all", label: "All Matches", count: jobs.length, icon: Layers },
    { id: "high_match", label: "Top Match (>90%)", count: highMatchCount, icon: Sparkles },
    { id: "saved", label: "Saved Roles", count: savedCount, icon: Bookmark },
    { id: "applied", label: "Applied", count: appliedCount, icon: CheckCircle },
  ];

  // Progressive rendering slice
  const displayedJobs = filteredJobs.slice(0, visibleCount);
  const hasMore = visibleCount < filteredJobs.length;

  return (
    <div className="space-y-6">
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
            <option value="salary_desc">Highest Salary</option>
          </select>
        </div>
      </div>

      {/* Multi-Dimensional Filter Bar */}
      <JobsFilterBar
        jobs={jobs}
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetAllFilters}
        totalFilteredCount={filteredJobs.length}
      />

      {/* Active Platform / Search Indicator if applicable */}
      {(selectedPlatform !== "all" || searchQuery.trim()) && (
        <div className="flex items-center justify-between bg-white/[0.02] border border-white/10 rounded-2xl px-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-white/70">
            <span className="text-white/40">Scope:</span>
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
            <span className="text-white/40">({filteredJobs.length} matches)</span>
          </div>

          <button
            onClick={onClearFilters}
            className="text-white/50 hover:text-white flex items-center gap-1 font-medium cursor-pointer transition-colors"
          >
            <FilterX className="w-3.5 h-3.5" />
            <span>Clear Scope</span>
          </button>
        </div>
      )}

      {/* Job Card Feed with Progressive Rendering */}
      {displayedJobs.length > 0 ? (
        <div className="space-y-4">
          {displayedJobs.map((job, idx) => (
            <JobCard
              key={job.id || `${job.platform}-${job.job_url || idx}-${idx}`}
              job={job}
              onToggleSave={onToggleSave}
              onToggleApplied={onToggleApplied}
            />
          ))}

          {/* Progressive Load More Action */}
          {hasMore && (
            <div className="pt-4 pb-2 flex flex-col items-center justify-center gap-2">
              <Button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                variant="outline"
                className="h-10 px-6 rounded-xl border-white/15 bg-white/[0.04] hover:bg-white/10 text-white text-xs font-semibold shadow-lg shadow-black/40 transition-all cursor-pointer hover:scale-[1.02] active:scale-95 flex items-center gap-2"
              >
                <span>
                  Load More Roles (+{Math.min(PAGE_SIZE, filteredJobs.length - visibleCount)})
                </span>
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] text-white/40 font-mono">
                Showing {displayedJobs.length} of {filteredJobs.length} matching roles
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.01] p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-white/40">
            <Briefcase className="w-7 h-7" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-base text-white">No roles match your filter criteria</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              {activeTab === "saved"
                ? "You haven't bookmarked any jobs matching these filters yet. Click 'Save' on any role to bookmark it."
                : activeTab === "applied"
                ? "No applied roles found matching these filters."
                : "No matching roles found for your selected country, job type, or salary range. Try loosening or resetting your filters."}
            </p>
          </div>

          <Button
            onClick={handleResetAllFilters}
            variant="outline"
            className="h-9 px-4 rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/10 text-xs font-semibold"
          >
            Reset All Filters
          </Button>
        </div>
      )}
    </div>
  );
}
