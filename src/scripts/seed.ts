import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";
import { INITIAL_JOB_SOURCES } from "../lib/ingestion/seed-sources";

async function seedJobSources() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aeqkkdnjzoimgdfmypcw.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "";

  if (!url || !key) {
    console.error("Missing Supabase credentials in environment.");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  console.log(`\n🌱 Seeding ${INITIAL_JOB_SOURCES.length} job sources into Supabase...\n`);

  const payloads = INITIAL_JOB_SOURCES.map((source) => ({
    source: source.source,
    source_name: source.source_name,
    source_identifier: source.source_identifier,
    company_name: source.company_name,
    company_logo: source.company_logo,
    source_url: source.source_url,
    enabled: true,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("job_sources")
    .upsert(payloads, { onConflict: "source,source_identifier" })
    .select("id, source, company_name");

  if (error) {
    console.error("Error upserting job sources:", error.message);
    process.exit(1);
  }

  console.log(`✅ Seeding completed!`);
  console.log(`   - Upserted Total Sources: ${data?.length || INITIAL_JOB_SOURCES.length}`);
  console.log(`   - Total Active Sources: ${INITIAL_JOB_SOURCES.length}\n`);
}

seedJobSources().catch((err) => {
  console.error("Fatal error during seeding:", err);
  process.exit(1);
});
