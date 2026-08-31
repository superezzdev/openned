"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  MapPin,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles,
  CheckCircle,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JobRecord } from "@/lib/jobs-service";

interface JobCardProps {
  job: JobRecord;
  onToggleSave: (jobId: string, currentSaved: boolean) => Promise<void>;
  onToggleApplied: (jobId: string, currentApplied: boolean) => Promise<void>;
}

export function JobCard({ job, onToggleSave, onToggleApplied }: JobCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      await onToggleSave(job.id, Boolean(job.saved_status));
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyClick = () => {
    window.open(job.job_url, "_blank", "noopener,noreferrer");
    if (!job.applied_status) {
      onToggleApplied(job.id, false);
    }
  };

  const handleToggleApplied = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsApplying(true);
    try {
      await onToggleApplied(job.id, Boolean(job.applied_status));
    } finally {
      setIsApplying(false);
    }
  };

  // Platform configuration with logos from public/platforms
  const platform = (job.platform || "greenhouse").toLowerCase();
  let platformLabel = "Greenhouse";
  let platformLogoSrc = "/platforms/Greenhouse.png";
  let platformBadgeStyle = "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";

  if (platform === "lever") {
    platformLabel = "Lever";
    platformLogoSrc = "/platforms/Lever.png";
    platformBadgeStyle = "bg-indigo-500/10 text-indigo-300 border-indigo-500/25";
  } else if (platform === "workable") {
    platformLabel = "Workable";
    platformLogoSrc = "/platforms/Workable.png";
    platformBadgeStyle = "bg-teal-500/10 text-teal-300 border-teal-500/25";
  } else if (platform === "wellfound") {
    platformLabel = "Wellfound";
    platformLogoSrc = "/platforms/wellfound.png";
    platformBadgeStyle = "bg-amber-500/10 text-amber-300 border-amber-500/25";
  } else if (platform === "ashby") {
    platformLabel = "Ashby";
    platformLogoSrc = "/platforms/Ashby.png";
    platformBadgeStyle = "bg-purple-500/10 text-purple-300 border-purple-500/25";
  } else if (platform === "smartrecruiters") {
    platformLabel = "SmartRecruiters";
    platformLogoSrc = "/platforms/SmartRecruiters.png";
    platformBadgeStyle = "bg-sky-500/10 text-sky-300 border-sky-500/25";
  } else if (platform === "ycombinator") {
    platformLabel = "Y Combinator";
    platformLogoSrc = "/platforms/ycombinator.svg";
    platformBadgeStyle = "bg-orange-500/10 text-orange-300 border-orange-500/25";
  }

  // Match score color & level
  const matchScore = job.match_score || 85;
  let matchColorClass = "text-emerald-400";
  let matchProgressGradient = "from-emerald-500 to-teal-400";
  let matchBorderClass = "border-emerald-500/20";
  let matchBg = "bg-emerald-500/10";

  if (matchScore < 80) {
    matchColorClass = "text-amber-400";
    matchProgressGradient = "from-amber-500 to-yellow-400";
    matchBorderClass = "border-amber-500/20";
    matchBg = "bg-amber-500/10";
  } else if (matchScore < 90) {
    matchColorClass = "text-cyan-400";
    matchProgressGradient = "from-cyan-500 to-blue-400";
    matchBorderClass = "border-cyan-500/20";
    matchBg = "bg-cyan-500/10";
  }

  // Clean company name for initial avatar
  const companyInitials = job.company
    ? job.company
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CO";

  return (
    <div
      className={cn(
        "group relative rounded-3xl border p-5 sm:p-6 transition-all duration-300 backdrop-blur-md overflow-hidden",
        job.saved_status
          ? "bg-[#111111]/90 border-white/20 shadow-xl"
          : "bg-[#0C0C0C]/80 border-white/10 hover:border-white/20 hover:bg-[#111111]/70 shadow-lg"
      )}
    >
      {/* Top Bar: Company Logo/Avatar, Titles, Match Percentage */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Company Avatar / Logo */}
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-white/10 to-white/5 border border-white/15 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner overflow-hidden">
            {job.company_logo && !imgError ? (
              <Image
                src={job.company_logo}
                alt={job.company}
                width={48}
                height={48}
                unoptimized
                className="object-cover w-full h-full"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <span>{companyInitials}</span>
              </div>
            )}
          </div>

          {/* Title & Company */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {/* Platform badge with authentic logo */}
              <span
                className={cn(
                  "text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 tracking-tight",
                  platformBadgeStyle
                )}
              >
                <span className="w-3.5 h-3.5 relative flex items-center justify-center shrink-0">
                  <Image
                    src={platformLogoSrc}
                    alt={platformLabel}
                    width={14}
                    height={14}
                    className="w-full h-full object-contain"
                  />
                </span>
                <span>{platformLabel}</span>
              </span>

              {job.applied_status && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 flex items-center gap-1 font-semibold">
                  <CheckCircle className="w-3 h-3" />
                  Applied
                </span>
              )}
            </div>

            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight leading-snug group-hover:text-white transition-colors line-clamp-1">
              {job.title}
            </h3>

            <div className="flex items-center gap-2 text-xs text-white/60 mt-0.5">
              <span className="font-medium text-white/80">{job.company}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-white/40" />
                {job.location || "Remote"}
              </span>
            </div>
          </div>
        </div>

        {/* Match Percentage Badge */}
        <div
          className={cn(
            "flex flex-col items-end shrink-0 px-3 py-1.5 rounded-2xl border backdrop-blur-sm",
            matchBg,
            matchBorderClass
          )}
        >
          <div className="flex items-center gap-1">
            <Sparkles className={cn("w-3.5 h-3.5", matchColorClass)} />
            <span className={cn("font-mono font-bold text-sm sm:text-base", matchColorClass)}>
              {matchScore}%
            </span>
          </div>
          <span className="text-[10px] text-white/50 font-medium">Match</span>
        </div>
      </div>

      {/* Match Score Progress Bar */}
      <div className="mt-4 space-y-1">
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", matchProgressGradient)}
            style={{ width: `${matchScore}%` }}
          />
        </div>
      </div>

      {/* Middle: Badges (Salary, Job Type, Experience) */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        {job.salary && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-emerald-300 font-mono font-medium">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            <span>{job.salary}</span>
          </div>
        )}

        {job.job_type && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/70">
            <Briefcase className="w-3 h-3 text-white/40" />
            <span>{job.job_type}</span>
          </div>
        )}

        {job.experience_level && (
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white/70">
            <Layers className="w-3 h-3 text-white/40" />
            <span>{job.experience_level}</span>
          </div>
        )}
      </div>

      {/* Description Snippet if present */}
      {job.description && (
        <p className="text-xs text-white/50 line-clamp-2 mt-3 leading-relaxed">
          {job.description}
        </p>
      )}

      {/* Tags List */}
      {job.tags && job.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
          {job.tags.slice(0, 5).map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-white/[0.05] border border-white/5 text-white/70"
            >
              {tag}
            </span>
          ))}
          {job.tags.length > 5 && (
            <span className="text-[10px] font-mono text-white/40 pl-1">
              +{job.tags.length - 5} more
            </span>
          )}
        </div>
      )}

      {/* Bottom Footer: Actions */}
      <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          {/* Bookmark / Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            title={job.saved_status ? "Remove bookmark" : "Save job"}
            className={cn(
              "h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-semibold transition-all cursor-pointer",
              job.saved_status
                ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                : "bg-white/[0.04] border-white/10 text-white/60 hover:text-white hover:bg-white/[0.08]"
            )}
          >
            {job.saved_status ? (
              <BookmarkCheck className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
            <span>{job.saved_status ? "Saved" : "Save"}</span>
          </button>

          {/* Mark Applied Toggle */}
          <button
            onClick={handleToggleApplied}
            disabled={isApplying}
            title={job.applied_status ? "Mark unapplied" : "Mark as applied"}
            className={cn(
              "h-9 px-3 rounded-xl border flex items-center gap-1.5 text-xs font-medium transition-all cursor-pointer",
              job.applied_status
                ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                : "bg-white/[0.02] border-white/5 text-white/40 hover:text-white hover:bg-white/[0.06]"
            )}
          >
            <CheckCircle
              className={cn("w-3.5 h-3.5", job.applied_status ? "text-blue-400" : "text-white/40")}
            />
            <span className="hidden sm:inline">
              {job.applied_status ? "Applied" : "Mark Applied"}
            </span>
          </button>
        </div>

        {/* Apply Now Button */}
        <Button
          onClick={handleApplyClick}
          className="relative group h-9 px-4 rounded-xl bg-white text-black font-semibold text-xs shadow-md hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>Apply Now</span>
          <ExternalLink className="w-3.5 h-3.5 text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
