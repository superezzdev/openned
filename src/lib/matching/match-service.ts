import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { buildUserCareerProfile } from "./career-profile-builder";
import { normalizeJob } from "./job-normalizer";
import { rankJobsForUser, MatchOptions } from "./matcher";
import { rerankJobWithAI } from "./ai-reranker";
import { NormalizedJob, JobRecommendationScore, UserCareerProfile } from "./types";
import type { JobRecord } from "@/lib/jobs-constants";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder-key";
  return createSupabaseClient(url, key);
}

export interface MatchedJobResult {
  job: JobRecord;
  recommendation: JobRecommendationScore;
}

export interface RecommendedJobsResponse {
  jobs: JobRecord[];
  cached: boolean;
  profileVersion: number;
  totalMatches: number;
}

/**
 * Main Service for Tailored Job Matching and Caching
 */
export class JobMatchService {
  /**
   * Retrieves or computes tailored recommendations for a user.
   */
  async getRecommendedJobsForUser(
    userId: string,
    options: {
      forceRefresh?: boolean;
      platform?: string;
      limit?: number;
      minThreshold?: number;
    } = {}
  ): Promise<RecommendedJobsResponse> {
    let supabase: any;
    try {
      supabase = await createServerClient();
    } catch {
      supabase = getSupabaseClient();
    }

    // 1. Fetch user's profile and verified collections
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      return { jobs: [], cached: false, profileVersion: 1, totalMatches: 0 };
    }

    const currentProfileVersion = profile.profile_version || 1;

    // Fetch verified child collections in parallel
    const [skillsRes, expRes, eduRes, projRes, interactionsRes] = await Promise.all([
      supabase.from("skills").select("skill_name").eq("profile_id", profile.id),
      supabase.from("experiences").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("educations").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("projects").select("*").eq("profile_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("user_job_interactions").select("*").eq("user_id", userId),
    ]);

    const userCareerProfile = buildUserCareerProfile({
      userId,
      profile,
      skills: skillsRes.data || [],
      experiences: expRes.data || [],
      educations: eduRes.data || [],
      projects: projRes.data || [],
    });

    // Build interactions map
    const interactionMap = new Map<string, { saved_status: boolean; applied_status: boolean; not_relevant: boolean; hidden: boolean }>();
    if (interactionsRes.data) {
      for (const item of interactionsRes.data) {
        interactionMap.set(item.canonical_job_id, {
          saved_status: Boolean(item.saved_status),
          applied_status: Boolean(item.applied_status),
          not_relevant: Boolean(item.not_relevant),
          hidden: Boolean(item.hidden),
        });
      }
    }

    // 2. Check cached job matches if forceRefresh is false
    if (!options.forceRefresh) {
      const { data: cachedMatches } = await supabase
        .from("job_matches")
        .select("*, canonical_jobs(*)")
        .eq("user_id", userId)
        .eq("profile_version", currentProfileVersion)
        .order("score", { ascending: false })
        .limit(options.limit || 50);

      if (cachedMatches && cachedMatches.length > 0) {
        const jobs: JobRecord[] = [];
        for (const cm of cachedMatches) {
          const cj = cm.canonical_jobs;
          if (!cj || !cj.active) continue;

          // Check if user hid or marked not relevant since calculation
          const inter = interactionMap.get(cj.id);
          if (inter?.hidden || inter?.not_relevant) continue;

          // Platform filter
          if (options.platform && options.platform !== "all") {
            const jp = (cj.source || "").toLowerCase();
            const p = options.platform.toLowerCase();
            if (!jp.includes(p) && !p.includes(jp)) continue;
          }

          jobs.push(this.transformToJobRecord(cj, cm, inter));
        }

        if (jobs.length > 0) {
          return {
            jobs,
            cached: true,
            profileVersion: currentProfileVersion,
            totalMatches: jobs.length,
          };
        }
      }
    }

    // 3. Compute fresh matches from canonical jobs
    // Query active canonical jobs from database
    let queryBuilder = supabase
      .from("canonical_jobs")
      .select("*")
      .eq("active", true)
      .order("posted_at", { ascending: false, nullsFirst: false })
      .limit(200);

    const { data: rawJobs, error: jobsError } = await queryBuilder;
    if (jobsError || !rawJobs || rawJobs.length === 0) {
      return { jobs: [], cached: false, profileVersion: currentProfileVersion, totalMatches: 0 };
    }

    // Normalize jobs
    const normalizedJobs: NormalizedJob[] = rawJobs.map((rj: any) => {
      if (rj.normalized_job_data && typeof rj.normalized_job_data === "object") {
        return rj.normalized_job_data as NormalizedJob;
      }
      return normalizeJob(rj);
    });

    // Rank jobs using deterministic multi-stage matching engine
    const matchOptions: MatchOptions = {
      userInteractions: interactionMap,
      minThreshold: options.minThreshold ?? 45,
      maxPerCompany: 4,
    };

    const rankedResults = rankJobsForUser(userCareerProfile, normalizedJobs, matchOptions);

    // Optional: AI Semantic Rerank top 5 candidates if available
    const topForAI = rankedResults.slice(0, 5);
    await Promise.allSettled(
      topForAI.map(async (item) => {
        try {
          const aiResult = await rerankJobWithAI(userCareerProfile, item.job);
          if (aiResult) {
            // Blend AI score (30% weight) with deterministic score (70% weight)
            item.score.score = Math.round(0.70 * item.score.score + 0.30 * aiResult.overall_match);
            if (aiResult.reason && aiResult.reason.trim()) {
              item.score.reasons = [aiResult.reason, ...item.score.reasons.slice(0, 2)];
              item.score.explanation = aiResult.reason;
            }
            if (aiResult.missing_requirements.length > 0) {
              item.score.missing_requirements = Array.from(
                new Set([...item.score.missing_requirements, ...aiResult.missing_requirements])
              );
            }
          }
        } catch {}
      })
    );

    // Re-sort top after potential AI adjustment
    rankedResults.sort((a, b) => b.score.score - a.score.score);

    // 4. Cache results in public.job_matches
    if (rankedResults.length > 0) {
      const matchRows = rankedResults.map((r) => ({
        user_id: userId,
        job_id: r.job.id,
        score: r.score.score,
        match_level: r.score.match_level,
        reasons: r.score.reasons,
        missing_requirements: r.score.missing_requirements,
        matched_skills: r.score.matched_skills,
        experience_match: r.score.experience_match,
        role_match: r.score.role_match,
        location_match: r.score.location_match,
        explanation: r.score.explanation,
        profile_version: currentProfileVersion,
        calculated_at: new Date().toISOString(),
      }));

      // Upsert in background
      supabase
        .from("job_matches")
        .upsert(matchRows, { onConflict: "user_id,job_id" })
        .then(() => {})
        .catch((err: any) => console.warn("Failed to cache job matches:", err));
    }

    // 5. Transform to JobRecord format for dashboard UI
    const finalJobs: JobRecord[] = rankedResults
      .map((r) => {
        const rawCj = rawJobs.find((rj: any) => rj.id === r.job.id);
        const inter = interactionMap.get(r.job.id);
        return this.transformToJobRecord(rawCj || r.job, r.score, inter);
      })
      .filter((j) => {
        if (!options.platform || options.platform === "all") return true;
        const jp = (j.platform || "").toLowerCase();
        const p = options.platform.toLowerCase();
        return jp === p || jp.includes(p) || p.includes(jp);
      });

    return {
      jobs: finalJobs,
      cached: false,
      profileVersion: currentProfileVersion,
      totalMatches: finalJobs.length,
    };
  }

