/**
 * Field Mapper
 *
 * Maps detected form fields to user profile properties.
 * Uses deterministic mapping first, then Gemini AI as a fallback.
 *
 * AI output is constrained to known profile keys — it CANNOT invent data.
 */

import { GoogleGenAI } from "@google/genai";
import { DetectedField, FieldMappingResult, FieldStatus, AutomationProfile } from "./types";

const CONFIDENCE_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Canonical profile key map
// ---------------------------------------------------------------------------
type ProfileKey = keyof AutomationProfile | string;

/** All valid profile field keys that the mapper may return */
const VALID_PROFILE_KEYS: Set<string> = new Set([
  "first_name", "last_name", "full_name", "email", "phone",
  "location", "city", "state", "country",
  "summary", "linkedin_url", "github_url",
  "portfolio_url", "website_url", "twitter_url",
  "work_authorization", "years_experience",
  "resume", // file upload
]);

// ---------------------------------------------------------------------------
// Deterministic keyword mapping table
// ---------------------------------------------------------------------------
type MappingEntry = { key: string; keywords: RegExp[] };

const DETERMINISTIC_MAPPINGS: MappingEntry[] = [
  { key: "full_name", keywords: [/full\s*name/i, /legal\s*name/i, /candidate\s*name/i, /^name$/i] },
  { key: "first_name", keywords: [/first\s*name/i, /given\s*name/i, /preferred\s*name/i, /prénom/i, /\bfname\b/i] },
  { key: "last_name", keywords: [/last\s*name/i, /family\s*name/i, /surname/i, /\blname\b/i] },
  { key: "email", keywords: [/e.?mail/i, /email\s*address/i] },
  { key: "phone", keywords: [/phone/i, /mobile/i, /telephone/i, /contact\s*number/i, /\btel\b/i] },
  { key: "location", keywords: [/\blocation\b/i, /city.*state/i, /where.*you.*based/i] },
  { key: "city", keywords: [/\bcity\b/i, /\btown\b/i] },
  { key: "state", keywords: [/\bstate\b/i, /\bprovince\b/i, /\bregion\b/i] },
  { key: "country", keywords: [/\bcountry\b/i, /nationality/i] },
  { key: "linkedin_url", keywords: [/linkedin/i, /linked\s*in\s*url/i, /linkedin\s*profile/i] },
  { key: "github_url", keywords: [/github/i, /git\s*hub\s*url/i, /github\s*profile/i] },
  { key: "portfolio_url", keywords: [/portfolio/i, /personal\s*website/i, /work\s*samples/i] },
  { key: "website_url", keywords: [/website/i, /personal\s*site/i, /blog\s*url/i] },
  { key: "twitter_url", keywords: [/twitter/i, /\bx\.com\b/i, /\@handle/i] },
  { key: "summary", keywords: [/cover\s*letter/i, /about\s*yourself/i, /brief\s*summary/i, /introduce\s*yourself/i] },
  { key: "work_authorization", keywords: [/authorized\s*to\s*work/i, /work\s*authorization/i, /eligible\s*to\s*work/i, /visa\s*sponsorship/i, /sponsorship\s*required/i, /right\s*to\s*work/i] },
  { key: "years_experience", keywords: [/years?\s*of\s*experience/i, /how\s*many\s*years/i, /total\s*experience/i] },
  { key: "resume", keywords: [/resume/i, /cv\b/i, /curriculum\s*vitae/i, /upload\s*your\s*file/i] },
];

// ---------------------------------------------------------------------------
// Deterministic mapper
// ---------------------------------------------------------------------------
function deterministicMap(field: DetectedField): { key: string | null; confidence: number } {
  const label = field.label;

  for (const entry of DETERMINISTIC_MAPPINGS) {
    // Skip resume mapping for non-file fields
    if (entry.key === "resume" && field.type !== "file") continue;

    for (const pattern of entry.keywords) {
      if (pattern.test(label)) {
        return { key: entry.key, confidence: 0.95 };
      }
    }
  }

  return { key: null, confidence: 0 };
}

