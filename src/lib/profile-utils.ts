export interface ProfileDataInput {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
  resumeCount?: number;
  experiences?: Array<{
    company_name?: string | null;
    job_title?: string | null;
    duration?: string | null;
    responsibilities?: string | null;
  }>;
  educations?: Array<{
    institution?: string | null;
    degree?: string | null;
    field_of_study?: string | null;
    duration?: string | null;
  }>;
  skills?: string[];
  projects?: Array<{
    project_name?: string | null;
    description?: string | null;
    link?: string | null;
  }>;
  certifications?: Array<{
    certification_name?: string | null;
    issuer?: string | null;
  }>;
  links?: Array<{
    url_type?: string | null;
    url?: string | null;
  }>;
}

export interface CompletenessItem {
  id: string;
  label: string;
  weight: number;
  completed: boolean;
  tabId: "overview" | "experience" | "education" | "skills" | "projects" | "certifications" | "links";
}

export interface ProfileCompletenessResult {
  percentage: number;
  level: "Starter" | "Growing" | "Strong" | "All-Star";
  colorClass: string;
  strokeColor: string;
  items: CompletenessItem[];
  missingItems: CompletenessItem[];
  completedCount: number;
  totalCount: number;
}

export function calculateProfileCompleteness(
  data: ProfileDataInput
): ProfileCompletenessResult {
  const hasFirstName = Boolean(data.firstName?.trim());
  const hasLastName = Boolean(data.lastName?.trim());
  const hasPhone = Boolean(data.phone?.trim());
  const hasLocation = Boolean(data.location?.trim());
  const hasSummary = Boolean(data.summary?.trim() && data.summary.trim().length >= 20);

  const hasResume = (data.resumeCount || 0) > 0;

  const validExperiences = (data.experiences || []).filter(
    (exp) => exp.company_name?.trim() || exp.job_title?.trim()
  );
  const hasExp1 = validExperiences.length >= 1;
  const hasExp2 = validExperiences.length >= 2;

  const validEducations = (data.educations || []).filter(
    (edu) => edu.institution?.trim() || edu.degree?.trim()
  );
  const hasEducation = validEducations.length >= 1;

  const validSkills = (data.skills || []).filter((s) => s.trim().length > 0);
  const hasSkillsSome = validSkills.length >= 2;
  const hasSkillsMany = validSkills.length >= 5;

  const validProjects = (data.projects || []).filter((p) => p.project_name?.trim());
  const hasProjects = validProjects.length >= 1;

  const validCerts = (data.certifications || []).filter((c) => c.certification_name?.trim());
  const hasCerts = validCerts.length >= 1;

  const validLinks = (data.links || []).filter((l) => l.url?.trim());
  const hasLinks = validLinks.length >= 1;

  const items: CompletenessItem[] = [
    {
      id: "first_name",
      label: "First Name",
      weight: 5,
      completed: hasFirstName,
      tabId: "overview",
    },
    {
      id: "last_name",
      label: "Last Name",
      weight: 5,
      completed: hasLastName,
      tabId: "overview",
    },
    {
      id: "phone",
      label: "Phone Number",
      weight: 5,
      completed: hasPhone,
      tabId: "overview",
    },
    {
      id: "location",
      label: "Location",
      weight: 5,
      completed: hasLocation,
      tabId: "overview",
    },
    {
      id: "summary",
      label: "Professional Summary (>20 chars)",
      weight: 10,
      completed: hasSummary,
      tabId: "overview",
    },
    {
      id: "resume",
      label: "Uploaded Resume File",
      weight: 20,
      completed: hasResume,
      tabId: "overview",
    },
    {
      id: "exp_primary",
      label: "At least 1 Work Experience",
      weight: 10,
      completed: hasExp1,
      tabId: "experience",
    },
    {
      id: "exp_secondary",
      label: "2+ Work Experience Records",
      weight: 10,
      completed: hasExp2,
      tabId: "experience",
    },
    {
      id: "education",
      label: "Education Record",
      weight: 10,
      completed: hasEducation,
      tabId: "education",
    },
    {
      id: "skills_some",
      label: "At least 2 Skills",
      weight: 5,
      completed: hasSkillsSome,
      tabId: "skills",
    },
    {
      id: "skills_many",
      label: "5+ Skills Added",
      weight: 5,
      completed: hasSkillsMany,
      tabId: "skills",
    },
    {
      id: "projects",
      label: "Portfolio Project",
      weight: 4,
      completed: hasProjects,
      tabId: "projects",
    },
    {
      id: "certifications",
      label: "Certification or License",
      weight: 3,
      completed: hasCerts,
      tabId: "certifications",
    },
    {
      id: "links",
      label: "Portfolio or Social Link",
      weight: 3,
      completed: hasLinks,
      tabId: "links",
    },
  ];

  let rawScore = 0;
  for (const item of items) {
    if (item.completed) {
      rawScore += item.weight;
    }
  }

  const percentage = Math.min(100, Math.max(0, Math.round(rawScore)));
  const completedCount = items.filter((i) => i.completed).length;
  const missingItems = items.filter((i) => !i.completed);

  let level: ProfileCompletenessResult["level"] = "Starter";
  let colorClass = "text-amber-400";
  let strokeColor = "#F59E0B";

  if (percentage >= 85) {
    level = "All-Star";
    colorClass = "text-emerald-400";
    strokeColor = "#10B981";
  } else if (percentage >= 60) {
    level = "Strong";
    colorClass = "text-cyan-400";
    strokeColor = "#06B6D4";
  } else if (percentage >= 35) {
    level = "Growing";
    colorClass = "text-blue-400";
    strokeColor = "#3B82F6";
  }

  return {
    percentage,
    level,
    colorClass,
    strokeColor,
    items,
    missingItems,
    completedCount,
    totalCount: items.length,
  };
}
