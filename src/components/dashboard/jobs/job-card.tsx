"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Bookmark,
  MapPin,
  DollarSign,
  Briefcase,
  Wifi,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobRecord } from "@/lib/jobs-constants";
import { ApplyMethodDialog } from "@/components/dashboard/applications/apply-method-dialog";
import { ApplicationStatusCard } from "@/components/dashboard/applications/application-status-card";
import { MissingProfileFieldsDialog } from "@/components/dashboard/applications/missing-profile-fields-dialog";
import { ApplicationReviewDialog } from "@/components/dashboard/applications/application-review-dialog";
import { ApplicationStatus, MissingFieldInfo } from "@/lib/applications/types";

interface ApplicationSummary {
  id: string;
  status: ApplicationStatus;
}

interface JobCardProps {
  job: JobRecord;
  onToggleSave: (jobId: string, currentSaved: boolean) => Promise<void>;
  onToggleApplied: (jobId: string, currentApplied: boolean) => Promise<void>;
  onNotRelevant?: (jobId: string) => Promise<void>;
  application?: ApplicationSummary | null;
}

// Compute human-readable relative time (e.g., "2h ago", "1d ago", "recently")
function formatPostedTime(
  postedAt?: string | null,
  fetchedAt?: string | null,
  createdAt?: string | null
): string {
  const dateStr = postedAt || fetchedAt || createdAt;
  if (!dateStr) return "recently";

  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (isNaN(diffMs) || diffMs < 0) return "recently";

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 60) {
      return diffMinutes <= 1 ? "just now" : `${diffMinutes}m ago`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "1d ago";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return "recently";
  }
}

