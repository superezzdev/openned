import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { Settings } from "lucide-react";

export const metadata = {
  title: "Profile Settings | Openned",
  description: "Configure your account security, notification settings, and matching preferences.",
};

export default function SettingsPage() {
  return (
    <PagePlaceholder
      title="Profile Settings"
      badge="Security Active"
      description="Configure your account credentials, security options, email notifications, and matching preferences."
      icon={Settings}
      actionLabel="Save Changes"
      actionHref="#save"
    />
  );
}
