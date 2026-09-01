"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ApplicationStatus,
  APPLICATION_STATUS_CONFIG,
  ACTIVE_APPLICATION_STATUSES,
  PAUSED_APPLICATION_STATUSES,
  TERMINAL_APPLICATION_STATUSES,
  FAILURE_CODE_MESSAGES,
  FailureCode,
  MissingFieldInfo,
} from "@/lib/applications/types";
import {
  Bot, User, Building, Calendar, Clock, ChevronRight,
  Loader2, CheckCircle2, AlertCircle, AlertTriangle,
  ExternalLink, RefreshCw, Inbox, Eye, Filter, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApplicationProgress } from "./application-progress";
import { MissingProfileFieldsDialog } from "./missing-profile-fields-dialog";
import { ApplicationReviewDialog } from "./application-review-dialog";
import { ApplicationErrorCard } from "./application-error-card";

interface ApplicationRecord {
  id: string;
  job_id: string;
  status: string;
  source: string;
  platform?: string;
  apply_url?: string;
  failure_code?: string;
  error_message?: string;
  missing_fields?: MissingFieldInfo[];
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  canonical_jobs?: {
    title?: string;
    company_name?: string;
    company_logo?: string;
    job_url?: string;
  };
}

type StatusFilter = "all" | "active" | "pending" | "submitted" | "failed";

interface ApplicationsDashboardProps {
  initialApplications: ApplicationRecord[];
}

const FILTER_TABS: Array<{ id: StatusFilter; label: string; count?: number }> = [
  { id: "all", label: "All" },
  { id: "active", label: "In Progress" },
  { id: "pending", label: "Needs Action" },
  { id: "submitted", label: "Submitted" },
  { id: "failed", label: "Failed" },
];

export function ApplicationsDashboard({ initialApplications }: ApplicationsDashboardProps) {
  const [applications, setApplications] = useState<ApplicationRecord[]>(initialApplications);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [missingFieldsApp, setMissingFieldsApp] = useState<ApplicationRecord | null>(null);
  const [reviewApp, setReviewApp] = useState<ApplicationRecord | null>(null);

  // Poll for active applications
  const hasActiveApps = applications.some(a =>
    ACTIVE_APPLICATION_STATUSES.includes(a.status as ApplicationStatus)
  );

  const refreshApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/applications", { cache: "no-store" });
      if (res.ok) {
        const { applications: fresh } = await res.json();
        if (fresh) setApplications(fresh);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!hasActiveApps) return;
    const interval = setInterval(refreshApplications, 5000);
    return () => clearInterval(interval);
  }, [hasActiveApps, refreshApplications]);

  // Filter applications
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const status = app.status as ApplicationStatus;
      switch (filter) {
        case "active": return ACTIVE_APPLICATION_STATUSES.includes(status);
        case "pending": return PAUSED_APPLICATION_STATUSES.includes(status);
        case "submitted": return status === ApplicationStatus.SUBMITTED || status === ApplicationStatus.SUBMISSION_UNCONFIRMED;
        case "failed": return status === ApplicationStatus.FAILED || status === ApplicationStatus.CANCELLED;
        default: return true;
      }
    });
  }, [applications, filter]);

  // Counts for filter tabs
  const counts = useMemo(() => ({
    active: applications.filter(a => ACTIVE_APPLICATION_STATUSES.includes(a.status as ApplicationStatus)).length,
    pending: applications.filter(a => PAUSED_APPLICATION_STATUSES.includes(a.status as ApplicationStatus)).length,
    submitted: applications.filter(a => [ApplicationStatus.SUBMITTED, ApplicationStatus.SUBMISSION_UNCONFIRMED].includes(a.status as ApplicationStatus)).length,
    failed: applications.filter(a => [ApplicationStatus.FAILED, ApplicationStatus.CANCELLED].includes(a.status as ApplicationStatus)).length,
  }), [applications]);

  const handleRetry = async (app: ApplicationRecord) => {
    try {
      // Re-create the application from scratch
      await fetch(`/api/applications/${app.id}/cancel`, { method: "POST" });
      const createRes = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: app.job_id, apply_url: app.apply_url, source: "ai_agent" }),
      });
      if (createRes.ok) {
        const { application } = await createRes.json();
        await fetch(`/api/applications/${application.id}/start`, { method: "POST" });
        await refreshApplications();
      }
    } catch (err) {
      console.error("Retry failed:", err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-400" />
            </div>
            Applications
          </h1>
          <p className="text-sm text-white/40 mt-1">
            {applications.length} total · {counts.active} in progress · {counts.submitted} submitted
          </p>
        </div>
        <Button
          onClick={refreshApplications}
          size="sm"
          variant="outline"
          className="h-8 border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTER_TABS.map(tab => {
          const count = tab.id !== "all" ? counts[tab.id as keyof typeof counts] : applications.length;
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
                isActive
                  ? "border-violet-500/40 bg-violet-500/15 text-violet-300"
                  : "border-white/8 bg-white/[0.03] text-white/50 hover:bg-white/[0.06] hover:text-white/70"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive ? "bg-violet-500/30 text-violet-200" : "bg-white/8 text-white/40"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Applications list */}
      {filteredApplications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
            <Inbox className="w-7 h-7 text-white/20" />
          </div>
          <div>
            <p className="text-white/60 font-semibold">No applications {filter !== "all" ? `in this category` : "yet"}</p>
            <p className="text-white/30 text-sm mt-1">
              {filter === "all"
                ? "Use the AI agent to start applying to jobs."
                : "Switch to 'All' to see all applications."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map(app => (
            <ApplicationCard
              key={app.id}
              application={app}
              onMissingFields={() => setMissingFieldsApp(app)}
              onReview={() => setReviewApp(app)}
              onRetry={() => handleRetry(app)}
            />
          ))}
        </div>
      )}

      {/* Missing Fields Dialog */}
      {missingFieldsApp && (
        <MissingProfileFieldsDialog
          open={!!missingFieldsApp}
          onOpenChange={(open) => !open && setMissingFieldsApp(null)}
          applicationId={missingFieldsApp.id}
          jobTitle={missingFieldsApp.canonical_jobs?.title || "this job"}
          companyName={missingFieldsApp.canonical_jobs?.company_name || "this company"}
          missingFields={missingFieldsApp.missing_fields || []}
          onSuccess={async () => {
            setMissingFieldsApp(null);
            await refreshApplications();
          }}
        />
      )}

      {/* Review Dialog */}
      {reviewApp && (
        <ApplicationReviewDialog
          open={!!reviewApp}
          onOpenChange={(open) => !open && setReviewApp(null)}
          applicationId={reviewApp.id}
          jobTitle={reviewApp.canonical_jobs?.title || "this job"}
          companyName={reviewApp.canonical_jobs?.company_name || "this company"}
          platform={reviewApp.platform}
          fields={[]}
          onConfirm={async () => {
            setReviewApp(null);
            await refreshApplications();
          }}
        />
      )}
    </div>
  );
}

