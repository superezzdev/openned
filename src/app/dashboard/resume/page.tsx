import { redirect } from "next/navigation";
import { getAuthUser, getFullProfileData } from "@/lib/user-profile-loader";
import { ResumeList } from "@/components/dashboard/resume-list";

export const metadata = {
  title: "Resume | Openned",
  description: "Manage tailored resume versions and uploaded career assets.",
};

export default async function ResumePage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/resume");
  }

  // Fetch memoized full profile data (returns resumes instantly from shared request cache)
  const { resumes } = await getFullProfileData(user.id);

  return (
    <ResumeList initialResumes={resumes} userEmail={user.email || ""} />
  );
}
