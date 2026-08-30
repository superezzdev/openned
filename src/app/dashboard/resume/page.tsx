import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ResumeList } from "@/components/dashboard/resume-list";

export const metadata = {
  title: "Resume | Openned",
  description: "Manage tailored resume versions and uploaded career assets.",
};

export default async function ResumePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard/resume");
  }

  // 1. Fetch Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  let resumes = [];

  if (profile?.id) {
    const { data } = await supabase
      .from("resumes")
      .select("*")
      .eq("profile_id", profile.id)
      .order("uploaded_at", { ascending: false });

    resumes = data || [];
  }

  return (
    <ResumeList initialResumes={resumes} userEmail={user.email || ""} />
  );
}
