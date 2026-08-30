"use client";

import React from "react";
import {
  FileText,
  Briefcase,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  ChevronRight,
} from "lucide-react";
import { StatCard } from "./stat-card";
import { CircularProgress } from "./circular-progress";
import {
  calculateProfileCompleteness,
  ProfileDataInput,
} from "@/lib/profile-utils";

export interface ProfileStatsProps {
  data: ProfileDataInput;
  onSelectTab?: (
    tab: "overview" | "experience" | "education" | "skills" | "projects" | "certifications" | "links"
  ) => void;
  onNavigateResume?: () => void;
}

export function ProfileStats({
  data,
  onSelectTab,
  onNavigateResume,
}: ProfileStatsProps) {
  const completeness = calculateProfileCompleteness(data);

  const expCount = (data.experiences || []).filter(
    (e) => e.company_name?.trim() || e.job_title?.trim()
  ).length;

  const eduCount = (data.educations || []).filter(
    (e) => e.institution?.trim() || e.degree?.trim()
  ).length;

  const skillCount = (data.skills || []).filter((s) => s.trim().length > 0).length;

  const hasResume = (data.resumeCount || 0) > 0;

  // Variant for profile completeness badge
  let compBadgeVariant: "amber" | "blue" | "cyan" | "emerald" = "amber";
  if (completeness.percentage >= 85) compBadgeVariant = "emerald";
  else if (completeness.percentage >= 60) compBadgeVariant = "cyan";
  else if (completeness.percentage >= 35) compBadgeVariant = "blue";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
      {/* 1. Profile Completeness Card */}
      <StatCard
        title="Completeness"
        value={`${completeness.percentage}%`}
        subtitle={`${completeness.completedCount}/${completeness.totalCount} items completed`}
        badge={{
          text: completeness.level,
          variant: compBadgeVariant,
        }}
        progressSlot={
          <CircularProgress
            value={completeness.percentage}
            size={48}
            strokeWidth={5}
            color={completeness.strokeColor}
            showValue={false}
          >
            <span className="text-[11px] font-mono font-bold text-white">
              {completeness.percentage}%
            </span>
          </CircularProgress>
        }
        onClick={() => {
          if (completeness.missingItems.length > 0) {
            onSelectTab?.(completeness.missingItems[0].tabId);
          } else {
            onSelectTab?.("overview");
          }
        }}
        actionLabel={
          completeness.missingItems.length > 0
            ? `Next: Add ${completeness.missingItems[0].label}`
            : "Profile is 100% complete"
        }
        highlight
      />

      {/* 2. Resume Uploaded Status */}
      <StatCard
        title="Resume Status"
        value={hasResume ? "Uploaded" : "Missing"}
        subtitle={
          hasResume
            ? `${data.resumeCount} resume${(data.resumeCount || 0) > 1 ? "s" : ""} on file`
            : "No resume attached"
        }
        icon={hasResume ? FileText : UploadCloud}
        iconColor={hasResume ? "text-emerald-400" : "text-amber-400"}
        iconBgColor={
          hasResume
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-amber-500/10 border-amber-500/20"
        }
        badge={{
          text: hasResume ? "Active" : "Action Needed",
          variant: hasResume ? "emerald" : "amber",
        }}
        onClick={onNavigateResume}
        actionLabel={hasResume ? "Manage resumes" : "Upload resume"}
      />

      {/* 3. Work Experience Count */}
      <StatCard
        title="Work Experience"
        value={expCount}
        subtitle={
          expCount === 1 ? "1 Position logged" : `${expCount} Positions logged`
        }
        icon={Briefcase}
        iconColor="text-amber-400"
        iconBgColor="bg-amber-500/10 border-amber-500/20"
        badge={{
          text: expCount > 0 ? "Logged" : "Empty",
          variant: expCount > 0 ? "neutral" : "amber",
        }}
        onClick={() => onSelectTab?.("experience")}
        actionLabel={expCount > 0 ? "View & edit positions" : "Add position"}
      />

      {/* 4. Skills Count */}
      <StatCard
        title="Skills & Tech"
        value={skillCount}
        subtitle={
          skillCount === 1 ? "1 Skill tagged" : `${skillCount} Skills tagged`
        }
        icon={Sparkles}
        iconColor="text-cyan-400"
        iconBgColor="bg-cyan-500/10 border-cyan-500/20"
        badge={{
          text: skillCount >= 5 ? "Strong" : skillCount > 0 ? "Basic" : "Empty",
          variant: skillCount >= 5 ? "cyan" : "neutral",
        }}
        onClick={() => onSelectTab?.("skills")}
        actionLabel={skillCount > 0 ? "Edit skill tags" : "Add skills"}
      />

      {/* 5. Education Count */}
      <StatCard
        title="Education"
        value={eduCount}
        subtitle={
          eduCount === 1 ? "1 Degree / School" : `${eduCount} Degrees / Schools`
        }
        icon={GraduationCap}
        iconColor="text-indigo-400"
        iconBgColor="bg-indigo-500/10 border-indigo-500/20"
        badge={{
          text: eduCount > 0 ? "Verified" : "Empty",
          variant: eduCount > 0 ? "neutral" : "amber",
        }}
        onClick={() => onSelectTab?.("education")}
        actionLabel={eduCount > 0 ? "View education" : "Add education"}
      />
    </div>
  );
}
