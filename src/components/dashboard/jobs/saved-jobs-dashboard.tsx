"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bookmark,
  Briefcase,
  Search,
  Filter,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { JobRecord } from "@/lib/jobs-constants";
import { JobCard } from "./job-card";
import {
  ApplicationStatus,
  ACTIVE_APPLICATION_STATUSES,
  PAUSED_APPLICATION_STATUSES,
} from "@/lib/applications/types";

interface SavedJobsDashboardProps {
  initialJobs: JobRecord[];
  initialApplicationMap: Record<string, { id: string; status: ApplicationStatus }>;
  userName?: string;
}

type StatusFilter = "all" | "in_progress" | "action_needed" | "submitted" | "not_applied";

export function SavedJobsDashboard({
  initialJobs,
  initialApplicationMap,
  userName = "there",
}: SavedJobsDashboardProps) {
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [applicationMap, setApplicationMap] = useState<
    Record<string, { id: string; status: ApplicationStatus }>
  >(initialApplicationMap);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync state if initial props change
  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    setApplicationMap(initialApplicationMap);
  }, [initialApplicationMap]);

  // Fetch updated saved jobs and live application statuses
  const refreshSavedJobs = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/jobs/saved", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.jobs) {
          setJobs(data.jobs);
        }
        if (data.applicationMap) {
          setApplicationMap(data.applicationMap);
        }
      }
    } catch (err) {
      console.warn("Failed to refresh saved jobs:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Listen to application or saved updates across the app
  useEffect(() => {
    const handleUpdate = () => {
      refreshSavedJobs();
    };

    window.addEventListener("applications-updated", handleUpdate);
    window.addEventListener("saved-jobs-updated", handleUpdate);
    return () => {
      window.removeEventListener("applications-updated", handleUpdate);
      window.removeEventListener("saved-jobs-updated", handleUpdate);
    };
  }, [refreshSavedJobs]);

  // If there are in-progress applications, poll periodically
  const hasActiveApplications = useMemo(() => {
    return Object.values(applicationMap).some((app) =>
      ACTIVE_APPLICATION_STATUSES.includes(app.status)
    );
  }, [applicationMap]);

  useEffect(() => {
    if (!hasActiveApplications) return;
    const interval = setInterval(refreshSavedJobs, 5000);
    return () => clearInterval(interval);
  }, [hasActiveApplications, refreshSavedJobs]);

  // Toggle Save (Bookmark)
  const handleToggleSave = async (jobId: string, currentSaved: boolean) => {
    const nextSaved = !currentSaved;

    // Optimistically update
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, saved_status: nextSaved } : j))
    );

    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          saved_status: nextSaved,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update save status");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("saved-jobs-updated"));
      }
    } catch (err) {
      console.error("Error toggling saved status:", err);
      // Rollback
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, saved_status: currentSaved } : j))
      );
    }
  };

  // Toggle Applied status
  const handleToggleApplied = async (jobId: string, currentApplied: boolean) => {
    const nextApplied = !currentApplied;

    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, applied_status: nextApplied } : j))
    );

    try {
      const res = await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          applied_status: nextApplied,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update applied status");
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("applications-updated"));
      }
    } catch (err) {
      console.error("Error toggling applied status:", err);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, applied_status: currentApplied } : j))
      );
    }
  };

  // Dismiss / Mark Not Relevant
  const handleNotRelevant = async (jobId: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));

    try {
      await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          not_relevant: true,
          hidden: true,
        }),
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("saved-jobs-updated"));
      }
    } catch (err) {
      console.error("Error hiding job:", err);
    }
  };

  // Filter and Search
  const filteredJobs = useMemo(() => {
    let list = jobs.filter((j) => Boolean(j.saved_status));

    // Status Filter
    if (statusFilter !== "all") {
      list = list.filter((j) => {
        const app = applicationMap[j.id];
        if (statusFilter === "in_progress") {
          return app && ACTIVE_APPLICATION_STATUSES.includes(app.status);
        }
        if (statusFilter === "action_needed") {
          return app && PAUSED_APPLICATION_STATUSES.includes(app.status);
        }
        if (statusFilter === "submitted") {
          return app?.status === ApplicationStatus.SUBMITTED || (!app && j.applied_status);
        }
        if (statusFilter === "not_applied") {
          return !j.applied_status && !app;
        }
        return true;
      });
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((j) => {
        const title = (j.title || "").toLowerCase();
        const company = (j.company || "").toLowerCase();
        const loc = (j.location || "").toLowerCase();
        const platform = (j.platform || "").toLowerCase();
        const tags = (j.tags || []).join(" ").toLowerCase();
        return (
          title.includes(q) ||
          company.includes(q) ||
          loc.includes(q) ||
          platform.includes(q) ||
          tags.includes(q)
        );
      });
    }

    return list;
  }, [jobs, applicationMap, statusFilter, searchQuery]);

  // Calculate status counts
  const savedJobsOnly = useMemo(() => jobs.filter((j) => Boolean(j.saved_status)), [jobs]);
  const inProgressCount = useMemo(
    () =>
      savedJobsOnly.filter((j) => {
        const app = applicationMap[j.id];
        return app && ACTIVE_APPLICATION_STATUSES.includes(app.status);
      }).length,
    [savedJobsOnly, applicationMap]
  );
  const actionNeededCount = useMemo(
    () =>
      savedJobsOnly.filter((j) => {
        const app = applicationMap[j.id];
        return app && PAUSED_APPLICATION_STATUSES.includes(app.status);
      }).length,
    [savedJobsOnly, applicationMap]
  );
  const submittedCount = useMemo(
    () =>
      savedJobsOnly.filter((j) => {
        const app = applicationMap[j.id];
        return app?.status === ApplicationStatus.SUBMITTED || (!app && j.applied_status);
      }).length,
    [savedJobsOnly, applicationMap]
  );

  return (
    <div className="space-y-8">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#181622]/90 via-[#121118]/80 to-[#0d0c11]/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
              <Bookmark className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Bookmarked Roles</span>
              <span className="bg-amber-500/20 px-2 py-0.2 rounded-full font-mono font-bold">
                {savedJobsOnly.length}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Saved Jobs
            </h1>
            <p className="text-sm text-white/60 max-w-xl leading-relaxed">
              Review and manage your bookmarked positions. Track each job’s live application
              lifecycle, complete missing fields, or submit applications directly.
            </p>
          </div>

          {/* Right Action: Refresh & Explore Jobs */}
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={refreshSavedJobs}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="h-10 px-4 rounded-xl border-white/10 bg-white/[0.04] hover:bg-white/10 text-white/80 hover:text-white text-xs font-semibold cursor-pointer transition-all"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5 mr-2", isRefreshing && "animate-spin text-amber-400")}
              />
              <span>Refresh Status</span>
            </Button>

            <Link href="/dashboard/jobs">
              <Button
                size="sm"
                className="h-10 px-4 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Explore More Jobs</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by title, company, skills..."
            className="h-11 pl-10 pr-4 rounded-2xl bg-white/[0.03] border-white/10 text-white placeholder:text-white/40 focus:border-amber-500/40 text-xs"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer",
              statusFilter === "all"
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
            )}
          >
            All Saved ({savedJobsOnly.length})
          </button>

          {inProgressCount > 0 && (
            <button
              onClick={() => setStatusFilter("in_progress")}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
                statusFilter === "in_progress"
                  ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                  : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              In Progress ({inProgressCount})
            </button>
          )}

          {actionNeededCount > 0 && (
            <button
              onClick={() => setStatusFilter("action_needed")}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
                statusFilter === "action_needed"
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Needs Action ({actionNeededCount})
            </button>
          )}

          <button
            onClick={() => setStatusFilter("submitted")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer flex items-center gap-1.5",
              statusFilter === "submitted"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
            )}
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            Applied ({submittedCount})
          </button>

          <button
            onClick={() => setStatusFilter("not_applied")}
            className={cn(
              "px-3 py-2 rounded-xl text-xs font-semibold border transition-all shrink-0 cursor-pointer",
              statusFilter === "not_applied"
                ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.06]"
            )}
          >
            Ready to Apply ({savedJobsOnly.length - submittedCount - inProgressCount})
          </button>
        </div>
      </div>

      {/* 3. Job Cards List */}
      {filteredJobs.length > 0 ? (
        <div className="space-y-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onToggleSave={handleToggleSave}
              onToggleApplied={handleToggleApplied}
              onNotRelevant={handleNotRelevant}
              application={applicationMap[job.id] || null}
            />
          ))}
        </div>
      ) : savedJobsOnly.length === 0 ? (
        /* Empty State: No Saved Jobs at all */
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.01] p-12 text-center space-y-5">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/5">
            <Bookmark className="w-8 h-8" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-bold text-lg text-white">No saved jobs yet</h3>
            <p className="text-xs sm:text-sm text-white/50 leading-relaxed">
              When exploring recommended roles on the Jobs page or application views, click{" "}
              <span className="font-semibold text-amber-300">Save</span> on any role to bookmark
              it here. Your bookmarked jobs will stay synchronized with live application progress.
            </p>
          </div>

          <div className="pt-2">
            <Link href="/dashboard/jobs">
              <Button className="h-10 px-6 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer inline-flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                <span>Browse Curated Jobs</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Empty Search / Filter State */
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.01] p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-white/40">
            <Inbox className="w-7 h-7" />
          </div>

          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-bold text-base text-white">No matching saved jobs</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              No saved jobs matched your search query &ldquo;{searchQuery}&rdquo; or the selected status filter.
            </p>
          </div>

          <Button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            variant="outline"
            className="h-9 px-4 rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/10 text-xs font-semibold cursor-pointer"
          >
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}
