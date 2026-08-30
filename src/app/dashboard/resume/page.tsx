import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { FileText } from "lucide-react";

export const metadata = {
  title: "Resume | Openned",
  description: "Manage tailored resume versions and AI-enhanced profiles.",
};

export default function ResumePage() {
  return (
    <PagePlaceholder
      title="Resume"
      badge="AI Parser"
      description="Upload and customize job-specific resume variants with AI-assisted bullet point optimization."
      icon={FileText}
      actionLabel="Create Version"
      actionHref="#create-resume"
    />
  );
}
