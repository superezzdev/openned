import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { LayoutDashboard } from "lucide-react";

export const metadata = {
  title: "Dashboard Overview | Openned",
  description: "Welcome to your Openned dashboard workspace.",
};

export default function DashboardOverviewPage() {
  return (
    <PagePlaceholder
      title="Dashboard Overview"
      badge="Workspace"
      description="Welcome to openned. Use the collapsible sidebar to navigate between Jobs, Resume, Profile, and Application Status."
      icon={LayoutDashboard}
      actionLabel="View Jobs"
      actionHref="/dashboard/jobs"
    />
  );
}
