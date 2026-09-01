import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { calculateProfileCompleteness, ProfileDataInput, ProfileCompletenessResult } from "@/lib/profile-utils";
import type { UserProfileData } from "./jobs-constants";

export interface FullProfileResult {
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, any>;
  } | null;
  profile: any | null;
  skills: string[];
  rawSkills: any[];
  experiences: any[];
  educations: any[];
  projects: any[];
  certifications: any[];
  links: any[];
  resumes: any[];
  resumeCount: number;
  displayName: string;
  hasResume: boolean;
  hasProfileInfo: boolean;
  needsOnboarding: boolean;
  completeness: ProfileCompletenessResult;
  userProfileData: UserProfileData;
  targetRole: string;
}

/**
 * Memoized fetch for authenticated user during a single server render request lifecycle.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Memoized fetch for full user profile, child relations, and computed metrics.
 * Runs only ONCE per request across layout.tsx, page.tsx, and nested server functions.
 */
export const getFullProfileData = cache(async (userId: string): Promise<FullProfileResult> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch main profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  let rawSkills: any[] = [];
  let skills: string[] = [];
  let experiences: any[] = [];
  let educations: any[] = [];
  let projects: any[] = [];
  let certifications: any[] = [];
  let links: any[] = [];
  let resumes: any[] = [];
  let resumeCount = 0;

  if (profile?.id) {
    // 2. Fetch all child collections in parallel
    const [skillsRes, expRes, eduRes, projRes, certRes, linkRes, resumeRes] =
      await Promise.all([
        supabase.from("skills").select("*").eq("profile_id", profile.id),
        supabase
          .from("experiences")
          .select("*")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("educations")
          .select("*")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("*")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("certifications")
          .select("*")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("links")
          .select("*")
          .eq("profile_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("resumes")
          .select("*")
          .eq("profile_id", profile.id)
          .order("uploaded_at", { ascending: false }),
      ]);

    rawSkills = skillsRes.data || [];
    skills = rawSkills.map((s: any) => s.skill_name).filter(Boolean);
    experiences = expRes.data || [];
    educations = eduRes.data || [];
    projects = projRes.data || [];
    certifications = certRes.data || [];
    links = linkRes.data || [];
    resumes = resumeRes.data || [];
    resumeCount = resumes.length;
  }

  const hasResume = resumeCount > 0;
  const hasProfileInfo = Boolean(
    profile?.first_name && (profile?.summary || profile?.phone || profile?.location)
  );
  const needsOnboarding = !hasResume && !hasProfileInfo;

  const displayName =
    profile?.first_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.first_name ||
    user?.email?.split("@")[0] ||
    "User";

  const completenessInput: ProfileDataInput = {
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    email: profile?.email || user?.email,
    phone: profile?.phone,
    location: profile?.location,
    summary: profile?.summary,
    resumeCount,
    experiences,
    educations,
    skills,
    projects,
    certifications,
    links,
  };

  const completeness = calculateProfileCompleteness(completenessInput);

  const targetRole =
    experiences[0]?.job_title ||
    (profile?.summary?.toLowerCase().includes("ai")
      ? "AI/ML Engineer"
      : profile?.summary?.toLowerCase().includes("frontend")
      ? "Frontend Developer"
      : profile?.summary?.toLowerCase().includes("full stack")
      ? "Full Stack Engineer"
      : "Software Engineer");

  const userProfileData: UserProfileData = {
    userId,
    firstName: profile?.first_name || "",
    lastName: profile?.last_name || "",
    location: profile?.location || "",
    summary: profile?.summary || "",
    skills,
    experiences,
    educations,
  };

  return {
    user: user || null,
    profile,
    skills,
    rawSkills,
    experiences,
    educations,
    projects,
    certifications,
    links,
    resumes,
    resumeCount,
    displayName,
    hasResume,
    hasProfileInfo,
    needsOnboarding,
    completeness,
    userProfileData,
    targetRole,
  };
});
