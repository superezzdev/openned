export interface JobRecord {
  id: string;
  user_id: string;
  platform:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "workable"
    | "wellfound"
    | "smartrecruiters"
    | "ycombinator"
    | "adzuna"
    | "linkedin"
    | "glassdoor"
    | "jsearch"
    | "google-jobs"
    | "indeed"
    | "workday"
    | "jobicy"
    | "remote-jobs"
    | "freelancer"
    | "internships"
    | "custom"
    | string;
  title: string;
  company: string;
  company_logo?: string | null;
  location?: string | null;
  country?: string | null;
  remote_type?: "remote" | "hybrid" | "onsite" | string | null;
  salary?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  description?: string | null;
  tags: string[];
  match_score: number;
  job_url: string;
  source_url?: string | null;
  applied_status: boolean;
  saved_status: boolean;
  posted_at?: string | null;
  fetched_at: string;
  created_at: string;
}

export interface UserProfileData {
  userId: string;
  firstName?: string;
  lastName?: string;
  location?: string;
  summary?: string;
  skills: string[];
  experiences: Array<{
    job_title?: string | null;
    company_name?: string | null;
    responsibilities?: string | null;
    duration?: string | null;
  }>;
  educations: Array<{
    degree?: string | null;
    field_of_study?: string | null;
    institution?: string | null;
  }>;
}

export interface PlatformConfig {
  id: string;
  name: string;
  domain: string;
  siteQuery: string;
  badgeClass: string;
  color: string;
  logoSrc: string;
}

export const SUPPORTED_PLATFORMS: PlatformConfig[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    domain: "linkedin.com/jobs",
    siteQuery: "site:linkedin.com/jobs",
    badgeClass: "bg-sky-600/15 text-sky-400 border-sky-600/30",
    color: "#0A66C2",
    logoSrc: "/platforms/linkedin.svg",
  },
  {
    id: "glassdoor",
    name: "Glassdoor",
    domain: "glassdoor.com",
    siteQuery: "site:glassdoor.com/Job",
    badgeClass: "bg-emerald-600/15 text-emerald-400 border-emerald-600/30",
    color: "#0CAA41",
    logoSrc: "/platforms/glassdoor.svg",
  },
  {
    id: "google-jobs",
    name: "Google Jobs",
    domain: "google.com/search?ibp=htl;jobs",
    siteQuery: "google jobs",
    badgeClass: "bg-red-500/15 text-red-400 border-red-500/30",
    color: "#EA4335",
    logoSrc: "/platforms/googlejobs.svg",
  },
  {
    id: "jsearch",
    name: "JSearch",
    domain: "jsearch.p.rapidapi.com",
    siteQuery: "jsearch",
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    color: "#6366F1",
    logoSrc: "/platforms/jsearch.svg",
  },
  {
    id: "indeed",
    name: "Indeed",
    domain: "indeed.com",
    siteQuery: "site:indeed.com",
    badgeClass: "bg-blue-600/15 text-blue-400 border-blue-600/30",
    color: "#2164F3",
    logoSrc: "/platforms/indeed.svg",
  },
  {
    id: "jobicy",
    name: "Jobicy Remote",
    domain: "jobicy.com",
    siteQuery: "site:jobicy.com",
    badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    color: "#06B6D4",
    logoSrc: "/platforms/jobicy.svg",
  },
  {
    id: "remote-jobs",
    name: "Remote Jobs",
    domain: "remoteok.com / weworkremotely.com",
    siteQuery: "remote jobs",
    badgeClass: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    color: "#8B5CF6",
    logoSrc: "/platforms/remotejobs.svg",
  },
  {
    id: "workday",
    name: "Workday",
    domain: "myworkdayjobs.com",
    siteQuery: "site:myworkdayjobs.com",
    badgeClass: "bg-amber-600/15 text-amber-400 border-amber-600/30",
    color: "#F58220",
    logoSrc: "/platforms/workday.svg",
  },
  {
    id: "adzuna",
    name: "Adzuna",
    domain: "adzuna.in / adzuna.com",
    siteQuery: "site:adzuna.in OR site:adzuna.com",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    color: "#2563EB",
    logoSrc: "/platforms/adzuna.svg",
  },
  {
    id: "ycombinator",
    name: "Y Combinator",
    domain: "ycombinator.com/companies/*/jobs",
    siteQuery: "site:ycombinator.com/companies/*/jobs",
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    color: "#FF6600",
    logoSrc: "/platforms/ycombinator.svg",
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    domain: "boards.greenhouse.io",
    siteQuery: "site:boards.greenhouse.io OR site:greenhouse.io/jobs",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    color: "#10B981",
    logoSrc: "/platforms/Greenhouse.png",
  },
  {
    id: "lever",
    name: "Lever",
    domain: "jobs.lever.co",
    siteQuery: "site:jobs.lever.co OR site:lever.co/jobs",
    badgeClass: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    color: "#6366F1",
    logoSrc: "/platforms/Lever.png",
  },
  {
    id: "ashby",
    name: "Ashby",
    domain: "jobs.ashbyhq.com",
    siteQuery: "site:jobs.ashbyhq.com",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    color: "#8B5CF6",
    logoSrc: "/platforms/Ashby.png",
  },
  {
    id: "workable",
    name: "Workable",
    domain: "apply.workable.com",
    siteQuery: "site:apply.workable.com OR site:workable.com/jobs",
    badgeClass: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    color: "#14B8A6",
    logoSrc: "/platforms/Workable.png",
  },
  {
    id: "wellfound",
    name: "Wellfound",
    domain: "wellfound.com/jobs",
    siteQuery: "site:wellfound.com/jobs",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    color: "#F59E0B",
    logoSrc: "/platforms/wellfound.png",
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters",
    domain: "jobs.smartrecruiters.com",
    siteQuery: "site:jobs.smartrecruiters.com OR site:careers.smartrecruiters.com",
    badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    color: "#0EA5E9",
    logoSrc: "/platforms/SmartRecruiters.png",
  },
  {
    id: "freelancer",
    name: "Freelancer",
    domain: "freelancer.com",
    siteQuery: "site:freelancer.com",
    badgeClass: "bg-blue-400/15 text-blue-300 border-blue-400/30",
    color: "#29B2FE",
    logoSrc: "/platforms/freelancer.svg",
  },
  {
    id: "internships",
    name: "Internships",
    domain: "internships.com",
    siteQuery: "internships",
    badgeClass: "bg-pink-500/15 text-pink-400 border-pink-500/30",
    color: "#EC4899",
    logoSrc: "/platforms/internships.svg",
  },
];

