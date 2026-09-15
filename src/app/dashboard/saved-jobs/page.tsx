import { redirect } from "next/navigation";
import { getAuthUser, getFullProfileData } from "@/lib/user-profile-loader";
import { fetchSavedJobs } from "@/lib/jobs-service";
import { SavedJobsDashboard } from "@/components/dashboard/jobs/saved-jobs-dashboard";

export const metadata = {
  title: "Saved Jobs | Openned",
  description: "View and track all your bookmarked jobs and live application progress.",
};

export default async function SavedJobsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/saved-jobs");
  }

  // 1. Fetch user display info
  const { displayName } = await getFullProfileData(user.id);

  // 2. Fetch all saved jobs and latest application status map from database
  const { jobs, applicationMap } = await fetchSavedJobs(user.id);

  return (
    <SavedJobsDashboard
      initialJobs={jobs}
      initialApplicationMap={applicationMap}
      userName={displayName}
    />
  );
}