// ---------------------------------------------------------------------------
// AI-assisted mapper (Gemini)
// ---------------------------------------------------------------------------
async function aiMap(field: DetectedField, profileKeys: string[]): Promise<{ key: string | null; confidence: number; reason: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { key: null, confidence: 0, reason: "no_api_key" };

  const genai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert at mapping job application form fields to user profile data.

Given this form field:
- Label: "${field.label}"
- Type: "${field.type}"
- Options: ${field.options ? JSON.stringify(field.options) : "none"}

Return a JSON object mapping it to ONE of these known profile keys, or null if no match:
${profileKeys.map(k => `"${k}"`).join(", ")}

Rules:
- Only return a key from the list above. NEVER invent a new key.
- If the label is ambiguous or could refer to multiple keys, return the most likely one.
- If confidence is below 0.7, return null for mapped_profile_key.
- Return ONLY valid JSON.

Response format:
{"mapped_profile_key": "<key or null>", "confidence": <0-1>, "reason": "<brief reason>"}`;

  try {
    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { key: null, confidence: 0, reason: "parse_error" };

    const parsed = JSON.parse(jsonMatch[0]);
    const mappedKey = parsed.mapped_profile_key;
    const confidence = parseFloat(parsed.confidence) || 0;

    // Enforce that AI can only return valid known keys
    if (!mappedKey || !profileKeys.includes(mappedKey)) {
      return { key: null, confidence: 0, reason: "invalid_key" };
    }

    return {
      key: mappedKey,
      confidence,
      reason: parsed.reason || "ai_match",
    };
  } catch (err) {
    console.warn("[FieldMapper] AI mapping failed:", err);
    return { key: null, confidence: 0, reason: "ai_error" };
  }
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------
/**
 * Map a detected form field to a user profile key.
 * Uses deterministic matching first, falls back to Gemini AI.
 */
export async function mapApplicationField(
  field: DetectedField,
  _profile: AutomationProfile
): Promise<FieldMappingResult> {
  const profileKeys = Array.from(VALID_PROFILE_KEYS);

  // 1. Deterministic mapping
  const det = deterministicMap(field);
  if (det.key && det.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      mapped_profile_key: det.key,
      confidence: det.confidence,
      reason: "direct_match",
      status: FieldStatus.MAPPED,
    };
  }

  // 2. AI fallback
  const ai = await aiMap(field, profileKeys);
  if (ai.key && ai.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      mapped_profile_key: ai.key,
      confidence: ai.confidence,
      reason: "ai_match",
      status: FieldStatus.MAPPED,
    };
  }

  // 3. Ambiguous or unknown
  if (ai.confidence > 0 && ai.confidence < CONFIDENCE_THRESHOLD) {
    return {
      mapped_profile_key: ai.key,
      confidence: ai.confidence,
      reason: "ai_match",
      status: FieldStatus.AMBIGUOUS,
    };
  }

  // 4. Optional fields that couldn't be mapped
  if (!field.required) {
    return {
      mapped_profile_key: null,
      confidence: 0,
      reason: "no_match",
      status: FieldStatus.OPTIONAL,
    };
  }

  return {
    mapped_profile_key: null,
    confidence: 0,
    reason: "no_match",
    status: FieldStatus.MISSING,
  };
}

/**
 * Map all fields in a batch. Returns the same-order array of mapping results.
 */
export async function mapAllFields(
  fields: DetectedField[],
  profile: AutomationProfile
): Promise<Array<DetectedField & { mapping: FieldMappingResult }>> {
  const results: Array<DetectedField & { mapping: FieldMappingResult }> = [];
  for (const field of fields) {
    const mapping = await mapApplicationField(field, profile);
    results.push({ ...field, mapping });
  }
  return results;
}
