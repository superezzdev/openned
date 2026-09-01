import { redirect } from "next/navigation";
import { getAuthUser, getFullProfileData } from "@/lib/user-profile-loader";
import { ProfileEditor } from "@/components/dashboard/profile-editor";

export const metadata = {
  title: "Profile | Openned",
  description: "View and edit your career profile, experience, and contact details.",
};

export default async function ProfilePage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/profile");
  }

  // Fetch memoized full profile data
  const {
    profile,
    rawSkills,
    experiences,
    educations,
    projects,
    certifications,
    links,
    resumes,
  } = await getFullProfileData(user.id);

  return (
    <ProfileEditor
      initialProfile={profile}
      initialSkills={rawSkills}
      initialExperiences={experiences}
      initialEducations={educations}
      initialProjects={projects}
      initialCertifications={certifications}
      initialLinks={links}
      initialResumes={resumes}
      userEmail={user.email || ""}
      userId={user.id}
    />
  );
}
