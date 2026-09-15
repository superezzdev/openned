import { createClient } from "@supabase/supabase-js";
import { extractTextFromResume } from "@/lib/resume-parser";
import { parseResumeStrict } from "./parser-engine";
import { stageAndSyncResumeProfile, SyncProfileResult } from "./profile-sync";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export interface ReparseUserResult {
  userId: string;
  profileId: string;
  resumeFileName: string;
  success: boolean;
  syncResult?: SyncProfileResult;
  error?: string;
}

/**
 * Reparses the uploaded resume for a specific user ID with zero-hallucination engine.
 */
export async function reparseResume(userId: string): Promise<ReparseUserResult> {
  const supabase = getAdminClient();

  // 1. Locate profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, user_id, email, first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      userId,
      profileId: "",
      resumeFileName: "",
      success: false,
      error: `Profile not found for user: ${userId}`,
    };
  }

  // 2. Fetch latest resume
  const { data: resumes, error: resumeError } = await supabase
    .from("resumes")
    .select("*")
    .eq("profile_id", profile.id)
    .order("uploaded_at", { ascending: false });

  if (resumeError || !resumes || resumes.length === 0) {
    return {
      userId,
      profileId: profile.id,
      resumeFileName: "",
      success: false,
      error: `No resume file found for profile: ${profile.id}`,
    };
  }

  const primaryResume = resumes[0];

  // 3. Download resume file from Supabase storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("resumes")
    .download(primaryResume.file_path);

  if (downloadError || !fileData) {
    return {
      userId,
      profileId: profile.id,
      resumeFileName: primaryResume.file_name,
      success: false,
      error: `Failed to download resume file: ${downloadError?.message}`,
    };
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const mimeType = primaryResume.file_name.endsWith(".pdf")
    ? "application/pdf"
    : primaryResume.file_name.endsWith(".docx")
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "text/plain";

  // 4. Extract raw text & embedded document links
  const rawText = await extractTextFromResume(buffer, mimeType, primaryResume.file_name);

  const isPdf = mimeType.includes("pdf") || primaryResume.file_name.toLowerCase().endsWith(".pdf");
  const isScannedPdf = isPdf && rawText.trim().length < 150;

  // 5. Parse with Multi-Model Fallback Engine (Gemini + Groq + Multimodal Vision)
  const strictExtraction = await parseResumeStrict(rawText, {
    fileBuffer: buffer,
    mimeType,
    isScannedPdf,
  });

  // 6. Validate, stage, audit diffs, and sync verified data to profile
  const syncResult = await stageAndSyncResumeProfile(
    profile.id,
    primaryResume.id,
    rawText,
    strictExtraction
  );

  return {
    userId,
    profileId: profile.id,
    resumeFileName: primaryResume.file_name,
    success: true,
    syncResult,
  };
}

/**
 * Reparses resumes for all users in the database.
 */
export async function reparseAllResumes(): Promise<ReparseUserResult[]> {
  const supabase = getAdminClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, user_id");

  if (error || !profiles) {
    console.error("Failed to fetch profiles for batch reparse:", error);
    return [];
  }

  const results: ReparseUserResult[] = [];
  for (const p of profiles) {
    if (p.user_id) {
      console.log(`Reparsing resume for user ${p.user_id}...`);
      const res = await reparseResume(p.user_id);
      results.push(res);
    }
  }

  return results;
}
