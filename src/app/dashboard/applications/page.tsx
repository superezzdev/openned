import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { ListChecks } from "lucide-react";

export const metadata = {
  title: "Application Status | Openned",
  description: "Track the status of your submitted job applications and outreach.",
};

export default function ApplicationsPage() {
  return (
    <PagePlaceholder
      title="Application Status"
      badge="3 In Progress"
      description="Monitor active job submissions, interview stages, follow-ups, and company feedback."
      icon={ListChecks}
      actionLabel="View Pipeline"
      actionHref="#pipeline"
    />
  );
}
