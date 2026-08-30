import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { fetchCachedOrFreshJobs } from "@/lib/jobs-service";
import { calculateProfileCompleteness, ProfileDataInput } from "@/lib/profile-utils";
import { JobsDashboard } from "@/components/dashboard/jobs/jobs-dashboard";

export const metadata = {
  title: "Jobs | Openned",
  description: "AI job matching across Greenhouse, Lever, Workable, and Wellfound.",
};

export default async function JobsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/jobs");
  }

  // 1. Fetch Profile & Child Data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let skills: string[] = [];
  let experiences: any[] = [];
  let educations: any[] = [];
  let projects: any[] = [];
  let certifications: any[] = [];
  let links: any[] = [];
  let resumeCount = 0;

  if (profile?.id) {
    const [skillsRes, expRes, eduRes, projRes, certRes, linkRes, resumeRes] =
      await Promise.all([
        supabase.from("skills").select("skill_name").eq("profile_id", profile.id),
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
          .select("*", { count: "exact", head: true })
          .eq("profile_id", profile.id),
      ]);

    skills = (skillsRes.data || []).map((s: any) => s.skill_name).filter(Boolean);
    experiences = expRes.data || [];
    educations = eduRes.data || [];
    projects = projRes.data || [];
    certifications = certRes.data || [];
    links = linkRes.data || [];
    resumeCount = resumeRes.count || 0;
  }

  // 2. Compute Profile Completeness
  const completenessInput: ProfileDataInput = {
    firstName: profile?.first_name,
    lastName: profile?.last_name,
    email: profile?.email || user.email,
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

  // 3. Fetch Cached or Fresh Jobs for User (6h caching logic)
  const { jobs, cached, lastFetched, platformCounts } =
    await fetchCachedOrFreshJobs(user.id);

  const displayName =
    profile?.first_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.first_name ||
    user.email?.split("@")[0] ||
    "Candidate";

  const targetRole =
    experiences[0]?.job_title ||
    (profile?.summary?.toLowerCase().includes("ai")
      ? "AI/ML Engineer"
      : profile?.summary?.toLowerCase().includes("frontend")
      ? "Frontend Developer"
      : "Software Engineer");

  return (
    <JobsDashboard
      initialJobs={jobs}
      initialCached={cached}
      initialLastFetched={lastFetched}
      initialCounts={platformCounts}
      completeness={completeness}
      userName={displayName}
      targetRole={targetRole}
      topSkills={skills}
      userLocation={profile?.location || "Remote"}
    />
  );
}
