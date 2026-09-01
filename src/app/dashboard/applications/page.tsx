import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ApplicationsDashboard } from "@/components/dashboard/applications/applications-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Applications | Openned",
  description: "Track and manage your AI-assisted and manual job applications.",
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

async function getApplications(userId: string) {
  const adminClient = getAdminClient();

  const { data: applications, error } = await adminClient
    .from("applications")
    .select(`
      id, job_id, status, source, platform, apply_url,
      failure_code, error_message, missing_fields,
      submitted_at, created_at, updated_at,
      canonical_jobs (
        title, company_name, company_logo, job_url
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[ApplicationsPage] Error fetching applications:", error);
    return [];
  }

  return applications || [];
}

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const applications = await getApplications(user.id);

  return (
    <Suspense fallback={<ApplicationsPageSkeleton />}>
      <ApplicationsDashboard initialApplications={applications as any} />
    </Suspense>
  );
}

function ApplicationsPageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-48 rounded-2xl" />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-xl" />
        ))}
      </div>
      {[...Array(3)].map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}
