import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { Briefcase } from "lucide-react";

export const metadata = {
  title: "Jobs | Openned",
  description: "Explore curated job matches tailored to your profile.",
};

export default function JobsPage() {
  return (
    <PagePlaceholder
      title="Jobs"
      badge="Live Feed"
      description="Scrapes, ranks, and matches high-signal roles based on your verified experiences and preferences."
      icon={Briefcase}
      actionLabel="Preferences"
      actionHref="/dashboard/settings"
    />
  );
}
