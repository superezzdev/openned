import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverSourceFromUrl } from "@/lib/ingestion/discovery";
import { JobSource } from "@/lib/ingestion/types";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const sourceFilter = searchParams.get("source");

    let query = supabase
      .from("job_sources")
      .select("*")
      .order("company_name", { ascending: true });

    if (sourceFilter && sourceFilter !== "all") {
      query = query.eq("source", sourceFilter);
    }

    const { data: sources, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get active job counts grouped by source
    const { data: jobCounts } = await supabase
      .from("canonical_jobs")
      .select("source_id, source, active")
      .eq("active", true);

    const countsMap: Record<string, number> = {};
    if (jobCounts) {
      for (const j of jobCounts) {
        if (j.source_id) {
          countsMap[j.source_id] = (countsMap[j.source_id] || 0) + 1;
        }
      }
    }

    const enrichedSources = (sources || []).map((s) => ({
      ...s,
      active_jobs_count: countsMap[s.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      sources: enrichedSources,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch job sources" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { url, source, source_identifier, company_name } = body;

    let sourcePayload: any;

    if (url && (!source || !source_identifier)) {
      const discovered = discoverSourceFromUrl(url, company_name);
      if (!discovered) {
        return NextResponse.json(
          { error: "Could not automatically detect ATS provider from URL. Please specify source and identifier manually." },
          { status: 400 }
        );
      }
      sourcePayload = {
        source: discovered.source,
        source_name: discovered.source_name,
        source_identifier: discovered.source_identifier,
        company_name: discovered.company_name,
        company_logo: discovered.company_logo,
        source_url: discovered.source_url,
        enabled: true,
      };
    } else {
      if (!source || !source_identifier || !company_name) {
        return NextResponse.json(
          { error: "source, source_identifier, and company_name are required." },
          { status: 400 }
        );
      }
      sourcePayload = {
        source: source as JobSource,
        source_name: `${company_name} (${source})`,
        source_identifier: source_identifier.trim(),
        company_name: company_name.trim(),
        source_url: url || `https://${source}.com/${source_identifier}`,
        enabled: true,
      };
    }

    const { data, error } = await supabase
      .from("job_sources")
      .upsert(sourcePayload, { onConflict: "source,source_identifier" })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      source: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create job source" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { id, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "Source ID is required" }, { status: 400 });
    }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof enabled === "boolean") {
      updatePayload.enabled = enabled;
    }

    const { data, error } = await supabase
      .from("job_sources")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      source: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update job source" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Source ID is required" }, { status: 400 });
    }

    const { error } = await supabase.from("job_sources").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Job source deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete job source" }, { status: 500 });
  }
}
