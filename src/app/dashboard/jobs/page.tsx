import { redirect } from "next/navigation";
import { getAuthUser, getFullProfileData } from "@/lib/user-profile-loader";
import { fetchCachedOrFreshJobs } from "@/lib/jobs-service";
import { JobsDashboard } from "@/components/dashboard/jobs/jobs-dashboard";

export const metadata = {
  title: "Jobs | Openned",
  description:
    "AI job matching across LinkedIn, Glassdoor, Google Jobs, Indeed, Workday, JSearch, and 14+ top platforms.",
};

export default async function JobsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/jobs");
  }

  // 1. Fetch memoized full profile data (cached across layout & page in 1 pass)
  const {
    profile,
    skills,
    displayName,
    completeness,
    targetRole,
    userProfileData,
  } = await getFullProfileData(user.id);

  // 2. Fetch Cached or Fresh Jobs for User with preloaded profile
  const { jobs, cached, lastFetched, platformCounts } =
    await fetchCachedOrFreshJobs(user.id, {}, userProfileData);

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
