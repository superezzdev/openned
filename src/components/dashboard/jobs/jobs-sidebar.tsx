"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Bookmark,
  Send,
  RefreshCw,
  FileText,
  UserCheck,
  Target,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Award,
  Link as LinkIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { CircularProgress } from "@/components/dashboard/circular-progress";
import { ProfileCompletenessResult, CompletenessItem } from "@/lib/profile-utils";
import { JobRecord } from "@/lib/jobs-service";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  type: "save" | "apply" | "sync" | "profile";
  title: string;
  subtitle: string;
  timeAgo: string;
  icon: React.ReactNode;
}

interface JobsSidebarProps {
  completeness: ProfileCompletenessResult;
  jobs: JobRecord[];
  targetRole: string;
  topSkills: string[];
  location: string;
  lastSynced: string | null;
}

// Icon helper for profile checklist tabs
function getTabIcon(tabId: CompletenessItem["tabId"]) {
  switch (tabId) {
    case "experience":
      return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
    case "education":
      return <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />;
    case "skills":
      return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
    case "projects":
      return <Zap className="w-3.5 h-3.5 text-emerald-400" />;
    case "certifications":
      return <Award className="w-3.5 h-3.5 text-purple-400" />;
    case "links":
      return <LinkIcon className="w-3.5 h-3.5 text-blue-400" />;
    case "overview":
    default:
      return <FileText className="w-3.5 h-3.5 text-emerald-400" />;
  }
}

