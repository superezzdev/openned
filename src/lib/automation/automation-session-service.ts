/**
 * Automation Session Service
 *
 * Persists and updates records in the automation_sessions table.
 * Tracks session provider, status, lifecycle timestamps, URLs, and safe debug references.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { AutomationSessionRecord, AutomationProvider } from "./types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

export async function createAutomationSessionRecord(
  applicationId: string,
  provider: AutomationProvider | string,
  sessionId: string,
  metadata: Record<string, any> = {}
): Promise<string | null> {
  try {
    const supabase = getAdminClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("automation_sessions")
      .insert({
        application_id: applicationId,
        provider,
        session_id: sessionId,
        status: "ACTIVE",
        started_at: now,
        last_activity_at: now,
        session_metadata: metadata,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      console.warn("[AutomationSessionService] Failed to create session record:", error.message);
      return null;
    }

    return data?.id || null;
  } catch (err: any) {
    console.warn("[AutomationSessionService] Error creating session record:", err?.message);
    return null;
  }
}

export async function updateAutomationSessionRecord(
  sessionId: string,
  updates: Partial<AutomationSessionRecord>
): Promise<void> {
  try {
    const supabase = getAdminClient();
    await supabase
      .from("automation_sessions")
      .update({
        ...updates,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId);
  } catch (err: any) {
    console.warn("[AutomationSessionService] Error updating session record:", err?.message);
  }
}

export async function completeAutomationSessionRecord(
  sessionId: string,
  status: "COMPLETED" | "FAILED" | "TERMINATED" = "COMPLETED",
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getAdminClient();
    const now = new Date().toISOString();

    await supabase
      .from("automation_sessions")
      .update({
        status,
        ended_at: now,
        last_activity_at: now,
        ...(errorMessage ? { error_message: errorMessage } : {}),
        updated_at: now,
      })
      .eq("session_id", sessionId);
  } catch (err: any) {
    console.warn("[AutomationSessionService] Error completing session record:", err?.message);
  }
}

export async function getSessionsForApplication(applicationId: string): Promise<AutomationSessionRecord[]> {
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("automation_sessions")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[AutomationSessionService] Error fetching sessions:", error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}
