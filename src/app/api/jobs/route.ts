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
    const query = searchParams.get("q") || searchParams.get("query") || undefined;
    const location = searchParams.get("location") || undefined;
    const country = searchParams.get("country") || undefined;
    const jobType = searchParams.get("jobType") || searchParams.get("job_type") || undefined;
    const remoteType = searchParams.get("remoteType") || searchParams.get("remote_type") || undefined;
    const experienceLevel = searchParams.get("experienceLevel") || searchParams.get("experience_level") || undefined;
    const salaryMinParam = searchParams.get("salaryMin") || searchParams.get("salary_min");
    const salaryMin = salaryMinParam ? parseInt(salaryMinParam, 10) : undefined;
    const datePosted = searchParams.get("datePosted") || searchParams.get("date_posted") || undefined;

    const result = await fetchCachedOrFreshJobs(user.id, {
      forceRefresh: force,
      platform,
      query,
      location,
      country,
      jobType,
      remoteType,
      experienceLevel,
      salaryMin: !isNaN(salaryMin as number) ? salaryMin : undefined,
      datePosted,
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
    const { jobId, saved_status, applied_status, not_relevant, hidden, feedback_reason } = body;

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
    if (typeof not_relevant === "boolean") {
      updatePayload.not_relevant = not_relevant;
    }
    if (typeof hidden === "boolean") {
      updatePayload.hidden = hidden;
    }
    if (feedback_reason) {
      updatePayload.feedback_reason = feedback_reason;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // If job was marked not_relevant or hidden, remove from cached job_matches
    if (not_relevant || hidden) {
      await supabase
        .from("job_matches")
        .delete()
        .eq("user_id", user.id)
        .eq("job_id", jobId);
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