  /**
   * Helper to format CanonicalJob + MatchScore into JobRecord
   */
  private transformToJobRecord(
    canonicalJob: any,
    scoreResult: any,
    interaction?: { saved_status?: boolean; applied_status?: boolean }
  ): JobRecord {
    const rawScore = scoreResult.score;
    const cleanScore = typeof rawScore === "number" ? Math.min(100, Math.max(0, rawScore)) : 50;

    let salaryDisplay = null;
    if (canonicalJob.salary_min && canonicalJob.salary_max) {
      const cur = canonicalJob.salary_currency === "EUR" ? "€" : canonicalJob.salary_currency === "GBP" ? "£" : "$";
      salaryDisplay = `${cur}${Math.round(canonicalJob.salary_min / 1000)}k - ${cur}${Math.round(canonicalJob.salary_max / 1000)}k`;
    }

    return {
      id: canonicalJob.id,
      user_id: scoreResult.user_id || "",
      platform: canonicalJob.source || "canonical",
      title: canonicalJob.title,
      company: canonicalJob.company_name || canonicalJob.company || "Company",
      company_logo: canonicalJob.company_logo || null,
      location: canonicalJob.location || "Remote",
      country: canonicalJob.country || null,
      remote_type: canonicalJob.remote_type || "remote",
      salary: salaryDisplay,
      salary_min: canonicalJob.salary_min || null,
      salary_max: canonicalJob.salary_max || null,
      salary_currency: canonicalJob.salary_currency || "USD",
      job_type: canonicalJob.employment_type || "full-time",
      experience_level: scoreResult.experience_match >= 85 ? "Entry Level" : "Mid Level",
      description: canonicalJob.description || "",
      tags: scoreResult.matched_skills || [],
      match_score: cleanScore,
      job_url: canonicalJob.job_url,
      apply_url: canonicalJob.apply_url || canonicalJob.job_url,
      source_url: canonicalJob.apply_url || canonicalJob.job_url,
      applied_status: Boolean(interaction?.applied_status),
      saved_status: Boolean(interaction?.saved_status),
      posted_at: canonicalJob.posted_at || null,
      fetched_at: canonicalJob.scraped_at || canonicalJob.created_at || new Date().toISOString(),
      created_at: canonicalJob.created_at || new Date().toISOString(),
      // Custom explainable match metadata
      match_level: scoreResult.match_level,
      reasons: scoreResult.reasons || [],
      missing_requirements: scoreResult.missing_requirements || [],
      matched_skills: scoreResult.matched_skills || [],
      explanation: scoreResult.explanation,
    } as any;
  }
}

export const jobMatchService = new JobMatchService();
