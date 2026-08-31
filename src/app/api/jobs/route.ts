import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCachedOrFreshJobs } from "@/lib/jobs-service";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    const platform = searchParams.get("platform") || undefined;

    const result = await fetchCachedOrFreshJobs(user.id, {
      forceRefresh: force,
      platform,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error in GET /api/jobs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, saved_status, applied_status } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId in request body" },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, any> = {};
    if (typeof saved_status === "boolean") {
      updatePayload.saved_status = saved_status;
    }
    if (typeof applied_status === "boolean") {
      updatePayload.applied_status = applied_status;
      if (applied_status) {
        updatePayload.applied_at = new Date().toISOString();
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // 1. Try upserting in user_job_interactions (for canonical jobs)
    const { data: canonicalJob } = await supabase
      .from("canonical_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();

    if (canonicalJob) {
      const interactionPayload = {
        user_id: user.id,
        canonical_job_id: jobId,
        ...updatePayload,
        updated_at: new Date().toISOString(),
      };

      const { data: interactionData, error: interactionError } = await supabase
        .from("user_job_interactions")
        .upsert(interactionPayload, { onConflict: "user_id,canonical_job_id" })
        .select()
        .single();

      if (interactionError) {
        console.error("Error updating user_job_interactions:", interactionError);
      }

      return NextResponse.json({
        success: true,
        interaction: interactionData,
      });
    }

    // 2. Legacy fallback: update legacy jobs table
    const { data, error } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating job in Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      job: data,
    });
  } catch (error: any) {
    console.error("Error in PATCH /api/jobs:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update job" },
      { status: 500 }
    );
  }
}
