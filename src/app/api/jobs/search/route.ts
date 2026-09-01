import { NextRequest, NextResponse } from "next/server";
import { jobSearchService } from "@/lib/job-providers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // 1. Query & Location
    const query = searchParams.get("query") || searchParams.get("what") || "";
    const location = searchParams.get("location") || searchParams.get("where") || "";
    const country = searchParams.get("country") || process.env.ADZUNA_COUNTRY || "in";

    // 2. Pagination
    const pageParam = searchParams.get("page");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: "INVALID_PARAMETER", message: "Page parameter must be an integer >= 1." },
        { status: 400 }
      );
    }

    const limitParam =
      searchParams.get("limit") ||
      searchParams.get("resultsPerPage") ||
      searchParams.get("results_per_page");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    if (isNaN(limit) || limit < 1 || limit > 50) {
      return NextResponse.json(
        { error: "INVALID_PARAMETER", message: "limit / resultsPerPage must be between 1 and 50." },
        { status: 400 }
      );
    }

    // 3. Source Filtering
    const rawSources = searchParams.getAll("sources");
    const singleSource = searchParams.get("source");
    let sources: string[] | undefined = undefined;

    if (rawSources.length > 0) {
      sources = rawSources.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
    } else if (singleSource && singleSource !== "all") {
      sources = singleSource.split(",").map((s) => s.trim()).filter(Boolean);
    }

    // 4. Filters & Mode
    const remote = searchParams.get("remote") === "true";
    const mode = (searchParams.get("mode") === "parallel" ? "parallel" : "sequential") as "sequential" | "parallel";
    const persist = searchParams.get("persist") !== "false";
    const datePosted = searchParams.get("datePosted") || undefined;
    const experienceLevel = searchParams.get("experienceLevel") || undefined;
    const salaryMin = searchParams.get("salaryMin") ? parseInt(searchParams.get("salaryMin")!, 10) : undefined;
    const employmentTypes = searchParams.getAll("employmentType");

    // 5. Execute Unified Job Search
    const searchResponse = await jobSearchService.search({
      query: query || undefined,
      location: location || undefined,
      country: country || undefined,
      page,
      limit,
      remote,
      sources,
      mode,
      persist,
      datePosted,
      experienceLevel,
      salaryMin: !isNaN(salaryMin as number) ? salaryMin : undefined,
      employmentType: employmentTypes.length > 0 ? employmentTypes : undefined,
    });

    return NextResponse.json(searchResponse);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("[job-search-api] Unhandled error in GET /api/jobs/search:", errorMsg);

    return NextResponse.json(
      {
        error: "INTERNAL_SEARCH_ERROR",
        message: errorMsg || "An unexpected error occurred while executing job search.",
      },
      { status: 500 }
    );
  }
}
