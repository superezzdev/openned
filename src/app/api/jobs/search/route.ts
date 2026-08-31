import { NextRequest, NextResponse } from "next/server";
import { searchAdzunaJobs, AdzunaError } from "@/lib/ingestion/adapters/adzuna";
import { computeJobContentHash } from "@/lib/ingestion/hasher";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const source = searchParams.get("source") || "adzuna";
    const query = searchParams.get("query") || searchParams.get("what") || "";
    const location = searchParams.get("location") || searchParams.get("where") || "";
    const country = searchParams.get("country") || process.env.ADZUNA_COUNTRY || "in";
    const pageParam = searchParams.get("page");
    const resultsPerPageParam = searchParams.get("resultsPerPage") || searchParams.get("results_per_page");
    const persist = searchParams.get("persist") !== "false";

    // 1. Validation
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "INVALID_PARAMETER", message: "Page parameter must be an integer greater than or equal to 1." },
        { status: 400 }
      );
    }

    const resultsPerPage = resultsPerPageParam ? parseInt(resultsPerPageParam, 10) : 20;
    if (isNaN(resultsPerPage) || resultsPerPage < 1 || resultsPerPage > 50) {
      return NextResponse.json(
        { error: "INVALID_PARAMETER", message: "resultsPerPage must be an integer between 1 and 50." },
        { status: 400 }
      );
    }

    if (source !== "adzuna") {
      return NextResponse.json(
        { error: "UNSUPPORTED_SOURCE", message: `Search source '${source}' is not supported. Supported sources: 'adzuna'.` },
        { status: 400 }
      );
    }

    // 2. Call Adzuna Service
    const searchResult = await searchAdzunaJobs({
      query: query || undefined,
      location: location || undefined,
      country: country || undefined,
      page,
      resultsPerPage,
    });

    // 3. Database Persistence (optional / background indexing)
    if (persist && searchResult.jobs.length > 0) {
      try {
        const supabase = await createClient();
        const nowIso = new Date().toISOString();

        const jobsToUpsert = searchResult.jobs.map((job) => ({
          source: "adzuna",
          source_job_id: job.source_job_id,
          company_name: job.company_name,
          company_logo: job.company_logo || "/platforms/adzuna.svg",
          title: job.title,
          description: job.description || null,
          description_html: job.description_html || null,
          location: job.location || null,
          locations_json: job.locations_json || [],
          country: job.country || null,
          region: job.region || null,
          city: job.city || null,
          remote_type: job.remote_type || null,
          employment_type: job.employment_type || null,
          department: job.department || null,
          team: job.team || null,
          salary_min: job.salary_min || null,
          salary_max: job.salary_max || null,
          salary_currency: job.salary_currency || null,
          salary_interval: job.salary_interval || null,
          job_url: job.job_url,
          apply_url: job.apply_url,
          posted_at: job.posted_at || null,
          updated_at_source: job.updated_at_source || null,
          scraped_at: nowIso,
          last_seen_at: nowIso,
          active: true,
          raw_payload: job.raw_payload || null,
          content_hash: computeJobContentHash(job),
          updated_at: nowIso,
        }));

        await supabase
          .from("canonical_jobs")
          .upsert(jobsToUpsert, { onConflict: "source,source_job_id" });
      } catch (dbErr: unknown) {
        // Non-blocking database indexing log
        const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.warn("[adzuna-search] Could not persist search jobs to DB:", dbMsg);
      }
    }

    // 4. Return Normalized Search Response
    return NextResponse.json({
      source: "adzuna",
      jobs: searchResult.jobs,
      pagination: searchResult.pagination,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[adzuna-search] Error in GET /api/jobs/search:", errorMsg);

    if (error instanceof AdzunaError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      {
        error: "INTERNAL_SEARCH_ERROR",
        message: errorMsg || "An error occurred while executing job search.",
      },
      { status: 500 }
    );
  }
}
