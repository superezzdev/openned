import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractTextFromResume,
  convertStrictToLegacy,
  isLikelyScannedDocument,
} from "@/lib/resume-parser";
import { parseResumeStrict } from "@/lib/resume/parser-engine";
import { stageAndSyncResumeProfile } from "@/lib/resume/profile-sync";

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No resume file provided" },
        { status: 400 }
      );
    }

    // 1. Ensure Profile Exists
    let { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      const { data: newProfile, error: createProfileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          // Candidate job profile email is separate from auth email; it is populated from resume
          first_name: user.user_metadata?.full_name?.split(" ")[0] || "",
          last_name: user.user_metadata?.full_name?.split(" ").slice(1).join(" ") || "",
        })
        .select()
        .single();

      if (createProfileError || !newProfile) {
        throw new Error(createProfileError?.message || "Failed to create profile record");
      }
      profile = newProfile;
    }

    if (!profile) {
      throw new Error("Unable to establish profile session");
    }

    const currentProfile = profile;

    // 2. Upload file to Supabase Storage
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${user.id}/${Date.now()}_${sanitizedFileName}`;

    const { error: storageError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (storageError) {
      console.error("Storage upload error:", storageError);
      throw new Error(`Storage upload failed: ${storageError.message}`);
    }

    // 3. Insert record into public.resumes
    const { data: resumeRecord, error: resumeError } = await supabase
      .from("resumes")
      .insert({
        profile_id: currentProfile.id,
        file_path: storagePath,
        file_name: file.name,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (resumeError) {
      console.warn("Failed to record resume entry:", resumeError);
    }

    // 4. Extract Text & Hyperlinks from resume
    const rawText = await extractTextFromResume(
      fileBuffer,
      file.type,
      file.name
    );

    const isScannedPdf = isLikelyScannedDocument(rawText, file.type, file.name);

    // 5. Parse with Multi-Model Fallback Engine (Gemini + Groq + Multimodal Vision)
    const strictExtraction = await parseResumeStrict(rawText, {
      fileBuffer,
      mimeType: file.type,
      isScannedPdf,
    });

    // 6. Stage in resume_parsed_profiles, Validate via Anti-Hallucination Guard,
    // Audit diffs in resume_audit_logs, and Sync Verified Data to Profile
    const syncResult = await stageAndSyncResumeProfile(
      currentProfile.id,
      resumeRecord?.id || null,
      rawText,
      strictExtraction
    );

    // 7. Quality Gate: If substantial document produced zero core entities,
    // do NOT return partial failure as full success.
    if (syncResult.validation.isSufficientQuality === false) {
      return NextResponse.json(
        {
          error: "Resume parsing could not reliably extract structured sections. Please ensure your resume format has standard headings (e.g. Experience, Education, Skills) and try again.",
          validation: syncResult.validation,
        },
        { status: 422 }
      );
    }

    // 8. Convert strict extraction to legacy profile format (STRICT: No auth email fallback)
    const legacyData = convertStrictToLegacy(
      syncResult.validation.verifiedData
    );

    return NextResponse.json({
      success: true,
      data: legacyData,
      strict: syncResult.validation.verifiedData,
      validation: {
        isValid: syncResult.validation.isValid,
        warnings: syncResult.validation.warnings,
        rejectedFields: syncResult.validation.rejectedFields,
      },
      resume: resumeRecord,
    });
  } catch (error: unknown) {
    console.error("Resume processing error:", error);
    const message = error instanceof Error ? error.message : "Failed to process resume";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
