import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { User } from "lucide-react";

export const metadata = {
  title: "Profile | Openned",
  description: "View and edit your career profile, experience, and contact details.",
};

export default function ProfilePage() {
  return (
    <PagePlaceholder
      title="Profile"
      badge="Auto-synced"
      description="Manage your personal background, portfolio links, skill tags, and experience records."
      icon={User}
      actionLabel="Edit Details"
      actionHref="/dashboard/settings"
    />
  );
}
