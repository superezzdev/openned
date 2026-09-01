import { describe, it, expect } from "vitest";
import { mapApplicationField } from "../../src/lib/applications/field-mapper";
import { resolveProfileValue, detectMissingFields } from "../../src/lib/applications/profile-resolver";
import { DetectedField, FieldStatus, AutomationProfile } from "../../src/lib/applications/types";

const mockProfile: AutomationProfile = {
  user_id: "user-123",
  first_name: "Alex",
  last_name: "Smith",
  email: "alex@example.com",
  phone: "+1 555 123 4567",
  location: "San Francisco, CA",
  city: "San Francisco",
  state: "CA",
  country: "USA",
  summary: "Experienced Full Stack Developer with 6+ years building web applications.",
  linkedin_url: "https://linkedin.com/in/alexsmith",
  github_url: "https://github.com/alexsmith",
  portfolio_url: "https://alexsmith.dev",
  work_authorization: "Authorized to work in US without sponsorship",
  years_experience: 6,
  skills: ["React", "TypeScript", "Node.js"],
  experiences: [],
  educations: [],
  resume_url: "https://storage.supabase.co/resumes/alex-resume.pdf",
};

describe("FieldMapper - Deterministic Mapping", () => {
  it("maps first name field deterministically", async () => {
    const field: DetectedField = {
      field_id: "first_name",
      label: "First Name",
      type: "text",
      required: true,
      selector: "#first_name",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("first_name");
    expect(res.status).toBe(FieldStatus.MAPPED);
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("maps last name / surname field deterministically", async () => {
    const field: DetectedField = {
      field_id: "last_name",
      label: "Last Name / Surname",
      type: "text",
      required: true,
      selector: "#last_name",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("last_name");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("maps email address field deterministically", async () => {
    const field: DetectedField = {
      field_id: "email",
      label: "Email Address",
      type: "email",
      required: true,
      selector: "#email",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("email");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("maps phone number field deterministically", async () => {
    const field: DetectedField = {
      field_id: "phone",
      label: "Phone / Mobile",
      type: "tel",
      required: true,
      selector: "#phone",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("phone");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("maps LinkedIn URL field deterministically", async () => {
    const field: DetectedField = {
      field_id: "linkedin",
      label: "LinkedIn Profile URL",
      type: "url",
      required: false,
      selector: "#linkedin",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("linkedin_url");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("maps GitHub URL field deterministically", async () => {
    const field: DetectedField = {
      field_id: "github",
      label: "GitHub Profile",
      type: "url",
      required: false,
      selector: "#github",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("github_url");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("maps Work Authorization field deterministically", async () => {
    const field: DetectedField = {
      field_id: "work_auth",
      label: "Are you authorized to work in the United States?",
      type: "select",
      required: true,
      selector: "#work_auth",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("work_authorization");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("maps resume file input deterministically", async () => {
    const field: DetectedField = {
      field_id: "resume_upload",
      label: "Attach Resume / CV",
      type: "file",
      required: true,
      selector: "input[type='file']",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.mapped_profile_key).toBe("resume");
    expect(res.status).toBe(FieldStatus.MAPPED);
  });

  it("marks optional unmapped fields as OPTIONAL", async () => {
    const field: DetectedField = {
      field_id: "custom_notes",
      label: "Any additional notes or comments?",
      type: "textarea",
      required: false,
      selector: "#notes",
      source: "label",
    };
    const res = await mapApplicationField(field, mockProfile);
    expect(res.status).toBe(FieldStatus.OPTIONAL);
  });
});

describe("ProfileResolver", () => {
  it("resolves correct values from profile", () => {
    expect(resolveProfileValue("first_name", mockProfile)).toBe("Alex");
    expect(resolveProfileValue("last_name", mockProfile)).toBe("Smith");
    expect(resolveProfileValue("email", mockProfile)).toBe("alex@example.com");
    expect(resolveProfileValue("phone", mockProfile)).toBe("+1 555 123 4567");
    expect(resolveProfileValue("linkedin_url", mockProfile)).toBe("https://linkedin.com/in/alexsmith");
    expect(resolveProfileValue("years_experience", mockProfile)).toBe("6");
  });

  it("returns null for missing profile properties", () => {
    const emptyProfile: AutomationProfile = {
      user_id: "u2",
      skills: [],
      experiences: [],
      educations: [],
    };
    expect(resolveProfileValue("first_name", emptyProfile)).toBeNull();
    expect(resolveProfileValue("phone", emptyProfile)).toBeNull();
    expect(resolveProfileValue("non_existent_key", emptyProfile)).toBeNull();
  });

  it("detects missing required fields when profile lacks them", () => {
    const incompleteProfile: AutomationProfile = {
      user_id: "u3",
      first_name: "Bob",
      // phone, email missing
      skills: [],
      experiences: [],
      educations: [],
    };

    const fieldsWithMapping = [
      {
        field_id: "first_name",
        label: "First Name",
        type: "text" as const,
        required: true,
        selector: "#fname",
        source: "label" as const,
        mapping: {
          mapped_profile_key: "first_name",
          confidence: 0.95,
          reason: "direct_match" as const,
          status: FieldStatus.MAPPED,
        },
      },
      {
        field_id: "phone",
        label: "Phone Number",
        type: "tel" as const,
        required: true,
        selector: "#phone",
        source: "label" as const,
        mapping: {
          mapped_profile_key: "phone",
          confidence: 0.95,
          reason: "direct_match" as const,
          status: FieldStatus.MAPPED,
        },
      },
    ];

    const missing = detectMissingFields(fieldsWithMapping, incompleteProfile);
    expect(missing).toHaveLength(1);
    expect(missing[0].field_key).toBe("phone");
    expect(missing[0].label).toBe("Phone Number");
  });
});
