/**
 * Profile Resolver
 *
 * Resolves concrete profile values for mapped field keys.
 * Loads user profile from Supabase including profile, links table, and resumes.
 * Detects missing required fields.
 */

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { AutomationProfile, MissingFieldInfo, DetectedField, FieldMappingResult, FieldStatus } from "./types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createSupabaseAdmin(url, key);
}

/**
 * Load a full automation profile for a user from Supabase.
 * Merges profiles table + links table + resumes table.
 */
export async function loadAutomationProfile(userId: string): Promise<AutomationProfile> {
  const supabase = getAdminClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const profileId = profile?.id;

  let skills: string[] = [];
  let experiences: any[] = [];
  let educations: any[] = [];
  let links: any[] = [];
  let resumes: any[] = [];

  if (profileId) {
    const [skillsRes, expRes, eduRes, linksRes, resumesRes] = await Promise.all([
      supabase.from("skills").select("skill_name").eq("profile_id", profileId),
      supabase.from("experiences").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
      supabase.from("educations").select("*").eq("profile_id", profileId).order("created_at", { ascending: false }),
      supabase.from("links").select("url_type, url").eq("profile_id", profileId),
      supabase.from("resumes").select("*").eq("profile_id", profileId).order("uploaded_at", { ascending: false }),
    ]);

    skills = (skillsRes.data || []).map((s: any) => s.skill_name).filter(Boolean);
    experiences = expRes.data || [];
    educations = eduRes.data || [];
    links = linksRes.data || [];
    resumes = resumesRes.data || [];
  }

  // Build URL map from links table
  const urlMap: Record<string, string> = {};
  for (const link of links) {
    if (link.url_type && link.url) {
      urlMap[link.url_type.toLowerCase()] = link.url;
    }
  }

  // Pick best resume
  const primaryResume = resumes[0] || null;
  const resumeUrl = primaryResume?.file_url || null;

  // Parse location for city/country
  const locationStr = profile?.location || "";
  const locationParts = locationStr.split(",").map((s: string) => s.trim());

  return {
    user_id: userId,
    first_name: profile?.first_name || null,
    last_name: profile?.last_name || null,
    email: profile?.email || null,
    phone: profile?.phone || null,
    location: locationStr || null,
    city: locationParts[0] || null,
    state: locationParts[1] || null,
    country: locationParts[2] || locationParts[1] || null,
    summary: profile?.summary || null,
    linkedin_url: profile?.linkedin_url || urlMap["linkedin"] || urlMap["linkedin_url"] || null,
    github_url: profile?.github_url || urlMap["github"] || urlMap["github_url"] || null,
    portfolio_url: profile?.portfolio_url || urlMap["portfolio"] || urlMap["portfolio_url"] || null,
    website_url: profile?.website_url || urlMap["website"] || urlMap["website_url"] || null,
    twitter_url: profile?.twitter_url || urlMap["twitter"] || urlMap["twitter_url"] || null,
    work_authorization: profile?.work_authorization || null,
    years_experience: profile?.years_experience || null,
    skills,
    experiences,
    educations,
    resume_url: resumeUrl,
    resume_file_id: primaryResume?.id || null,
  };
}

/**
 * Resolve a profile value from a mapped key.
 */
export function resolveProfileValue(
  profileKey: string,
  profile: AutomationProfile
): string | null {
  const keyMap: Record<string, () => string | null> = {
    first_name: () => profile.first_name || null,
    last_name: () => profile.last_name || null,
    email: () => profile.email || null,
    phone: () => profile.phone || null,
    location: () => profile.location || null,
    city: () => profile.city || null,
    state: () => profile.state || null,
    country: () => profile.country || null,
    summary: () => profile.summary || null,
    linkedin_url: () => profile.linkedin_url || null,
    github_url: () => profile.github_url || null,
    portfolio_url: () => profile.portfolio_url || null,
    website_url: () => profile.website_url || null,
    twitter_url: () => profile.twitter_url || null,
    work_authorization: () => profile.work_authorization || null,
    years_experience: () => profile.years_experience?.toString() || null,
  };

  const resolver = keyMap[profileKey];
  if (!resolver) return null;
  return resolver();
}

/**
 * Find all required fields that have no profile value.
 * Returns an array of missing field descriptors.
 */
export function detectMissingFields(
  fields: Array<DetectedField & { mapping: FieldMappingResult }>,
  profile: AutomationProfile
): MissingFieldInfo[] {
  const missing: MissingFieldInfo[] = [];

  for (const field of fields) {
    if (!field.required) continue;
    if (field.mapping.status === FieldStatus.UNSUPPORTED) continue;

    const key = field.mapping.mapped_profile_key;

    // No mapping found
    if (!key) {
      missing.push({
        field_key: field.field_id,
        label: field.label,
        type: field.type,
        options: field.options,
      });
      continue;
    }

    // Has mapping but no value
    const value = resolveProfileValue(key, profile);
    if (!value || value.trim() === "") {
      missing.push({
        field_key: key,
        label: field.label,
        type: field.type,
        options: field.options,
      });
    }
  }

  return missing;
}

/**
 * Update a user's profile with values provided from the missing fields dialog.
 * These values become reusable for future applications.
 */
export async function updateProfileWithMissingFields(
  userId: string,
  values: Record<string, string>
): Promise<void> {
  const supabase = getAdminClient();

  // Get profile ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.id) {
    throw new Error("Profile not found for user");
  }

  // Determine which fields go to profiles table vs links table
  const PROFILE_COLUMNS = new Set([
    "first_name", "last_name", "email", "phone", "location",
    "summary", "linkedin_url", "github_url", "portfolio_url",
    "website_url", "twitter_url", "work_authorization", "years_experience",
  ]);

  const URL_TYPE_MAP: Record<string, string> = {
    linkedin_url: "linkedin",
    github_url: "github",
    portfolio_url: "portfolio",
    website_url: "website",
    twitter_url: "twitter",
  };

  const profileUpdates: Record<string, any> = {};
  const linkUpdates: Array<{ url_type: string; url: string }> = [];

  for (const [key, value] of Object.entries(values)) {
    if (!value?.trim()) continue;

    if (PROFILE_COLUMNS.has(key)) {
      // years_experience should be numeric
      if (key === "years_experience") {
        const num = parseInt(value, 10);
        if (!isNaN(num)) profileUpdates[key] = num;
      } else {
        profileUpdates[key] = value.trim();
      }

      // Also upsert URL-type fields into links table for backward compat
      if (URL_TYPE_MAP[key]) {
        linkUpdates.push({ url_type: URL_TYPE_MAP[key], url: value.trim() });
      }
    }
  }

  // Update profiles table
  if (Object.keys(profileUpdates).length > 0) {
    profileUpdates.updated_at = new Date().toISOString();
    await supabase.from("profiles").update(profileUpdates).eq("user_id", userId);
  }

  // Upsert links
  for (const link of linkUpdates) {
    await supabase.from("links").upsert(
      { profile_id: profile.id, url_type: link.url_type, url: link.url },
      { onConflict: "profile_id,url_type" }
    );
  }
}