export interface CountryOption {
  code: string;
  name: string;
  flag: string;
}

export const POPULAR_COUNTRIES: CountryOption[] = [
  { code: "all", name: "All Countries", flag: "🌐" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "remote", name: "Remote / Worldwide", flag: "🌍" },
];

export interface JobFilterOption {
  id: string;
  label: string;
  icon?: string;
}

export const JOB_TYPE_OPTIONS: JobFilterOption[] = [
  { id: "all", label: "All Job Types" },
  { id: "full-time", label: "Full-time" },
  { id: "contract", label: "Contract" },
  { id: "internship", label: "Internship" },
  { id: "part-time", label: "Part-time" },
];

export const WORKPLACE_OPTIONS: JobFilterOption[] = [
  { id: "all", label: "Any Workplace" },
  { id: "remote", label: "Remote", icon: "🌐" },
  { id: "hybrid", label: "Hybrid", icon: "🏢" },
  { id: "onsite", label: "On-site", icon: "📍" },
];

export const EXPERIENCE_OPTIONS: JobFilterOption[] = [
  { id: "all", label: "All Levels" },
  { id: "junior", label: "Junior / Entry" },
  { id: "mid", label: "Mid-Level" },
  { id: "senior", label: "Senior" },
  { id: "lead", label: "Lead / Staff" },
];

export const SALARY_OPTIONS: JobFilterOption[] = [
  { id: "all", label: "Any Salary" },
  { id: "50k", label: "$50k+" },
  { id: "80k", label: "$80k+" },
  { id: "100k", label: "$100k+" },
  { id: "120k", label: "$120k+" },
  { id: "150k", label: "$150k+" },
  { id: "200k", label: "$200k+" },
];

export const DATE_POSTED_OPTIONS: JobFilterOption[] = [
  { id: "all", label: "Any Time" },
  { id: "24h", label: "Past 24 Hours" },
  { id: "3d", label: "Past 3 Days" },
  { id: "7d", label: "Past 7 Days" },
  { id: "30d", label: "Past 30 Days" },
];

export interface ActiveJobFilters {
  country: string;
  jobType: string;
  workplace: string;
  experienceLevel: string;
  salaryMin: string;
  datePosted: string;
}

