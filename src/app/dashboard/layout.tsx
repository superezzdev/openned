import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthUser, getFullProfileData } from "@/lib/user-profile-loader";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog";
import { getActiveApplicationsCount } from "@/lib/applications/application-status-service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard");
  }

  // Fetch memoized full profile and active applications count in parallel
  const [{ displayName, needsOnboarding }, activeApplicationsCount] =
    await Promise.all([
      getFullProfileData(user.id),
      getActiveApplicationsCount(user.id),
    ]);

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
          initialActiveApplicationsCount={activeApplicationsCount}
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