export function JobsSidebar({
  completeness,
  jobs,
  targetRole,
  topSkills,
  location,
  lastSynced,
}: JobsSidebarProps) {
  // Synthesize recent activities from jobs and user actions
  const activities: ActivityItem[] = [];

  const savedJobs = jobs.filter((j) => j.saved_status).slice(0, 3);
  for (let i = 0; i < savedJobs.length; i++) {
    const sj = savedJobs[i];
    activities.push({
      id: `save-${sj.id || i}-${i}`,
      type: "save",
      title: `Saved ${sj.title}`,
      subtitle: sj.company,
      timeAgo: "Recently",
      icon: <Bookmark className="w-3.5 h-3.5 text-amber-400" />,
    });
  }

  const appliedJobs = jobs.filter((j) => j.applied_status).slice(0, 2);
  for (let i = 0; i < appliedJobs.length; i++) {
    const aj = appliedJobs[i];
    activities.push({
      id: `apply-${aj.id || i}-${i}`,
      type: "apply",
      title: `Applied to ${aj.company}`,
      subtitle: aj.title,
      timeAgo: "Tracked",
      icon: <Send className="w-3.5 h-3.5 text-blue-400" />,
    });
  }

  if (lastSynced) {
    activities.push({
      id: "sync-event",
      type: "sync",
      title: "Synced cross-platform feed",
      subtitle: "Greenhouse, Lever, Workable, Wellfound",
      timeAgo: "Automated",
      icon: <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />,
    });
  }

  if (activities.length === 0) {
    activities.push({
      id: "init",
      type: "profile",
      title: "AI Matching Initialized",
      subtitle: "Searching top roles tailored to your profile",
      timeAgo: "Today",
      icon: <Sparkles className="w-3.5 h-3.5 text-purple-400" />,
    });
  }

  // Completeness tier colors and description
  const isAllStar = completeness.percentage >= 85;
  const isStrong = completeness.percentage >= 60;

  return (
    <div className="space-y-6">
      {/* 1. Redesigned Profile Completeness Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#141414] via-[#0F0F0F] to-[#0A0A0A] p-5 sm:p-6 backdrop-blur-md shadow-2xl space-y-5">
        {/* Subtle Ambient Radial Glow */}
        <div
          className="absolute -top-12 -right-12 w-44 h-44 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500"
          style={{ backgroundColor: completeness.strokeColor }}
        />

        {/* Card Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center shadow-inner">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white tracking-tight leading-none">
                Profile Completeness
              </h3>
              <p className="text-[10px] text-white/40 font-mono mt-0.5">
                AI Match Precision
              </p>
            </div>
          </div>

          <span
            className={cn(
              "text-[10px] uppercase font-mono font-bold tracking-wider px-2.5 py-1 rounded-full border shadow-sm flex items-center gap-1",
              completeness.colorClass,
              isAllStar
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : isStrong
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                : "bg-amber-500/10 border-amber-500/30 text-amber-300"
            )}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: completeness.strokeColor }}
            />
            {completeness.level}
          </span>
        </div>

        {/* Visual Progress Area */}
        <div className="relative z-10 p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
          <div className="shrink-0 relative">
            <CircularProgress
              value={completeness.percentage}
              size={72}
              strokeWidth={7}
              color={completeness.strokeColor}
              showValue={false}
            >
              <div className="flex flex-col items-center justify-center">
                <span className="font-mono font-bold text-base text-white leading-none">
                  {completeness.percentage}%
                </span>
              </div>
            </CircularProgress>
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white truncate">
                {isAllStar
                  ? "Top-Tier Readiness"
                  : isStrong
                  ? "Strong Foundation"
                  : "Boost Match Score"}
              </span>
              <span className="text-[10px] font-mono text-white/40">
                {completeness.completedCount}/{completeness.totalCount} items
              </span>
            </div>

            <p className="text-[11px] text-white/50 leading-relaxed line-clamp-2">
              {isAllStar
                ? "Your profile provides high-signal criteria for accurate role recommendations."
                : "Add missing details to unlock higher precision and tailored salary matches."}
            </p>

            {/* Segmented mini progress bar */}
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${completeness.percentage}%`,
                  backgroundColor: completeness.strokeColor,
                }}
              />
            </div>
          </div>
        </div>

        {/* Actionable Missing Items Checklist */}
        {completeness.missingItems.length > 0 ? (
          <div className="relative z-10 space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono uppercase tracking-wider text-white/40 text-[10px]">
                Recommended Actions
              </span>
              <span className="text-[10px] text-amber-400/80 font-mono">
                +{completeness.missingItems.slice(0, 2).reduce((acc, i) => acc + i.weight, 0)}% boost
              </span>
            </div>

            <div className="space-y-1.5">
              {completeness.missingItems.slice(0, 2).map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/profile?tab=${item.tabId}`}
                  className="group flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/15 transition-all duration-200"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                      {getTabIcon(item.tabId)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/90 group-hover:text-white truncate">
                        {item.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      +{item.weight}%
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="relative z-10 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Profile 100% complete. AI matches are running at peak accuracy!</span>
          </div>
        )}

        {/* CTA Link */}
        <Link
          href="/dashboard/profile"
          className="relative z-10 w-full h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 flex items-center justify-center gap-2 text-xs font-semibold text-white transition-all cursor-pointer shadow-sm group"
        >
          <span>Complete Profile Details</span>
          <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* 2. Active AI Agent Search Criteria */}
      <div className="rounded-3xl border border-white/10 bg-[#0C0C0C]/90 p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-white">Agent Target Criteria</h3>
          </div>
          <Link
            href="/dashboard/profile"
            className="text-[10px] text-white/40 hover:text-white transition-colors"
          >
            Edit
          </Link>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <span className="text-[10px] font-mono text-white/40 uppercase">
              Targeted Role
            </span>
            <p className="font-semibold text-white mt-0.5 truncate">
              {targetRole || "Full-Stack Engineer"}
            </p>
          </div>

          <div>
            <span className="text-[10px] font-mono text-white/40 uppercase">
              Target Location
            </span>
            <p className="font-medium text-white/80 mt-0.5 truncate">
              {location || "Remote Worldwide"}
            </p>
          </div>

          {topSkills && topSkills.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-white/40 uppercase mb-1.5 block">
                High-Signal Tech Stack
              </span>
              <div className="flex flex-wrap gap-1">
                {topSkills.slice(0, 5).map((s, idx) => (
                  <span
                    key={`${s}-${idx}`}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Recent Activity Widget */}
      <div className="rounded-3xl border border-white/10 bg-[#0C0C0C]/90 p-5 sm:p-6 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Recent Activity</h3>
          </div>
          <span className="text-[10px] font-mono text-white/40">Live Feed</span>
        </div>

        <div className="space-y-3">
          {activities.map((act, idx) => (
            <div key={act.id || `act-${idx}`} className="flex items-start gap-3 text-xs">
              <div className="w-7 h-7 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                {act.icon}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-semibold text-white/90 truncate">{act.title}</p>
                <p className="text-[11px] text-white/40 truncate">{act.subtitle}</p>
              </div>
              <span className="text-[10px] font-mono text-white/30 shrink-0">
                {act.timeAgo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
