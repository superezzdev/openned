export interface YCJsonLdJob {
  "@context"?: string;
  "@type"?: string;
  title?: string;
  url?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string;
  hiringOrganization?: {
    "@type"?: string;
    name?: string;
    sameAs?: string;
    logo?: string;
  };
  baseSalary?: {
    "@type"?: string;
    currency?: string;
    value?: {
      "@type"?: string;
      unitText?: string;
      value?: number;
      minValue?: number;
      maxValue?: number;
    } | number;
  };
  jobLocation?: Array<{
    "@type"?: string;
    address?: {
      "@type"?: string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    } | string;
  }> | {
    "@type"?: string;
    address?: {
      "@type"?: string;
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
      addressCountry?: string;
    } | string;
  };
  jobLocationType?: string;
  applicantLocationRequirements?: {
    "@type"?: string;
    name?: string;
  };
}

export interface YCEmbeddedJob {
  id?: number | string;
  title?: string;
  url?: string;
  applyUrl?: string;
  location?: string | string[];
  type?: string;
  role?: string;
  roleSpecificType?: string;
  prettyRole?: string;
  salaryRange?: string;
  equityRange?: string;
  minExperience?: string | number;
  visa?: string;
  skills?: string[] | string;
  companyUrl?: string;
  companyLogoUrl?: string;
  companyName?: string;
  companyBatchName?: string;
  companyOneLiner?: string;
  hiringManager?: string;
  createdAt?: string;
  lastActive?: string;
  description?: string;
  interview_process?: string;
}

export interface YCEmbeddedCompany {
  id?: number | string;
  slug?: string;
  name?: string;
  batch_name?: string;
  small_logo_url?: string;
  logo_url?: string;
  one_liner?: string;
  website?: string;
  long_description?: string;
  tags?: string[];
  year_founded?: number;
  team_size?: number;
  location?: string;
  country?: string;
  linkedin_url?: string;
  twitter_url?: string;
  founders?: Array<{
    user_id?: number;
    full_name?: string;
    title?: string | null;
    avatar_thumb_url?: string;
  }>;
}

export interface YCEmbeddedPageData {
  component?: string;
  props?: {
    job?: YCEmbeddedJob;
    company?: YCEmbeddedCompany;
    relatedJobs?: YCEmbeddedJob[];
    jobPostings?: Array<{
      id?: number | string;
      title?: string;
      companyName?: string;
      companyUrl?: string;
      url?: string;
      location?: string;
      salaryRange?: string;
      type?: string;
      role?: string;
    }>;
    jobRoles?: Array<{ name: string; url: string }>;
    jobLocations?: Array<{ name: string; url: string }>;
  };
}

export interface YCJobRaw {
  source_job_id: string;
  title: string;
  company_name: string;
  company_logo_url?: string | null;
  company_url?: string | null;
  job_url: string;
  apply_url?: string | null;

  description?: string | null;
  description_html?: string | null;
  location?: string[] | null;
  remote?: boolean | null;

  employment_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_interval?: string | null;

  job_category?: string | null;
  experience_level?: string | null;

  yc_batch?: string | null;
  company_description?: string | null;

  posted_at?: string | null;
  raw_payload?: Record<string, any> | null;
}

/**
 * Normalized output schema specifically matching user requirements
 */
export interface YCScrapedJob {
  source: "ycombinator";
  source_job_id: string;
  title: string;
  company_name: string;
  company_logo_url?: string | null;
  company_url?: string | null;
  job_url: string;
  apply_url?: string | null;

  description?: string | null;
  description_html?: string | null;
  location?: string[] | null;
  remote?: boolean | null;

  employment_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;

  job_category?: string | null;
  experience_level?: string | null;

  yc_batch?: string | null;
  company_description?: string | null;

  posted_at?: Date | null;
  scraped_at: Date;
  content_hash: string;
  raw_payload?: Record<string, any> | null;
}

export interface ScraperOptions {
  maxJobs?: number;
  concurrency?: number;
  requestDelayMs?: number;
  timeoutMs?: number;
  dryRun?: boolean;
  roles?: string[];
  includeRemoteOnly?: boolean;
}

export interface ScraperResult {
  discovered: number;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  failed: number;
  jobs: YCScrapedJob[];
  errors: string[];
  durationMs: number;
}
