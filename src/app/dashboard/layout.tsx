import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard");
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Check if user has uploaded any resume
  let hasResume = false;
  if (profile?.id) {
    const { count } = await supabase
      .from("resumes")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profile.id);
    hasResume = Boolean(count && count > 0);
  }

  const hasProfileInfo = Boolean(
    profile?.first_name && (profile?.summary || profile?.phone || profile?.location)
  );

  const needsOnboarding = !hasResume && !hasProfileInfo;

  const displayName =
    profile?.first_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.first_name ||
    user.email?.split("@")[0] ||
    "User";

  const cookieStore = await cookies();
  const initialCollapsed =
    cookieStore.get("sidebar_collapsed")?.value === "true";

  return (
    <DashboardProvider initialCollapsed={initialCollapsed}>
      <div className="min-h-screen bg-[#070707] text-[#f5f5f5] flex">
        {/* Onboarding Dialog for first time users */}
        {needsOnboarding && (
          <OnboardingDialog
            userEmail={user.email || ""}
            userName={displayName}
          />
        )}

        {/* Collapsible Sidebar */}
        <DashboardSidebar
          user={{
            id: user.id,
            email: user.email,
            displayName,
          }}
          credits={{
            used: 160,
            total: 500,
            plan: "Pro Tier",
          }}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden min-h-screen">
          <DashboardTopbar />
          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}

