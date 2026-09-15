import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  console.log("Deactivating stale jobs older than 60 days (" + sixtyDaysAgo + ")...");

  // Deactivate jobs with posted_at < 60 days ago
  const { data: d1, error: e1 } = await supabase
    .from("canonical_jobs")
    .update({ active: false })
    .eq("active", true)
    .lt("posted_at", sixtyDaysAgo)
    .select("id");

  if (e1) console.error("Error updating old posted_at:", e1);
  else console.log(`Deactivated ${d1?.length || 0} jobs with posted_at < 60 days.`);

  // Deactivate jobs with posted_at is null and created_at < 60 days ago
  const { data: d2, error: e2 } = await supabase
    .from("canonical_jobs")
    .update({ active: false })
    .eq("active", true)
    .is("posted_at", null)
    .lt("created_at", sixtyDaysAgo)
    .select("id");

  if (e2) console.error("Error updating null posted_at:", e2);
  else console.log(`Deactivated ${d2?.length || 0} jobs with null posted_at and old created_at.`);

  // Deactivate jobs with broken placeholder URLs
  const { data: d3, error: e3 } = await supabase
    .from("canonical_jobs")
    .update({ active: false })
    .eq("active", true)
    .or("apply_url.ilike.%example.com%,job_url.ilike.%example.com%,apply_url.is.null")
    .select("id");

  if (e3) console.error("Error updating placeholder URLs:", e3);
  else console.log(`Deactivated ${d3?.length || 0} jobs with invalid/placeholder URLs.`);

  // Check remaining active count
  const { count: remainingActive } = await supabase
    .from("canonical_jobs")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  console.log(`Remaining fresh active jobs in DB: ${remainingActive}`);
}

main().catch(console.error);
