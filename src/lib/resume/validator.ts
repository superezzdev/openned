import {
  StrictResumeExtraction,
  ValidationResult,
  RejectedField,
  EvidenceField,
} from "./types";

/**
 * Normalizes text for robust anti-hallucination substring matching.
 * Collapses multiple spaces, lowercases, removes non-alphanumeric punctuation.
 */
export function normalizeForSearch(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a candidate string or evidence snippet is grounded in the raw resume text.
 */
export function verifyTextGrounding(
  rawText: string,
  candidateValue: string | null,
  evidenceSnippet?: string | null
): boolean {
  if (!rawText) return false;
  const normalizedRaw = normalizeForSearch(rawText);

  // 1. If evidence snippet is provided, check if evidence exists in raw text
  if (evidenceSnippet && evidenceSnippet.trim().length > 0) {
    const normEvidence = normalizeForSearch(evidenceSnippet);
    if (normEvidence && normalizedRaw.includes(normEvidence)) {
      return true;
    }
  }

  // 2. Check if candidate value itself exists in raw text
  if (candidateValue && candidateValue.trim().length > 0) {
    const normValue = normalizeForSearch(candidateValue);
    if (normValue && normalizedRaw.includes(normValue)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates whether an email is properly formatted.
 */
export function isValidEmail(email: string | null): boolean {
  if (!email) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

/**
 * Validates whether a phone number is plausible.
 */
export function isPlausiblePhone(phone: string | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Validates URL format.
 */
export function isValidUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Parses common month/year or year strings into comparable numeric dates (YYYYMM).
 */
export function parseDateToNumber(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const clean = dateStr.trim().toLowerCase();
  if (clean === "present" || clean === "current" || clean === "now") {
    return 999912; // Far future
  }

  const months: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };

  // Match e.g. "June 2024" or "Nov. 2021"
  const monthYearMatch = clean.match(/([a-z]{3,9})\.?\s+(\d{4})/i);
  if (monthYearMatch) {
    const m = months[monthYearMatch[1].toLowerCase()] || "01";
    return parseInt(`${monthYearMatch[2]}${m}`, 10);
  }

  // Match standalone 4-digit year e.g. "2024"
  const yearMatch = clean.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return parseInt(`${yearMatch[1]}01`, 10);
  }

  return null;
}

/**
 * ResumeProfileValidator
 * Strict anti-hallucination verification engine.
 */
export class ResumeProfileValidator {
  /**
   * Known hallucination patterns or generic placeholders that must never be accepted
   * unless explicitly written in the resume text.
   */
  private static suspiciousPatterns = [
    /john\s+doe/i,
    /jane\s+doe/i,
    /ai\s+solutions\s+inc/i,
    /sies\s+graduate\s+school/i,
    /software\s+developer\s+at\s+company/i,
  ];

  public static isSuspiciousPlaceholder(value: string | null, rawText: string): boolean {
    if (!value) return false;
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(value)) {
        // If the pattern matches, it is suspicious UNLESS raw text explicitly contains it
        if (!verifyTextGrounding(rawText, value)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Validates a raw extracted entity field.
   * If invalid, absent from source, or LOW confidence, returns nullified field with rejected note.
   */
  public static validateField<T extends string>(
    rawText: string,
    field: EvidenceField<T> | null | undefined,
    fieldName: string,
    rejected: RejectedField[],
    allowLowConfidence = false
  ): EvidenceField<T> {
    if (!field || !field.value) {
      return { value: null, confidence: "LOW", evidence: null };
    }

    const valStr = String(field.value).trim();

    // 1. Source grounding verification
    const isGrounded = verifyTextGrounding(rawText, valStr, field.evidence);
    if (!isGrounded) {
      rejected.push({
        field: fieldName,
        value: field.value,
        reason: "Hallucinated or unsupported: entity/evidence not found in source resume text",
      });
      return { value: null, confidence: "LOW", evidence: null };
    }

    // 2. Suspicious placeholder check
    if (this.isSuspiciousPlaceholder(valStr, rawText)) {
      rejected.push({
        field: fieldName,
        value: field.value,
        reason: "Detected unsupported placeholder or generic template string",
      });
      return { value: null, confidence: "LOW", evidence: null };
    }

    // 3. Confidence threshold
    if (field.confidence === "LOW" && !allowLowConfidence) {
      rejected.push({
        field: fieldName,
        value: field.value,
        reason: "Excluded from auto-save due to LOW extraction confidence",
      });
      return { value: null, confidence: "LOW", evidence: field.evidence };
    }

    return {
      value: field.value,
      confidence: field.confidence,
      evidence: field.evidence,
      source_section: field.source_section,
    };
  }

  /**
   * Comprehensive validation of full resume extraction.
   */
  public static validate(
    rawText: string,
    extraction: StrictResumeExtraction
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const rejectedFields: RejectedField[] = [];

    // --- 1. PERSONAL DETAILS ---
    const verifiedFullName = this.validateField(
      rawText,
      extraction.personal.full_name,
      "personal.full_name",
      rejectedFields
    );
    const verifiedFirstName = this.validateField(
      rawText,
      extraction.personal.first_name,
      "personal.first_name",
      rejectedFields
    );
    const verifiedLastName = this.validateField(
      rawText,
      extraction.personal.last_name,
      "personal.last_name",
      rejectedFields
    );

    // Email validation
    let verifiedEmail = this.validateField(
      rawText,
      extraction.personal.email,
      "personal.email",
      rejectedFields
    );
    if (verifiedEmail.value && !isValidEmail(verifiedEmail.value)) {
      rejectedFields.push({
        field: "personal.email",
        value: verifiedEmail.value,
        reason: "Invalid email address format",
      });
      verifiedEmail = { value: null, confidence: "LOW", evidence: null };
    }

    // Phone validation
    let verifiedPhone = this.validateField(
      rawText,
      extraction.personal.phone,
      "personal.phone",
      rejectedFields
    );
    if (verifiedPhone.value && !isPlausiblePhone(verifiedPhone.value)) {
      rejectedFields.push({
        field: "personal.phone",
        value: verifiedPhone.value,
        reason: "Implausible phone number",
      });
      verifiedPhone = { value: null, confidence: "LOW", evidence: null };
    }

    // Location validation (Crucial: verify it is candidate location, not company location)
    const verifiedLocation = this.validateField(
      rawText,
      extraction.personal.location,
      "personal.location",
      rejectedFields
    );

    // --- 2. EDUCATION ---
    const verifiedEducation: StrictResumeExtraction["education"] = [];
    for (let i = 0; i < (extraction.education || []).length; i++) {
      const edu = extraction.education[i];
      const inst = this.validateField(
        rawText,
        edu.institution,
        `education[${i}].institution`,
        rejectedFields
      );
      const degree = this.validateField(
        rawText,
        edu.degree,
        `education[${i}].degree`,
        rejectedFields
      );
      const fieldOfStudy = this.validateField(
        rawText,
        edu.field_of_study,
        `education[${i}].field_of_study`,
        rejectedFields
      );
      const startDate = this.validateField(
        rawText,
        edu.start_date,
        `education[${i}].start_date`,
        rejectedFields
      );
      const endDate = this.validateField(
        rawText,
        edu.end_date,
        `education[${i}].end_date`,
        rejectedFields
      );
      const grade = this.validateField(
        rawText,
        edu.grade,
        `education[${i}].grade`,
        rejectedFields
      );

      // Date order check
      const startNum = parseDateToNumber(startDate.value);
      const endNum = parseDateToNumber(endDate.value);
      if (startNum && endNum && endNum < startNum && endNum !== 999912) {
        warnings.push(`Education end date (${endDate.value}) is before start date (${startDate.value})`);
      }

      // Only keep education if at least institution or degree is grounded
      if (inst.value || degree.value) {
        verifiedEducation.push({
          institution: inst,
          degree,
          field_of_study: fieldOfStudy,
          start_date: startDate,
          end_date: endDate,
          grade,
        });
      }
    }

    // --- 3. EXPERIENCE ---
    const verifiedExperience: StrictResumeExtraction["experience"] = [];
    for (let i = 0; i < (extraction.experience || []).length; i++) {
      const exp = extraction.experience[i];
      const company = this.validateField(
        rawText,
        exp.company,
        `experience[${i}].company`,
        rejectedFields
      );
      const title = this.validateField(
        rawText,
        exp.title,
        `experience[${i}].title`,
        rejectedFields
      );
      const empType = this.validateField(
        rawText,
        exp.employment_type,
        `experience[${i}].employment_type`,
        rejectedFields
      );
      const loc = this.validateField(
        rawText,
        exp.location,
        `experience[${i}].location`,
        rejectedFields
      );
      const startDate = this.validateField(
        rawText,
        exp.start_date,
        `experience[${i}].start_date`,
        rejectedFields
      );
      const endDate = this.validateField(
        rawText,
        exp.end_date,
        `experience[${i}].end_date`,
        rejectedFields
      );
      const desc = this.validateField(
        rawText,
        exp.description,
        `experience[${i}].description`,
        rejectedFields
      );

      // Verify achievements
      const verifiedAchievements = (exp.achievements || []).filter((ach) => {
        return verifyTextGrounding(rawText, ach.value, ach.evidence);
      });

      // Date order check
      const startNum = parseDateToNumber(startDate.value);
      const endNum = parseDateToNumber(endDate.value);
      if (startNum && endNum && endNum < startNum && endNum !== 999912) {
        warnings.push(`Experience end date (${endDate.value}) is before start date (${startDate.value})`);
      }

      // Only keep if company or title is verified
      if (company.value || title.value) {
        verifiedExperience.push({
          company,
          title,
          employment_type: empType,
          location: loc,
          start_date: startDate,
          end_date: endDate,
          description: desc,
          achievements: verifiedAchievements,
        });
      }
    }

    // --- 4. PROJECTS ---
    const verifiedProjects: StrictResumeExtraction["projects"] = [];
    for (let i = 0; i < (extraction.projects || []).length; i++) {
      const proj = extraction.projects[i];
      const name = this.validateField(
        rawText,
        proj.name,
        `projects[${i}].name`,
        rejectedFields
      );
      const desc = this.validateField(
        rawText,
        proj.description,
        `projects[${i}].description`,
        rejectedFields
      );
      const startDate = this.validateField(
        rawText,
        proj.start_date,
        `projects[${i}].start_date`,
        rejectedFields
      );
      const endDate = this.validateField(
        rawText,
        proj.end_date,
        `projects[${i}].end_date`,
        rejectedFields
      );

      const verifiedTech = (proj.technologies || []).filter((t) =>
        verifyTextGrounding(rawText, t.value, t.evidence)
      );
      const verifiedLinks = (proj.links || []).filter((l) =>
        verifyTextGrounding(rawText, l.value, l.evidence)
      );

      if (name.value || desc.value) {
        verifiedProjects.push({
          name,
          technologies: verifiedTech,
          description: desc,
          start_date: startDate,
          end_date: endDate,
          links: verifiedLinks,
        });
      }
    }

    // --- 5. SKILLS ---
    const validateSkillGroup = (
      groupName: keyof StrictResumeExtraction["skills"],
      skillsList: Array<EvidenceField<string>>
    ): Array<EvidenceField<string>> => {
      const verified: Array<EvidenceField<string>> = [];
      for (const skill of skillsList || []) {
        const checked = this.validateField(
          rawText,
          skill,
          `skills.${groupName}.${skill.value}`,
          rejectedFields
        );
        if (checked.value) {
          verified.push(checked);
        }
      }
      return verified;
    };

    const verifiedSkills: StrictResumeExtraction["skills"] = {
      programming_languages: validateSkillGroup("programming_languages", extraction.skills?.programming_languages),
      frameworks: validateSkillGroup("frameworks", extraction.skills?.frameworks),
      databases: validateSkillGroup("databases", extraction.skills?.databases),
      tools: validateSkillGroup("tools", extraction.skills?.tools),
      cloud: validateSkillGroup("cloud", extraction.skills?.cloud),
      devops: validateSkillGroup("devops", extraction.skills?.devops),
      concepts: validateSkillGroup("concepts", extraction.skills?.concepts),
      soft_skills: validateSkillGroup("soft_skills", extraction.skills?.soft_skills),
    };

    // --- 6. ACHIEVEMENTS ---
    const verifiedAchievements: StrictResumeExtraction["achievements"] = [];
    for (let i = 0; i < (extraction.achievements || []).length; i++) {
      const ach = extraction.achievements[i];
      if (verifyTextGrounding(rawText, ach.value, ach.evidence)) {
        verifiedAchievements.push(ach);
      } else {
        rejectedFields.push({
          field: `achievements[${i}]`,
          value: ach.value,
          reason: "Achievement not grounded in source text",
        });
      }
    }

    // --- 7. CERTIFICATIONS ---
    const verifiedCertifications: StrictResumeExtraction["certifications"] = [];
    for (let i = 0; i < (extraction.certifications || []).length; i++) {
      const cert = extraction.certifications[i];
      if (verifyTextGrounding(rawText, cert.certification_name, cert.evidence)) {
        verifiedCertifications.push(cert);
      } else {
        rejectedFields.push({
          field: `certifications[${i}]`,
          value: cert.certification_name,
          reason: "Certification not grounded in source text",
        });
      }
    }

    // --- 8. LINKS ---
    const validateLink = (
      platform: keyof StrictResumeExtraction["links"],
      link: StrictResumeExtraction["links"][typeof platform]
    ) => {
      if (!link) return null;
      // Either username or url must be grounded in raw text
      const grounded =
        verifyTextGrounding(rawText, link.username, link.evidence) ||
        verifyTextGrounding(rawText, link.url, link.evidence);

      if (!grounded) {
        rejectedFields.push({
          field: `links.${platform}`,
          value: link.url || link.username,
          reason: "Link/username not found in source text",
        });
        return null;
      }

      if (link.url && !isValidUrl(link.url)) {
        warnings.push(`Invalid URL format for ${platform}: ${link.url}`);
      }

      return link;
    };

    const verifiedLinks: StrictResumeExtraction["links"] = {
      linkedin: validateLink("linkedin", extraction.links?.linkedin),
      github: validateLink("github", extraction.links?.github),
      portfolio: validateLink("portfolio", extraction.links?.portfolio),
      codeforces: validateLink("codeforces", extraction.links?.codeforces),
      codechef: validateLink("codechef", extraction.links?.codechef),
      leetcode: validateLink("leetcode", extraction.links?.leetcode),
    };

    const verifiedData: StrictResumeExtraction = {
      personal: {
        full_name: verifiedFullName,
        first_name: verifiedFirstName,
        last_name: verifiedLastName,
        email: verifiedEmail,
        phone: verifiedPhone,
        location: verifiedLocation,
      },
      education: verifiedEducation,
      experience: verifiedExperience,
      projects: verifiedProjects,
      skills: verifiedSkills,
      achievements: verifiedAchievements,
      certifications: verifiedCertifications,
      links: verifiedLinks,
    };

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      rejectedFields,
      verifiedData,
    };
  }
}
