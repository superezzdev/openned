import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/dashboard/profile-editor";

export const metadata = {
  title: "Profile | Openned",
  description: "View and edit your career profile, experience, and contact details.",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/profile");
  }

  // 1. Fetch Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let skills = [];
  let experiences = [];
  let educations = [];
  let projects = [];
  let certifications = [];
  let links = [];
  let resumes = [];

  if (profile?.id) {
    // 2. Fetch all child data in parallel
    const [
      skillsRes,
      expRes,
      eduRes,
      projRes,
      certRes,
      linksRes,
      resumesRes,
    ] = await Promise.all([
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

    skills = skillsRes.data || [];
    experiences = expRes.data || [];
    educations = eduRes.data || [];
    projects = projRes.data || [];
    certifications = certRes.data || [];
    links = linksRes.data || [];
    resumes = resumesRes.data || [];
  }

  return (
    <ProfileEditor
      initialProfile={profile}
      initialSkills={skills}
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

