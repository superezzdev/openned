import { GoogleGenAI } from "@google/genai";
import { UserCareerProfile, NormalizedJob, AIRerankResult } from "./types";

const AI_RERANK_SYSTEM_INSTRUCTION = `You are a comparison engine, not a profile generator.
Do not invent:
- user skills
- years of experience
- projects
- employment
- education
- certifications

Use only the supplied verified user profile.
The candidate's verified profile data is ground truth.
Compare the supplied verified profile directly against the job requirements.
If a requirement cannot be evaluated, return UNKNOWN.
Explain reasons concisely based strictly on verified facts.
Return strict JSON matching the schema.`;

const AI_RERANK_PROMPT = (user: UserCareerProfile, job: NormalizedJob) => `Compare this candidate with this job role.

VERIFIED USER PROFILE:
- Target Roles: ${user.target_roles.join(", ")}
- Verified Skills: ${user.all_skills.join(", ")}
- Verified Experience (${user.total_verified_experience_months} months total):
${user.experience.map((e) => `  * ${e.title} at ${e.company} (${e.duration_months} mos, internship: ${e.is_internship})`).join("\n") || "  None"}
- Verified Education:
${user.education.map((e) => `  * ${e.degree} in ${e.field_of_study} at ${e.institution}`).join("\n") || "  None"}
- Verified Projects:
${user.projects.map((p) => `  * ${p.name}: ${p.technologies.join(", ")}`).join("\n") || "  None"}
- Seniority Level: ${user.seniority}

JOB DETAILS:
- Title: ${job.title}
- Company: ${job.company}
- Seniority: ${job.seniority}
- Required Skills: ${job.required_skills.join(", ") || "Unspecified"}
- Preferred Skills: ${job.preferred_skills.join(", ") || "None"}
- Minimum Experience: ${job.minimum_experience_months} months
- Description Snippet: ${job.description.slice(0, 500)}

Return strict JSON:
{
  "role_relevance": number (0-100),
  "skill_match": number (0-100),
  "experience_match": number (0-100),
  "education_match": number (0-100),
  "overall_match": number (0-100),
  "matched_requirements": string[],
  "missing_requirements": string[],
  "reason": string
}`;

/**
 * Re-ranks a single candidate-job pair using Gemini with strict anti-hallucination rules.
 * Falls back gracefully to null on API error.
 */
export async function rerankJobWithAI(
  user: UserCareerProfile,
  job: NormalizedJob
): Promise<AIRerankResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = AI_RERANK_PROMPT(user, job);

    const candidateModels = ["gemini-3.6-flash", "gemini-2.5-flash"];

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: AI_RERANK_SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            temperature: 0.0,
          },
        });

        let jsonStr = response.text || "";
        jsonStr = jsonStr.replace(/```(?:json)?\n?/g, "").trim();

        const parsed = JSON.parse(jsonStr);
        if (parsed && typeof parsed.overall_match === "number") {
          return {
            role_relevance: Math.min(100, Math.max(0, Math.round(parsed.role_relevance || 0))),
            skill_match: Math.min(100, Math.max(0, Math.round(parsed.skill_match || 0))),
            experience_match: Math.min(100, Math.max(0, Math.round(parsed.experience_match || 0))),
            education_match: Math.min(100, Math.max(0, Math.round(parsed.education_match || 0))),
            overall_match: Math.min(100, Math.max(0, Math.round(parsed.overall_match || 0))),
            matched_requirements: Array.isArray(parsed.matched_requirements) ? parsed.matched_requirements : [],
            missing_requirements: Array.isArray(parsed.missing_requirements) ? parsed.missing_requirements : [],
            reason: typeof parsed.reason === "string" ? parsed.reason : "",
          };
        }
      } catch (modelErr) {
        console.warn(`Model ${model} rerank failed:`, modelErr);
      }
    }
  } catch (err) {
    console.warn("AI rerank failed, continuing with deterministic score:", err);
  }

  return null;
}
