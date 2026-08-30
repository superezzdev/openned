import { PagePlaceholder } from "@/components/dashboard/page-placeholder";
import { CreditCard } from "lucide-react";

export const metadata = {
  title: "Billing & Credits | Openned",
  description: "Manage your subscription, invoice history, and AI matching credits.",
};

export default function BillingPage() {
  return (
    <PagePlaceholder
      title="Billing & Credits"
      badge="Pro Plan"
      description="Review your monthly credit balance, subscription invoices, payment methods, and usage tiers."
      icon={CreditCard}
      actionLabel="Upgrade Plan"
      actionHref="#upgrade"
    />
  );
}