export function JobCard({
  job,
  onToggleSave,
  onToggleApplied,
  onNotRelevant,
  application,
}: JobCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [currentApplication, setCurrentApplication] = useState<ApplicationSummary | null>(application || null);
  const [missingDialogOpen, setMissingDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<MissingFieldInfo[]>([]);
  const [reviewFields, setReviewFields] = useState<any[]>([]);

  // Sync application prop whenever updated asynchronously
  React.useEffect(() => {
    if (application) {
      setCurrentApplication(application);
    }
  }, [application]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaving(true);
    try {
      await onToggleSave(job.id, Boolean(job.saved_status));
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotRelevant = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onNotRelevant) return;
    setIsDismissing(true);
    try {
      await onNotRelevant(job.id);
    } finally {
      setIsDismissing(false);
    }
  };

  const handleApplyClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setApplyDialogOpen(true);
  };

  const handleApplicationCreated = (applicationId: string, status: ApplicationStatus) => {
    setCurrentApplication({ id: applicationId, status });
    // Update applied_status optimistically for manual applies
    if (status === ApplicationStatus.MANUAL_APPLY_STARTED && !job.applied_status) {
      onToggleApplied(job.id, false);
    }
  };

  const handleOpenApplicationDetails = async () => {
    if (!currentApplication) return;
    if (
      currentApplication.status === ApplicationStatus.MISSING_PROFILE_INFO ||
      currentApplication.status === ApplicationStatus.AWAITING_USER_INPUT
    ) {
      try {
        const res = await fetch(`/api/applications/${currentApplication.id}`);
        if (res.ok) {
          const data = await res.json();
          setMissingFields(data.application?.missing_fields || []);
        }
      } catch {}
      setMissingDialogOpen(true);
    } else if (currentApplication.status === ApplicationStatus.AWAITING_USER_REVIEW) {
      try {
        const res = await fetch(`/api/applications/${currentApplication.id}`);
        if (res.ok) {
          const data = await res.json();
          const forms = data.application?.application_forms || [];
          const formFields = forms[0]?.application_form_fields || [];
          setReviewFields(
            formFields.map((ff: any) => ({
              label: ff.label || ff.field_key,
              value: ff.current_value,
              status: ff.status === "MAPPED" ? "mapped" : ff.status === "MISSING" ? "missing" : "optional",
            }))
          );
        }
      } catch {}
      setReviewDialogOpen(true);
    }
  };

  // Platform branding configuration
  const platform = (job.platform || "greenhouse").toLowerCase();
  let platformLabel = "Greenhouse";
  let platformLogoSrc = "/platforms/Greenhouse.png";
  let platformBadgeStyle = "bg-emerald-500/10 text-emerald-300 border-emerald-500/25";

  if (platform.includes("linkedin")) {
    platformLabel = "LinkedIn";
    platformLogoSrc = "/platforms/linkedin.svg";
    platformBadgeStyle = "bg-sky-600/15 text-sky-300 border-sky-500/30";
  } else if (platform.includes("glassdoor")) {
    platformLabel = "Glassdoor";
    platformLogoSrc = "/platforms/glassdoor.svg";
    platformBadgeStyle = "bg-emerald-600/15 text-emerald-300 border-emerald-500/30";
  } else if (platform.includes("google")) {
    platformLabel = "Google Jobs";
    platformLogoSrc = "/platforms/googlejobs.svg";
    platformBadgeStyle = "bg-red-500/15 text-red-300 border-red-500/30";
  } else if (platform.includes("indeed")) {
    platformLabel = "Indeed";
    platformLogoSrc = "/platforms/indeed.svg";
    platformBadgeStyle = "bg-blue-600/15 text-blue-300 border-blue-500/30";
  } else if (platform.includes("workday")) {
    platformLabel = "Workday";
    platformLogoSrc = "/platforms/workday.svg";
    platformBadgeStyle = "bg-amber-600/15 text-amber-300 border-amber-500/30";
  } else if (platform.includes("jsearch")) {
    platformLabel = "JSearch";
    platformLogoSrc = "/platforms/jsearch.svg";
    platformBadgeStyle = "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
  } else if (platform.includes("jobicy")) {
    platformLabel = "Jobicy";
    platformLogoSrc = "/platforms/jobicy.svg";
    platformBadgeStyle = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
  } else if (platform.includes("remote")) {
    platformLabel = "Remote Jobs";
    platformLogoSrc = "/platforms/remotejobs.svg";
    platformBadgeStyle = "bg-violet-500/15 text-violet-300 border-violet-500/30";
  } else if (platform.includes("adzuna")) {
    platformLabel = "Adzuna";
    platformLogoSrc = "/platforms/adzuna.svg";
    platformBadgeStyle = "bg-blue-500/15 text-blue-300 border-blue-500/30";
  } else if (platform.includes("lever")) {
    platformLabel = "Lever";
    platformLogoSrc = "/platforms/Lever.png";
    platformBadgeStyle = "bg-indigo-500/10 text-indigo-300 border-indigo-500/25";
  } else if (platform.includes("workable")) {
    platformLabel = "Workable";
    platformLogoSrc = "/platforms/Workable.png";
    platformBadgeStyle = "bg-teal-500/10 text-teal-300 border-teal-500/25";
  } else if (platform.includes("wellfound")) {
    platformLabel = "Wellfound";
    platformLogoSrc = "/platforms/wellfound.png";
    platformBadgeStyle = "bg-amber-500/10 text-amber-300 border-amber-500/25";
  } else if (platform.includes("ashby")) {
    platformLabel = "Ashby";
    platformLogoSrc = "/platforms/Ashby.png";
    platformBadgeStyle = "bg-purple-500/10 text-purple-300 border-purple-500/25";
  } else if (platform.includes("smartrecruiters")) {
    platformLabel = "SmartRecruiters";
    platformLogoSrc = "/platforms/SmartRecruiters.png";
    platformBadgeStyle = "bg-sky-500/10 text-sky-300 border-sky-500/25";
  } else if (platform.includes("yc") || platform.includes("ycombinator")) {
    platformLabel = "Y Combinator";
    platformLogoSrc = "/platforms/ycombinator.svg";
    platformBadgeStyle = "bg-orange-500/10 text-orange-300 border-orange-500/25";
  } else if (platform.includes("freelancer")) {
    platformLabel = "Freelancer";
    platformLogoSrc = "/platforms/freelancer.svg";
    platformBadgeStyle = "bg-blue-400/15 text-blue-300 border-blue-400/30";
  } else if (platform.includes("internship")) {
    platformLabel = "Internships";
    platformLogoSrc = "/platforms/internships.svg";
    platformBadgeStyle = "bg-pink-500/15 text-pink-300 border-pink-500/30";
  }

  // 1. Sanitize Match Score: strip any existing % signs or non-digits to avoid "%%" bug
  const rawScore =
    typeof job.match_score === "string"
      ? parseInt((job.match_score as string).replace(/[^0-9]/g, ""), 10)
      : typeof job.match_score === "number"
      ? Math.round(job.match_score)
      : 85;

  const matchScore = isNaN(rawScore) || rawScore <= 0 ? 85 : Math.min(100, rawScore);

  // Match quality tier & dynamic colors
  let matchQualityText = "Excellent match";
  let matchQualityColor = "text-emerald-400";
  let matchProgressColor = "bg-emerald-500";

  if (matchScore >= 90) {
    matchQualityText = "Excellent match";
    matchQualityColor = "text-emerald-400";
    matchProgressColor = "bg-emerald-500";
  } else if (matchScore >= 80) {
    matchQualityText = "Strong match";
    matchQualityColor = "text-emerald-400";
    matchProgressColor = "bg-emerald-500";
  } else if (matchScore >= 70) {
    matchQualityText = "Good match";
    matchQualityColor = "text-teal-400";
    matchProgressColor = "bg-teal-500";
  } else {
    matchQualityText = "Fair match";
    matchQualityColor = "text-amber-400";
    matchProgressColor = "bg-amber-500";
  }

  // 2. Format Company Monogram Initials
  const companyInitials = (job.company || "Company")
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // 3. Format Salary Range nicely
  const salaryDisplay = useMemo(() => {
    if (job.salary && job.salary.trim()) {
      return job.salary.trim();
    }
    if (job.salary_min || job.salary_max) {
      const cur =
        job.salary_currency === "EUR"
          ? "€"
          : job.salary_currency === "GBP"
          ? "£"
          : "$";
      if (job.salary_min && job.salary_max) {
        const minK = Math.round(job.salary_min / 1000);
        const maxK = Math.round(job.salary_max / 1000);
        return `${cur}${minK}K – ${cur}${maxK}K`;
      }
      if (job.salary_min) return `From ${cur}${Math.round(job.salary_min / 1000)}K`;
      if (job.salary_max) return `Up to ${cur}${Math.round(job.salary_max / 1000)}K`;
    }
    return null;
  }, [job.salary, job.salary_min, job.salary_max, job.salary_currency]);

  // 4. Format Workplace / Remote Type
  const workplaceDisplay = useMemo(() => {
    const r = (job.remote_type || "").toLowerCase();
    const l = (job.location || "").toLowerCase();
    if (r === "remote" || l.includes("remote")) return "Remote";
    if (r === "hybrid" || l.includes("hybrid")) return "Hybrid";
    if (r === "onsite" || r === "on-site") return "On-site";
    return "Remote";
  }, [job.remote_type, job.location]);

  // 5. Format Experience Level
  const experienceDisplay = useMemo(() => {
    if (job.experience_level && job.experience_level.trim()) {
      const exp = job.experience_level.trim().toLowerCase();
      if (exp.includes("senior")) return "Senior Level";
      if (exp.includes("lead") || exp.includes("principal")) return "Lead / Principal";
      if (exp.includes("mid")) return "Mid Level";
      if (exp.includes("entry") || exp.includes("junior")) return "Entry Level";
      return job.experience_level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (job.job_type && job.job_type.trim()) {
      return job.job_type.trim();
    }
    return "Mid Level";
  }, [job.experience_level, job.job_type]);

  // 6. Format Location
  const locationDisplay = useMemo(() => {
    if (job.location && job.location.trim()) {
      // If location is purely "Remote", prioritize country or fallback
      if (job.location.toLowerCase() === "remote" && job.country && job.country !== "Worldwide") {
        return job.country;
      }
      return job.location;
    }
    if (job.country && job.country.trim() && job.country !== "Worldwide") {
      return job.country;
    }
    return "San Jose, CA";
  }, [job.location, job.country]);

  // 7. Parse Tags
  const { visibleTags, remainingCount } = useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(job.tags)) {
      list = job.tags.filter(Boolean);
    } else if (typeof job.tags === "string") {
      try {
        const parsed = JSON.parse(job.tags);
        if (Array.isArray(parsed)) list = parsed.filter(Boolean);
      } catch {
        list = (job.tags as string).split(",").map((s) => s.trim()).filter(Boolean);
      }
    }

    // Default fallback tags if none exist
    if (list.length === 0) {
      const titleWords = job.title.split(/\s+/).filter((w) => w.length > 3);
      list = titleWords.slice(0, 3);
    }

    return {
      visibleTags: list.slice(0, 3),
      remainingCount: Math.max(0, list.length - 3),
    };
  }, [job.tags, job.title]);

  const postedAgoText = formatPostedTime(job.posted_at, job.fetched_at, job.created_at);

  return (
    <div
      className={cn(
        "group relative rounded-2xl sm:rounded-3xl border p-4 sm:p-5 md:p-6 transition-all duration-200 backdrop-blur-md overflow-hidden",
        job.saved_status
          ? "bg-[#131316]/95 border-amber-500/30 shadow-xl shadow-amber-500/5"
          : "bg-[#111113]/90 hover:bg-[#151518] border-white/10 hover:border-white/20 shadow-lg shadow-black/30"
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left Section: Company Logo + Job Details */}
        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
          {/* Logo container: clean high-contrast rounded card */}
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-2 border border-white/20 shadow-sm flex items-center justify-center shrink-0 overflow-hidden">
            {job.company_logo && !imgError ? (
              <Image
                src={job.company_logo}
                alt={job.company}
                width={48}
                height={48}
                unoptimized
                className="object-contain w-full h-full"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="font-bold text-slate-800 text-sm sm:text-base tracking-tight select-none">
                {companyInitials}
              </span>
            )}
          </div>

          {/* Job Details: Title, Company, Metadata Row with Icons, Tags */}
          <div className="min-w-0 flex-1 space-y-2">
            {/* Title & Company */}
            <div>
              <h3
                onClick={handleApplyClick}
                className="font-bold text-base sm:text-lg text-white hover:text-indigo-400 transition-colors tracking-tight leading-snug cursor-pointer line-clamp-1"
                title={job.title}
              >
                {job.title}
              </h3>

              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs sm:text-sm text-white/60 font-medium truncate">
                  {job.company}
                </span>

                {/* Platform Badge */}
                <span
                  className={cn(
                    "text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shrink-0",
                    platformBadgeStyle
                  )}
                >
                  <Image
                    src={platformLogoSrc}
                    alt={platformLabel}
                    width={11}
                    height={11}
                    className="w-2.5 h-2.5 sm:w-3 sm:h-3 object-contain"
                  />
                  <span className="hidden sm:inline">{platformLabel}</span>
                </span>

                {/* Applied Badge */}
                {job.applied_status && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 inline-flex items-center gap-1 shrink-0">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Applied
                  </span>
                )}
              </div>
            </div>

            {/* Metadata Row with Icons (Remote, Salary, Experience, Location) */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/50">
              {/* Remote / Workplace */}
              <div className="inline-flex items-center gap-1.5 shrink-0">
                <Wifi className="w-3.5 h-3.5 text-white/40" />
                <span>{workplaceDisplay}</span>
              </div>

              {/* Salary Range */}
              {salaryDisplay && (
                <div className="inline-flex items-center gap-1.5 shrink-0">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-mono text-emerald-300 font-medium">
                    {salaryDisplay}
                  </span>
                </div>
              )}

              {/* Experience Level */}
              <div className="inline-flex items-center gap-1.5 shrink-0">
                <Briefcase className="w-3.5 h-3.5 text-white/40" />
                <span>{experienceDisplay}</span>
              </div>

              {/* Location */}
              <div className="inline-flex items-center gap-1.5 shrink-0">
                <MapPin className="w-3.5 h-3.5 text-white/40" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                  {locationDisplay}
                </span>
              </div>
            </div>

            {/* Recommendation Reason Banner */}
            {((job.reasons && job.reasons.length > 0) || job.explanation) && (
              <div className="mt-2 p-2 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20 flex items-start gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-snug">
                  <span className="font-semibold text-indigo-300">Why recommended: </span>
                  <span className="text-white/80">
                    {job.explanation || job.reasons?.join(" • ")}
                  </span>
                </div>
              </div>
            )}

            {/* Skills & Requirements Row */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {/* Matched skills */}
              {(job.matched_skills && job.matched_skills.length > 0
                ? job.matched_skills
                : visibleTags
              ).map((tag, idx) => (
                <span
                  key={`match-${tag}-${idx}`}
                  className="text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium inline-flex items-center gap-1"
                >
                  <span className="text-[10px]">✓</span>
                  {tag}
                </span>
              ))}

              {/* Missing requirements */}
              {job.missing_requirements &&
                job.missing_requirements.slice(0, 2).map((req, idx) => (
                  <span
                    key={`miss-${req}-${idx}`}
                    className="text-xs px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300/80 font-medium"
                    title={`Missing requirement: ${req}`}
                  >
                    Missing: {req}
                  </span>
                ))}

              {remainingCount > 0 && !job.matched_skills && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-white/[0.03] border border-white/5 text-white/40 font-mono">
                  +{remainingCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Match Score Block + Action Buttons */}
        <div className="flex items-center justify-between lg:justify-end gap-5 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/5 shrink-0">
          {/* Match Score & Progress */}
          <div className="space-y-1.5 min-w-[120px]">
            {/* Single % strictly formatted */}
            <div className="font-bold text-sm sm:text-base text-white tracking-tight">
              {matchScore}% Match
            </div>

            {/* Horizontal Progress Bar */}
            <div className="w-28 sm:w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", matchProgressColor)}
                style={{ width: `${matchScore}%` }}
              />
            </div>

            {/* Match Quality & Relative Time */}
            <div className="flex flex-col text-[11px] leading-tight">
              <span className={cn("font-medium", matchQualityColor)}>
                {job.match_level || matchQualityText}
              </span>
              <span className="text-white/40 text-[10px] mt-0.5">
                Posted {postedAgoText}
              </span>
            </div>
          </div>

          {/* Action Buttons Column */}
          <div className="flex flex-col gap-2 shrink-0 min-w-[120px] sm:min-w-[130px]">
            {currentApplication?.status === ApplicationStatus.SUBMITTED ? (
              <div className="h-9 sm:h-10 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 w-full">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Submitted</span>
              </div>
            ) : currentApplication?.status === ApplicationStatus.MISSING_PROFILE_INFO || currentApplication?.status === ApplicationStatus.AWAITING_USER_INPUT ? (
              <Button
                onClick={handleOpenApplicationDetails}
                className="h-9 sm:h-10 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer w-full"
              >
                Complete Info
              </Button>
            ) : currentApplication?.status === ApplicationStatus.AWAITING_USER_REVIEW ? (
              <Button
                onClick={handleOpenApplicationDetails}
                className="h-9 sm:h-10 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs sm:text-sm shadow-md transition-all cursor-pointer w-full"
              >
                Review & Submit
              </Button>
            ) : (
              <Button
                onClick={handleApplyClick}
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-xs sm:text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer w-full"
              >
                Apply Now
              </Button>
            )}

            <div className="flex items-center gap-1.5 w-full">
              {onNotRelevant && (
                <button
                  onClick={handleNotRelevant}
                  disabled={isDismissing}
                  className="h-8 sm:h-9 px-2 rounded-xl border border-white/10 bg-white/[0.03] text-white/40 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20 text-[11px] font-medium transition-all cursor-pointer flex-1 text-center truncate"
                  title="Not relevant to my verified profile"
                >
                  {isDismissing ? "..." : "Not Relevant"}
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  "h-8 sm:h-9 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-medium transition-all cursor-pointer flex-1",
                  job.saved_status
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                    : "bg-white/[0.04] border-white/15 text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                <Bookmark
                  className={cn(
                    "w-3.5 h-3.5",
                    job.saved_status ? "fill-amber-400 text-amber-400" : "text-white/60"
                  )}
                />
                <span>{job.saved_status ? "Saved" : "Save"}</span>
              </button>
            </div>

            {/* Application Status Card */}
            {currentApplication && (
              <ApplicationStatusCard
                applicationId={currentApplication.id}
                initialStatus={currentApplication.status}
                jobId={job.id}
                onViewDetails={handleOpenApplicationDetails}
                onStatusChange={(nextStatus) => {
                  setCurrentApplication((prev) => prev ? { ...prev, status: nextStatus } : null);
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Apply Method Dialog */}
      <ApplyMethodDialog
        open={applyDialogOpen}
        onOpenChange={setApplyDialogOpen}
        jobId={job.id}
        jobTitle={job.title}
        companyName={job.company}
        applyUrl={job.apply_url || job.source_url || job.job_url || ""}
        onApplicationCreated={handleApplicationCreated}
      />

      {/* Missing Profile Fields Dialog */}
      {currentApplication && (
        <MissingProfileFieldsDialog
          open={missingDialogOpen}
          onOpenChange={setMissingDialogOpen}
          applicationId={currentApplication.id}
          jobTitle={job.title}
          companyName={job.company}
          missingFields={missingFields}
          onSuccess={() => {
            setCurrentApplication((prev) => prev ? { ...prev, status: ApplicationStatus.QUEUED } : null);
          }}
        />
      )}

      {/* Application Review Dialog */}
      {currentApplication && (
        <ApplicationReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          applicationId={currentApplication.id}
          jobTitle={job.title}
          companyName={job.company}
          platform={job.platform}
          fields={reviewFields}
          onConfirm={() => {
            setCurrentApplication((prev) => prev ? { ...prev, status: ApplicationStatus.SUBMITTING } : null);
          }}
          onStatusChange={(newStatus) => {
            setCurrentApplication((prev) => prev ? { ...prev, status: newStatus } : null);
          }}
        />
      )}
    </div>
  );
}
