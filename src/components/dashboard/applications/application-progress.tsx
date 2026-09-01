"use client";

import React from "react";
import { ApplicationStatus } from "@/lib/applications/types";
import {
  Search, FileText, Map, AlertCircle, CheckCircle2,
  Edit3, Eye, Send, Loader2, User
} from "lucide-react";

interface ApplicationProgressProps {
  status: ApplicationStatus;
  compact?: boolean;
}

const STAGES: Array<{
  statuses: ApplicationStatus[];
  label: string;
  icon: React.ElementType;
}> = [
  {
    statuses: [ApplicationStatus.QUEUED],
    label: "Queued",
    icon: Loader2,
  },
  {
    statuses: [ApplicationStatus.DETECTING_PLATFORM, ApplicationStatus.DETECTING_FORM],
    label: "Detecting Form",
    icon: Search,
  },
  {
    statuses: [ApplicationStatus.MAPPING_FIELDS],
    label: "Mapping Fields",
    icon: Map,
  },
  {
    statuses: [ApplicationStatus.MISSING_PROFILE_INFO, ApplicationStatus.AWAITING_USER_INPUT],
    label: "Your Input",
    icon: User,
  },
  {
    statuses: [ApplicationStatus.READY_TO_APPLY, ApplicationStatus.FILLING_FORM],
    label: "Filling Form",
    icon: Edit3,
  },
  {
    statuses: [ApplicationStatus.AWAITING_USER_REVIEW],
    label: "Your Review",
    icon: Eye,
  },
  {
    statuses: [ApplicationStatus.SUBMITTING],
    label: "Submitting",
    icon: Send,
  },
  {
    statuses: [ApplicationStatus.SUBMITTED],
    label: "Submitted",
    icon: CheckCircle2,
  },
];

function getStageIndex(status: ApplicationStatus): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (STAGES[i].statuses.includes(status)) return i;
  }
  return -1;
}

export function ApplicationProgress({ status, compact = false }: ApplicationProgressProps) {
  if (status === ApplicationStatus.FAILED || status === ApplicationStatus.CANCELLED) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{status === ApplicationStatus.FAILED ? "Application failed" : "Application cancelled"}</span>
      </div>
    );
  }

  if (status === ApplicationStatus.MANUAL_APPLY_STARTED) return null;

  const currentStageIdx = getStageIndex(status);
  const visibleStages = STAGES.slice(0, -1); // Exclude "Submitted" from progress line

  if (compact) {
    const currentStage = STAGES[currentStageIdx];
    const Icon = currentStage?.icon || Loader2;
    const isActive = currentStageIdx < STAGES.length - 1 && currentStageIdx >= 0;
    return (
      <div className="flex items-center gap-1.5 text-xs text-white/50">
        <Icon className={`w-3 h-3 ${isActive ? "animate-pulse text-violet-400" : "text-white/30"}`} />
        <span>{currentStage?.label || "Processing"}</span>
        <span className="text-white/25">•</span>
        <span>{currentStageIdx + 1}/{STAGES.length}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>Progress</span>
        <span>{currentStageIdx + 1} / {STAGES.length}</span>
      </div>

      {/* Step dots with connecting lines — scrollable on mobile */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        <div className="flex items-center gap-0 min-w-[460px] sm:min-w-0">
          {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = idx < currentStageIdx;
          const isCurrent = idx === currentStageIdx;
          const isPending = idx > currentStageIdx;
          const isLast = idx === STAGES.length - 1;

          return (
            <React.Fragment key={stage.label}>
              {/* Step dot */}
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                    isDone
                      ? "border-emerald-500 bg-emerald-500/25"
                      : isCurrent
                      ? "border-violet-500 bg-violet-500/25 shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <Icon
                    className={`w-3 h-3 ${
                      isDone
                        ? "text-emerald-400"
                        : isCurrent
                        ? "text-violet-400" + (stage.icon === Loader2 ? " animate-spin" : " animate-pulse")
                        : "text-white/20"
                    }`}
                  />
                </div>
                <span
                  className={`text-[9px] text-center leading-tight max-w-[50px] ${
                    isCurrent ? "text-violet-400 font-semibold" : isDone ? "text-emerald-400" : "text-white/25"
                  }`}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-0.5 mb-5 rounded-full transition-all ${
                    isDone ? "bg-emerald-500/50" : isCurrent ? "bg-violet-500/30" : "bg-white/[0.05]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
        </div>
      </div>
    </div>
  );
}
