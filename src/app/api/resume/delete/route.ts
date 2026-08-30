import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { resumeId } = await req.json();

    if (!resumeId) {
      return NextResponse.json(
        { error: "Resume ID is required" },
        { status: 400 }
      );
    }

    // Get the resume record first
    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("id, file_path, profile_id, profiles!inner(user_id)")
      .eq("id", resumeId)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    // Delete from storage if file_path exists
    if (resume.file_path) {
      await supabase.storage.from("resumes").remove([resume.file_path]);
    }

    // Delete record from resumes table
    const { error: deleteError } = await supabase
      .from("resumes")
      .delete()
      .eq("id", resumeId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Resume deletion error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