// ─── Single Application Card ────────────────────────────────────────────────

interface ApplicationCardProps {
  application: ApplicationRecord;
  onMissingFields: () => void;
  onReview: () => void;
  onRetry: () => void;
}

function ApplicationCard({ application: app, onMissingFields, onReview, onRetry }: ApplicationCardProps) {
  const status = app.status as ApplicationStatus;
  const config = APPLICATION_STATUS_CONFIG[status] || APPLICATION_STATUS_CONFIG[ApplicationStatus.QUEUED];
  const isActive = ACTIVE_APPLICATION_STATUSES.includes(status);
  const isPaused = PAUSED_APPLICATION_STATUSES.includes(status);
  const isFailed = status === ApplicationStatus.FAILED;

  const jobTitle = app.canonical_jobs?.title || "Unknown Job";
  const companyName = app.canonical_jobs?.company_name || "Unknown Company";
  const companyLogo = app.canonical_jobs?.company_logo;
  const jobUrl = app.canonical_jobs?.job_url || app.apply_url;

  const createdAt = new Date(app.created_at);
  const timeAgo = formatTimeAgo(createdAt);

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 transition-all ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-4">
        {/* Company logo */}
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
          {companyLogo ? (
            <img src={companyLogo} alt={companyName} className="w-full h-full object-contain p-1" />
          ) : (
            <span className="text-slate-800 font-bold text-sm">
              {companyName.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-white text-sm leading-snug truncate">{jobTitle}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-xs text-white/50">{companyName}</span>
                {app.platform && (
                  <span className="text-[10px] text-white/30 font-mono">· {app.platform}</span>
                )}
                <span className="text-[10px] text-white/25">· {timeAgo}</span>
              </div>
            </div>

            {/* Source badge */}
            <div className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${config.color} ${config.bgColor} ${config.borderColor}`}>
              {app.source === "ai_agent" ? (
                <><Bot className="w-2.5 h-2.5" />AI</>
              ) : (
                <><User className="w-2.5 h-2.5" />Manual</>
              )}
            </div>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2">
            {isActive && <Loader2 className={`w-3.5 h-3.5 animate-spin ${config.color} shrink-0`} />}
            {isPaused && status !== ApplicationStatus.AWAITING_USER_REVIEW && (
              <AlertTriangle className={`w-3.5 h-3.5 ${config.color} shrink-0`} />
            )}
            {status === ApplicationStatus.SUBMITTED && (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            )}
            {isFailed && <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
            <span className={`text-xs font-semibold ${config.color}`}>{config.label}</span>
            <span className="text-xs text-white/30 hidden sm:inline">{config.description}</span>
          </div>

          {/* Progress bar for active statuses */}
          {isActive && (
            <ApplicationProgress status={status} compact />
          )}

          {/* Failed error */}
          {isFailed && (
            <div className="pt-1">
              <ApplicationErrorCard
                failureCode={app.failure_code}
                errorMessage={app.error_message}
                applyUrl={jobUrl}
                onRetry={onRetry}
              />
            </div>
          )}

          {/* Action buttons for paused statuses */}
          {isPaused && (
            <div className="flex gap-2 pt-1">
              {(status === ApplicationStatus.MISSING_PROFILE_INFO || status === ApplicationStatus.AWAITING_USER_INPUT) && (
                <Button
                  onClick={onMissingFields}
                  size="sm"
                  className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold"
                >
                  <User className="w-3 h-3 mr-1.5" />
                  {status === ApplicationStatus.AWAITING_USER_INPUT ? "Answer Questions" : "Fill Missing Info"}
                </Button>
              )}
              {status === ApplicationStatus.AWAITING_USER_REVIEW && (
                <Button
                  onClick={onReview}
                  size="sm"
                  className="h-7 text-xs bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-semibold"
                >
                  <Eye className="w-3 h-3 mr-1.5" />
                  Review & Submit
                </Button>
              )}
              {status === ApplicationStatus.AWAITING_USER_ACTION && jobUrl && (
                <Button
                  size="sm"
                  onClick={() => window.open(jobUrl, "_blank", "noopener,noreferrer")}
                  className="h-7 text-xs bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 font-semibold"
                >
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  Apply Manually
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}
