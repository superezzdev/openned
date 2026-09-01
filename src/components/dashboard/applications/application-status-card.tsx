"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ApplicationStatus, APPLICATION_STATUS_CONFIG, ACTIVE_APPLICATION_STATUSES, PAUSED_APPLICATION_STATUSES, TERMINAL_APPLICATION_STATUSES } from "@/lib/applications/types";
import { Loader2, ChevronRight, AlertTriangle, Clock } from "lucide-react";

interface ApplicationStatusCardProps {
  applicationId: string;
  initialStatus: ApplicationStatus;
  jobId: string;
  /** Called when user clicks "View Details" or action button */
  onViewDetails?: () => void;
  /** Notifies parent when polling detects a status transition */
  onStatusChange?: (newStatus: ApplicationStatus) => void;
}

const POLL_INTERVAL_MS = 4000;

export function ApplicationStatusCard({
  applicationId,
  initialStatus,
  jobId,
  onViewDetails,
  onStatusChange,
}: ApplicationStatusCardProps) {
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const shouldPoll = ACTIVE_APPLICATION_STATUSES.includes(status);

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/application`, { cache: "no-store" });
      if (res.ok) {
        const { application } = await res.json();
        if (application?.status && application.status !== status) {
          const nextStatus = application.status as ApplicationStatus;
          setStatus(nextStatus);
          setLastUpdated(new Date());
          onStatusChange?.(nextStatus);
        }
      }
    } catch {
      // Ignore poll errors silently
    }
  }, [jobId, status, onStatusChange]);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (!shouldPoll) return;

    const interval = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shouldPoll, pollStatus]);

  const config = APPLICATION_STATUS_CONFIG[status] || APPLICATION_STATUS_CONFIG[ApplicationStatus.QUEUED];
  const isActive = ACTIVE_APPLICATION_STATUSES.includes(status);
  const isPaused = PAUSED_APPLICATION_STATUSES.includes(status);
  const isTerminal = TERMINAL_APPLICATION_STATUSES.includes(status);

  return (
    <div
      onClick={onViewDetails}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${config.bgColor} ${config.borderColor} ${
        onViewDetails ? "cursor-pointer hover:brightness-110 active:scale-[0.99]" : ""
      }`}
    >
      {/* Status icon */}
      <div className={`shrink-0 ${config.color}`}>
        {isActive ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isPaused && status !== ApplicationStatus.AWAITING_USER_REVIEW ? (
          <AlertTriangle className="w-3.5 h-3.5" />
        ) : (
          <div className={`w-2 h-2 rounded-full ${config.color.replace("text-", "bg-")} ${isActive ? "animate-pulse" : ""}`} />
        )}
      </div>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        <span className={`font-semibold ${config.color}`}>{config.label}</span>
        {isActive && (
          <span className="ml-1 text-white/30">...</span>
        )}
      </div>

      {/* Action or view */}
      {onViewDetails && (
        <span className="shrink-0 flex items-center gap-0.5 text-white/40 hover:text-white/70 transition-colors">
          <ChevronRight className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}
