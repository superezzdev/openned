import { createClient } from "@supabase/supabase-js";
import {
  StrictResumeExtraction,
  ValidationResult,
  EvidenceField,
} from "./types";
import { ResumeProfileValidator } from "./validator";
import { PARSER_VERSION } from "./parser-engine";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export interface SyncProfileResult {
  parsedProfileId: string;
  validation: ValidationResult;
  appliedFieldsCount: number;
  auditEntriesCount: number;
}

/**
 * Stages the raw extraction, validates it with anti-hallucination guard,
 * writes audit logs, and synchronizes verified data to user profile.
 */
export async function stageAndSyncResumeProfile(
  profileId: string,
  resumeId: string | null,
  rawText: string,
  extraction: StrictResumeExtraction
): Promise<SyncProfileResult> {
  const supabase = getAdminClient();

  // 1. Run Anti-Hallucination & Source Grounding Validation
  const validation = ResumeProfileValidator.validate(rawText, extraction);
  const verified = validation.verifiedData;

  // 2. Stage in public.resume_parsed_profiles
  const { data: stagedRecord, error: stageError } = await supabase
    .from("resume_parsed_profiles")
    .insert({
      profile_id: profileId,
      resume_file_id: resumeId,
      parser_version: PARSER_VERSION,
      parsed_data: extraction,
      extraction_confidence: validation.rejectedFields.length > 3 ? "MEDIUM" : "HIGH",
      evidence: {
        personal: extraction.personal,
        experience_count: extraction.experience.length,
        education_count: extraction.education.length,
        skills_count: Object.values(extraction.skills).reduce((acc, arr) => acc + arr.length, 0),
        rejected_fields: validation.rejectedFields,
      },
      validation_results: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        rejected_count: validation.rejectedFields.length,
      },
      status: "verified",
      raw_text: rawText,
      parsed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (stageError) {
    console.error("Failed to stage parsed resume record:", stageError);
  }

  const parsedProfileId = stagedRecord?.id || "";

  // 3. Fetch existing profile for audit comparison
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  const auditEntries: Array<{
    resume_id: string | null;
    profile_id: string;
    parser_version: string;
    field: string;
    old_value: any;
    new_value: any;
    source_evidence: string | null;
    confidence: string;
  }> = [];

  // Helper to record diff
  const recordAudit = (field: string, oldValue: any, newValue: any, evidence: string | null, confidence: string) => {
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      auditEntries.push({
        resume_id: resumeId,
        profile_id: profileId,
        parser_version: PARSER_VERSION,
        field,
        old_value: oldValue ?? null,
        new_value: newValue ?? null,
        source_evidence: evidence,
        confidence,
      });
    }
  };

  // 4. Update Main Profile Record with Verified Resume Data
  // Resume data is the primary source of truth for the candidate's professional profile
  const profileUpdates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (verified.personal.first_name.value) {
    recordAudit(
      "first_name",
      existingProfile?.first_name,
      verified.personal.first_name.value,
      verified.personal.first_name.evidence,
      verified.personal.first_name.confidence
    );
    profileUpdates.first_name = verified.personal.first_name.value;
  }

  if (verified.personal.last_name.value) {
    recordAudit(
      "last_name",
      existingProfile?.last_name,
      verified.personal.last_name.value,
      verified.personal.last_name.evidence,
      verified.personal.last_name.confidence
    );
    profileUpdates.last_name = verified.personal.last_name.value;
  }

  if (verified.personal.phone.value) {
    recordAudit(
      "phone",
      existingProfile?.phone,
      verified.personal.phone.value,
      verified.personal.phone.evidence,
      verified.personal.phone.confidence
    );
    profileUpdates.phone = verified.personal.phone.value;
  }

  // Email: Update profile email with verified candidate email from resume
  if (verified.personal.email.value) {
    recordAudit(
      "email",
      existingProfile?.email,
      verified.personal.email.value,
      verified.personal.email.evidence,
      verified.personal.email.confidence
    );
    profileUpdates.email = verified.personal.email.value;
  }

  // Location: If resume has candidate home location, set it. If not, reset any hallucinated/unsupported location to null.
  recordAudit(
    "location",
    existingProfile?.location,
    verified.personal.location.value || null,
    verified.personal.location.evidence,
    verified.personal.location.confidence
  );
  profileUpdates.location = verified.personal.location.value || null;

  // Summary: If resume has verified summary, set it. If not, reset any hallucinated summary to null.
  recordAudit(
    "summary",
    existingProfile?.summary,
    null,
    null,
    "HIGH"
  );
  profileUpdates.summary = null;

  // Links on profiles table
  if (verified.links.linkedin?.url) {
    recordAudit(
      "linkedin_url",
      existingProfile?.linkedin_url,
      verified.links.linkedin.url,
      verified.links.linkedin.evidence,
      "HIGH"
    );
    profileUpdates.linkedin_url = verified.links.linkedin.url;
  }

  if (verified.links.github?.url) {
    recordAudit(
      "github_url",
      existingProfile?.github_url,
      verified.links.github.url,
      verified.links.github.evidence,
      "HIGH"
    );
    profileUpdates.github_url = verified.links.github.url;
  }

  if (verified.links.portfolio?.url) {
    recordAudit(
      "portfolio_url",
      existingProfile?.portfolio_url,
      verified.links.portfolio.url,
      verified.links.portfolio.evidence,
      "HIGH"
    );
    profileUpdates.portfolio_url = verified.links.portfolio.url;
  }

  // Increment profile version to invalidate stale cached job matches
  const nextProfileVersion = (existingProfile?.profile_version || 1) + 1;
  profileUpdates.profile_version = nextProfileVersion;

  // Execute profile update
  await supabase.from("profiles").update(profileUpdates).eq("id", profileId);

  // Invalidate old job matches for this user when profile version changes
  if (existingProfile?.user_id) {
    await supabase.from("job_matches").delete().eq("user_id", existingProfile.user_id);
  }

  // 5. Clean up old hallucinated / stale child collections
  await Promise.all([
    supabase.from("skills").delete().eq("profile_id", profileId),
    supabase.from("experiences").delete().eq("profile_id", profileId),
    supabase.from("educations").delete().eq("profile_id", profileId),
    supabase.from("projects").delete().eq("profile_id", profileId),
    supabase.from("certifications").delete().eq("profile_id", profileId),
    supabase.from("links").delete().eq("profile_id", profileId),
  ]);

  // 6. Insert Verified Skills (flattened from categories, deduplicated)
  const allVerifiedSkills = new Map<string, string>(); // skill_name -> evidence
  Object.values(verified.skills).forEach((skillGroup: Array<EvidenceField<string>>) => {
    skillGroup.forEach((s: EvidenceField<string>) => {
      if (s.value && s.value.trim().length > 0) {
        allVerifiedSkills.set(s.value.trim(), s.evidence || s.value);
      }
    });
  });

  if (allVerifiedSkills.size > 0) {
    const skillRows = Array.from(allVerifiedSkills.entries()).map(([name, ev]) => {
      recordAudit("skill", null, name, ev, "HIGH");
      return {
        profile_id: profileId,
        skill_name: name,
      };
    });
    await supabase.from("skills").insert(skillRows);
  }

  // 7. Insert Verified Experiences
  if (verified.experience.length > 0) {
    const expRows = verified.experience.map((exp) => {
      const duration = [exp.start_date.value, exp.end_date.value].filter(Boolean).join(" - ");
      const responsibilities = exp.achievements.map((a) => a.value).join("\n• ") || exp.description.value || "";

      recordAudit(
        "experience",
        null,
        `${exp.company.value} | ${exp.title.value}`,
        exp.company.evidence || exp.title.evidence,
        exp.company.confidence
      );

      return {
        profile_id: profileId,
        company_name: exp.company.value,
        job_title: exp.title.value,
        duration: duration || null,
        responsibilities: responsibilities ? (responsibilities.startsWith("•") ? responsibilities : `• ${responsibilities}`) : null,
      };
    });
    await supabase.from("experiences").insert(expRows);
  }

  // 8. Insert Verified Educations
  if (verified.education.length > 0) {
    const eduRows = verified.education.map((edu) => {
      const duration = [edu.start_date.value, edu.end_date.value].filter(Boolean).join(" - ");
      let fieldOfStudy = edu.field_of_study.value || "";
      if (edu.grade.value) {
        fieldOfStudy += fieldOfStudy ? ` (CGPA / Grade: ${edu.grade.value})` : `Grade: ${edu.grade.value}`;
      }

      recordAudit(
        "education",
        null,
        `${edu.institution.value} | ${edu.degree.value}`,
        edu.institution.evidence,
        edu.institution.confidence
      );

      return {
        profile_id: profileId,
        institution: edu.institution.value,
        degree: edu.degree.value,
        field_of_study: fieldOfStudy || null,
        duration: duration || null,
      };
    });
    await supabase.from("educations").insert(eduRows);
  }

  // 9. Insert Verified Projects
  if (verified.projects.length > 0) {
    const projRows = verified.projects.map((proj) => {
      const techStr = proj.technologies.map((t) => t.value).filter(Boolean).join(", ");
      let desc = proj.description.value || "";
      if (techStr) {
        desc = `[Technologies: ${techStr}]\n${desc}`.trim();
      }
      const firstLink = proj.links[0]?.value || null;

      recordAudit(
        "project",
        null,
        proj.name.value,
        proj.name.evidence,
        proj.name.confidence
      );

      return {
        profile_id: profileId,
        project_name: proj.name.value,
        description: desc || null,
        link: firstLink,
      };
    });
    await supabase.from("projects").insert(projRows);
  }

  // 10. Insert Verified Certifications
  if (verified.certifications.length > 0) {
    const certRows = verified.certifications.map((cert) => {
      recordAudit("certification", null, cert.certification_name, cert.evidence, cert.confidence);
      return {
        profile_id: profileId,
        certification_name: cert.certification_name,
        issuer: cert.issuer,
      };
    });
    await supabase.from("certifications").insert(certRows);
  }

  // 11. Insert Verified Links
  const linkList: Array<{ url_type: string; url: string; evidence: string | null }> = [];
  if (verified.links.linkedin?.url) {
    linkList.push({ url_type: "LinkedIn", url: verified.links.linkedin.url, evidence: verified.links.linkedin.evidence });
  }
  if (verified.links.github?.url) {
    linkList.push({ url_type: "GitHub", url: verified.links.github.url, evidence: verified.links.github.evidence });
  }
  if (verified.links.leetcode?.url) {
    linkList.push({ url_type: "LeetCode", url: verified.links.leetcode.url, evidence: verified.links.leetcode.evidence });
  }
  if (verified.links.codeforces?.url) {
    linkList.push({ url_type: "CodeForces", url: verified.links.codeforces.url, evidence: verified.links.codeforces.evidence });
  }
  if (verified.links.codechef?.url) {
    linkList.push({ url_type: "CodeChef", url: verified.links.codechef.url, evidence: verified.links.codechef.evidence });
  }
  if (verified.links.portfolio?.url) {
    linkList.push({ url_type: "Portfolio", url: verified.links.portfolio.url, evidence: verified.links.portfolio.evidence });
  }

  if (linkList.length > 0) {
    const linkRows = linkList.map((l) => {
      recordAudit("link", null, `${l.url_type}: ${l.url}`, l.evidence, "HIGH");
      return {
        profile_id: profileId,
        url_type: l.url_type,
        url: l.url,
      };
    });
    await supabase.from("links").insert(linkRows);
  }

  // 12. Save Audit Entries to public.resume_audit_logs
  if (auditEntries.length > 0) {
    await supabase.from("resume_audit_logs").insert(auditEntries);
  }

  return {
    parsedProfileId,
    validation,
    appliedFieldsCount: Object.keys(profileUpdates).length + allVerifiedSkills.size + verified.experience.length + verified.education.length + verified.projects.length + linkList.length,
    auditEntriesCount: auditEntries.length,
  };
}
