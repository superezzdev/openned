/**
 * Application Automation State Manager
 *
 * Persists and restores intermediate automation execution checkpoints so that
 * when fallback or resume occurs, the workflow can continue safely from the
 * last verified step without repeating steps or corrupting state.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { ApplicationAutomationState, BrowserProvider, PageHandle } from "./types";
import { DetectedField } from "../applications/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

/**
 * Save checkpoint state to the application record.
 */
export async function saveApplicationAutomationState(
  applicationId: string,
  stateUpdate: Partial<ApplicationAutomationState>
): Promise<void> {
  const supabase = getAdminClient();

  const { data: existingApp } = await supabase
    .from("applications")
    .select("debug_info, platform, apply_url, form_schema_id, missing_fields")
    .eq("id", applicationId)
    .maybeSingle();

  const currentDebug = existingApp?.debug_info || {};
  const currentState: ApplicationAutomationState = currentDebug.automation_state || {
    application_id: applicationId,
    stage: "INITIAL",
    completed_fields: [],
    pending_fields: [],
    missing_fields: [],
  };

  const updatedState: ApplicationAutomationState = {
    ...currentState,
    ...stateUpdate,
    application_id: applicationId,
    updated_at: new Date().toISOString(),
  };

  const newDebugInfo = {
    ...currentDebug,
    automation_state: updatedState,
  };

  await supabase
    .from("applications")
    .update({
      debug_info: newDebugInfo,
      ...(stateUpdate.platform ? { platform: stateUpdate.platform } : {}),
      ...(stateUpdate.form_schema_id ? { form_schema_id: stateUpdate.form_schema_id } : {}),
      ...(stateUpdate.missing_fields ? { missing_fields: stateUpdate.missing_fields } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
}

/**
 * Load the latest checkpoint state for an application.
 */
export async function loadApplicationAutomationState(
  applicationId: string
): Promise<ApplicationAutomationState | null> {
  const supabase = getAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id, status, platform, apply_url, form_schema_id, missing_fields, debug_info, automation_provider, browser_session_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;

  const savedState = app.debug_info?.automation_state;
  if (savedState) return savedState;

  return {
    application_id: applicationId,
    stage: app.status,
    platform: app.platform,
    page_url: app.apply_url,
    form_schema_id: app.form_schema_id,
    missing_fields: app.missing_fields || [],
    provider: app.automation_provider,
    session_id: app.browser_session_id,
  };
}

/**
 * Revalidate previously detected fields against a newly loaded page.
 * When switching from Local to Browserbase, DOM selectors must be checked
 * against the fresh page rather than assuming stale handles.
 */
export async function revalidateFieldSelectors(
  provider: BrowserProvider,
  page: PageHandle,
  fields: DetectedField[],
  freshDomFields?: DetectedField[]
): Promise<DetectedField[] & { valid: DetectedField[]; needsRelocation: DetectedField[] }> {
  const result: DetectedField[] = [];
  const valid: DetectedField[] = [];
  const needsRelocation: DetectedField[] = [];

  for (const field of fields) {
    let currentSelector = field.selector;
    let found = false;

    try {
      const el = await provider.findElement(page, currentSelector);
      if (el) found = true;
    } catch {}

    if (!found && freshDomFields) {
      const matchingFresh = freshDomFields.find((f) => f.field_id === field.field_id);
      if (matchingFresh) {
        currentSelector = matchingFresh.selector;
        found = true;
      }
    }

    const updatedField = { ...field, selector: currentSelector };
    result.push(updatedField);

    if (found) {
      valid.push(updatedField);
    } else {
      needsRelocation.push(updatedField);
    }
  }

  // Attach valid and needsRelocation to the array
  Object.assign(result, { valid, needsRelocation });
  return result as DetectedField[] & { valid: DetectedField[]; needsRelocation: DetectedField[] };
}

