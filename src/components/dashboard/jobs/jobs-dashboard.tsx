"use client";

import React, { useState, useTransition } from "react";
import { JobRecord } from "@/lib/jobs-service";
import { ProfileCompletenessResult } from "@/lib/profile-utils";
import { JobsWelcomeBanner } from "./jobs-welcome-banner";
import { PlatformSelector } from "./platform-selector";
import { JobList } from "./job-list";
import { JobsSidebar } from "./jobs-sidebar";
import { JobsSkeleton } from "./jobs-skeleton";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobsDashboardProps {
  initialJobs: JobRecord[];
  initialCached: boolean;
  initialLastFetched: string | null;
  initialCounts: Record<string, number>;
  completeness: ProfileCompletenessResult;
  userName: string;
  targetRole: string;
  topSkills: string[];
  userLocation: string;
}

export function JobsDashboard({
  initialJobs,
  initialCached,
  initialLastFetched,
  initialCounts,
  completeness,
  userName,
  targetRole,
  topSkills,
  userLocation,
}: JobsDashboardProps) {
  const [jobs, setJobs] = useState<JobRecord[]>(initialJobs);
  const [isCached, setIsCached] = useState<boolean>(initialCached);
  const [lastFetched, setLastFetched] = useState<string | null>(initialLastFetched);
  const [platformCounts, setPlatformCounts] = useState<Record<string, number>>(initialCounts);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync Fresh Jobs from Brave API
  const handleSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/jobs?force=true", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error(`Failed to sync jobs (status ${res.status})`);
      }

      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
        setIsCached(Boolean(data.cached));
        setLastFetched(data.lastFetched || new Date().toISOString());
        if (data.platformCounts) {
          setPlatformCounts(data.platformCounts);
        }
      }
    } catch (err: any) {
      console.error("Error during manual job sync:", err);
      setErrorMessage(err?.message || "Failed to fetch live job feeds. Please check network or try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Optimistic Save Bookmark Toggle
  const handleToggleSave = async (jobId: string, currentSaved: boolean) => {
    const nextSaved = !currentSaved;

    // Optimistic state update
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
    } catch (err) {
      console.error("Save toggle error, rolling back:", err);
      // Revert
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, saved_status: currentSaved } : j))
      );
    }
  };

  // Optimistic Applied Toggle
  const handleToggleApplied = async (jobId: string, currentApplied: boolean) => {
    const nextApplied = !currentApplied;

    // Optimistic state update
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
    } catch (err) {
      console.error("Applied toggle error, rolling back:", err);
      // Revert
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, applied_status: currentApplied } : j))
      );
    }
  };

  const handleClearFilters = () => {
    setSelectedPlatform("all");
    setSearchQuery("");
  };

  return (
    <div className="space-y-8">
      {/* 1. Welcome Banner */}
      <JobsWelcomeBanner
        userName={userName}
        isSyncing={isSyncing}
        onSync={handleSync}
        lastFetched={lastFetched}
        isCached={isCached}
        totalMatches={jobs.length}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Error Alert if sync failed */}
      {errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button
            onClick={handleSync}
            size="sm"
            variant="outline"
            className="h-8 border-red-500/30 bg-red-500/20 text-red-200 hover:bg-red-500/30 text-xs font-semibold"
          >
            Retry Sync
          </Button>
        </div>
      )}

      {/* 2. Platform Selector (Greenhouse, Lever, Workable, Wellfound) */}
      <PlatformSelector
        selectedPlatform={selectedPlatform}
        onSelectPlatform={setSelectedPlatform}
        counts={platformCounts}
      />

      {/* 3. Main Split View: Job List (Left) + Right Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Columns: Top Job Matches Feed */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
              <span>Top Matched Roles</span>
              <span className="text-xs font-mono font-normal text-white/40">
                ({jobs.length} total)
              </span>
            </h2>
          </div>

          <JobList
            jobs={jobs}
            selectedPlatform={selectedPlatform}
            searchQuery={searchQuery}
            onClearFilters={handleClearFilters}
            onToggleSave={handleToggleSave}
            onToggleApplied={handleToggleApplied}
          />
        </div>

        {/* Right Sidebar: Profile Completeness & Recent Activity */}
        <div className="space-y-6 lg:sticky lg:top-8">
          <JobsSidebar
            completeness={completeness}
            jobs={jobs}
            targetRole={targetRole}
            topSkills={topSkills}
            location={userLocation}
            lastSynced={lastFetched}
          />
        </div>
      </div>
    </div>
  );
}
