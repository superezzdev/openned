"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  Phone,
  MapPin,
  FileText,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Plus,
  Trash2,
  Briefcase,
  GraduationCap,
  FolderGit2,
  Award,
  Link as LinkIcon,
  ExternalLink,
  X,
  Mail,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProfileStats } from "./profile-stats";
import { CircularProgress } from "./circular-progress";
import {
  calculateProfileCompleteness,
  ProfileDataInput,
} from "@/lib/profile-utils";

export interface ProfileRecord {
  id?: string;
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
}

export interface SkillRecord {
  id?: string;
  skill_name: string;
}

export interface ExperienceRecord {
  id?: string;
  company_name: string | null;
  job_title: string | null;
  duration: string | null;
  responsibilities: string | null;
}

export interface EducationRecord {
  id?: string;
  institution: string | null;
  degree: string | null;
  field_of_study: string | null;
  duration: string | null;
}

export interface ProjectRecord {
  id?: string;
  project_name: string | null;
  description: string | null;
  link: string | null;
}

export interface CertificationRecord {
  id?: string;
  certification_name: string | null;
  issuer: string | null;
}

export interface LinkRecord {
  id?: string;
  url_type: string | null;
  url: string | null;
}

export interface ResumeRecord {
  id?: string;
  file_name?: string;
  file_path?: string;
  uploaded_at?: string;
}

interface ProfileEditorProps {
  initialProfile: ProfileRecord | null;
  initialSkills?: SkillRecord[];
  initialExperiences?: ExperienceRecord[];
  initialEducations?: EducationRecord[];
  initialProjects?: ProjectRecord[];
  initialCertifications?: CertificationRecord[];
  initialLinks?: LinkRecord[];
  initialResumes?: ResumeRecord[];
  userEmail: string;
  userId: string;
}

type TabType =
  | "overview"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "links";

const POPULAR_SKILL_SUGGESTIONS = [
  "React",
  "TypeScript",
  "Next.js",
  "Node.js",
  "Python",
  "Tailwind CSS",
  "PostgreSQL",
  "Docker",
  "AWS",
  "GraphQL",
  "REST APIs",
  "Git",
];

export function ProfileEditor({
  initialProfile,
  initialSkills = [],
  initialExperiences = [],
  initialEducations = [],
  initialProjects = [],
  initialCertifications = [],
  initialLinks = [],
  initialResumes = [],
  userEmail,
  userId,
}: ProfileEditorProps) {
  const router = useRouter();
  const supabase = createClient();

  // Basic Profile State
  const [firstName, setFirstName] = useState(initialProfile?.first_name || "");
  const [lastName, setLastName] = useState(initialProfile?.last_name || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [location, setLocation] = useState(initialProfile?.location || "");
  const [summary, setSummary] = useState(initialProfile?.summary || "");

  // Skills State
  const [skills, setSkills] = useState<string[]>(
    initialSkills.map((s) => s.skill_name).filter(Boolean)
  );
  const [newSkillInput, setNewSkillInput] = useState("");

  // Experience State
  const [experiences, setExperiences] =
    useState<ExperienceRecord[]>(initialExperiences);

  // Education State
  const [educations, setEducations] =
    useState<EducationRecord[]>(initialEducations);

  // Projects State
  const [projects, setProjects] = useState<ProjectRecord[]>(initialProjects);

  // Certifications State
  const [certifications, setCertifications] =
    useState<CertificationRecord[]>(initialCertifications);

  // Links State
  const [links, setLinks] = useState<LinkRecord[]>(initialLinks);

  // Resumes State (Read-only reference for metrics)
  const [resumes] = useState<ResumeRecord[]>(initialResumes);

  // Save / Sync State
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Dynamic Profile Data for live calculations & reactive stat cards
  const profileData: ProfileDataInput = useMemo(
    () => ({
      firstName,
      lastName,
      email: userEmail,
      phone,
      location,
      summary,
      resumeCount: resumes.length,
      experiences,
      educations,
      skills,
      projects,
      certifications,
      links,
    }),
    [
      firstName,
      lastName,
      userEmail,
      phone,
      location,
      summary,
      resumes.length,
      experiences,
      educations,
      skills,
      projects,
      certifications,
      links,
    ]
  );

  const completeness = useMemo(
    () => calculateProfileCompleteness(profileData),
    [profileData]
  );

  // Skill Handlers
  const handleAddSkill = (e?: React.KeyboardEvent | React.MouseEvent) => {
    if (e && "key" in e && e.key !== "Enter" && e.key !== ",") return;
    if (e && "preventDefault" in e) e.preventDefault();

    const trimmed = newSkillInput.replace(/,/g, "").trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
      setNewSkillInput("");
    }
  };

  const handleAddSuggestedSkill = (skill: string) => {
    if (!skills.includes(skill)) {
      setSkills([...skills, skill]);
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  // Experience Handlers
  const handleAddExperience = () => {
    setExperiences([
      ...experiences,
      {
        company_name: "",
        job_title: "",
        duration: "",
        responsibilities: "",
      },
    ]);
  };

  const handleUpdateExperience = (
    index: number,
    field: keyof ExperienceRecord,
    val: string
  ) => {
    const updated = [...experiences];
    updated[index] = { ...updated[index], [field]: val };
    setExperiences(updated);
  };

  const handleRemoveExperience = (index: number) => {
    setExperiences(experiences.filter((_, i) => i !== index));
  };

  // Education Handlers
  const handleAddEducation = () => {
    setEducations([
      ...educations,
      {
        institution: "",
        degree: "",
        field_of_study: "",
        duration: "",
      },
    ]);
  };

  const handleUpdateEducation = (
    index: number,
    field: keyof EducationRecord,
    val: string
  ) => {
    const updated = [...educations];
    updated[index] = { ...updated[index], [field]: val };
    setEducations(updated);
  };

  const handleRemoveEducation = (index: number) => {
    setEducations(educations.filter((_, i) => i !== index));
  };

  // Project Handlers
  const handleAddProject = () => {
    setProjects([
      ...projects,
      {
        project_name: "",
        description: "",
        link: "",
      },
    ]);
  };

  const handleUpdateProject = (
    index: number,
    field: keyof ProjectRecord,
    val: string
  ) => {
    const updated = [...projects];
    updated[index] = { ...updated[index], [field]: val };
    setProjects(updated);
  };

  const handleRemoveProject = (index: number) => {
    setProjects(projects.filter((_, i) => i !== index));
  };

  // Certification Handlers
  const handleAddCertification = () => {
    setCertifications([
      ...certifications,
      {
        certification_name: "",
        issuer: "",
      },
    ]);
  };

  const handleUpdateCertification = (
    index: number,
    field: keyof CertificationRecord,
    val: string
  ) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: val };
    setCertifications(updated);
  };

  const handleRemoveCertification = (index: number) => {
    setCertifications(certifications.filter((_, i) => i !== index));
  };

  // Link Handlers
  const handleAddLink = () => {
    setLinks([
      ...links,
      {
        url_type: "LinkedIn",
        url: "",
      },
    ]);
  };

  const handleUpdateLink = (
    index: number,
    field: keyof LinkRecord,
    val: string
  ) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [field]: val };
    setLinks(updated);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  // Main Save Handler
  const handleSaveAll = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      // 1. Upsert Profile
      const { data: updatedProfile, error: profileErr } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: userId,
            email: userEmail,
            first_name: firstName.trim() || null,
            last_name: lastName.trim() || null,
            phone: phone.trim() || null,
            location: location.trim() || null,
            summary: summary.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select("id")
        .single();

      if (profileErr) throw profileErr;
      const profileId = updatedProfile.id;

      // 2. Sync Skills
      await supabase.from("skills").delete().eq("profile_id", profileId);
      if (skills.length > 0) {
        const skillRows = skills.map((s) => ({
          profile_id: profileId,
          skill_name: s.trim(),
        }));
        await supabase.from("skills").insert(skillRows);
      }

      // 3. Sync Experiences
      await supabase.from("experiences").delete().eq("profile_id", profileId);
      const validExperiences = experiences.filter(
        (exp) => exp.company_name?.trim() || exp.job_title?.trim()
      );
      if (validExperiences.length > 0) {
        const expRows = validExperiences.map((exp) => ({
          profile_id: profileId,
          company_name: exp.company_name?.trim() || null,
          job_title: exp.job_title?.trim() || null,
          duration: exp.duration?.trim() || null,
          responsibilities: exp.responsibilities?.trim() || null,
        }));
        await supabase.from("experiences").insert(expRows);
      }

      // 4. Sync Educations
      await supabase.from("educations").delete().eq("profile_id", profileId);
      const validEducations = educations.filter(
        (edu) => edu.institution?.trim() || edu.degree?.trim()
      );
      if (validEducations.length > 0) {
        const eduRows = validEducations.map((edu) => ({
          profile_id: profileId,
          institution: edu.institution?.trim() || null,
          degree: edu.degree?.trim() || null,
          field_of_study: edu.field_of_study?.trim() || null,
          duration: edu.duration?.trim() || null,
        }));
        await supabase.from("educations").insert(eduRows);
      }

      // 5. Sync Projects
      await supabase.from("projects").delete().eq("profile_id", profileId);
      const validProjects = projects.filter((p) => p.project_name?.trim());
      if (validProjects.length > 0) {
        const projRows = validProjects.map((p) => ({
          profile_id: profileId,
          project_name: p.project_name?.trim() || null,
          description: p.description?.trim() || null,
          link: p.link?.trim() || null,
        }));
        await supabase.from("projects").insert(projRows);
      }

      // 6. Sync Certifications
      await supabase.from("certifications").delete().eq("profile_id", profileId);
      const validCerts = certifications.filter(
        (c) => c.certification_name?.trim()
      );
      if (validCerts.length > 0) {
        const certRows = validCerts.map((c) => ({
          profile_id: profileId,
          certification_name: c.certification_name?.trim() || null,
          issuer: c.issuer?.trim() || null,
        }));
        await supabase.from("certifications").insert(certRows);
      }

      // 7. Sync Links
      await supabase.from("links").delete().eq("profile_id", profileId);
      const validLinks = links.filter((l) => l.url?.trim());
      if (validLinks.length > 0) {
        const linkRows = validLinks.map((l) => ({
          profile_id: profileId,
          url_type: l.url_type || "Website",
          url: l.url?.trim() || null,
        }));
        await supabase.from("links").insert(linkRows);
      }

      setStatusMessage({
        type: "success",
        text: "Profile changes saved successfully and synced with cloud database!",
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to save profile changes.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  };

  const initials =
    ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase() ||
    (userEmail?.[0] || "U").toUpperCase();

  // Tab definitions with category icons and dynamic item counts
  const tabs = [
    {
      id: "overview" as TabType,
      label: "Basic Info & Bio",
      shortLabel: "Bio",
      icon: User,
      count: null,
    },
    {
      id: "experience" as TabType,
      label: "Work Experience",
      shortLabel: "Experience",
      icon: Briefcase,
      count: experiences.length,
    },
    {
      id: "education" as TabType,
      label: "Education",
      shortLabel: "Education",
      icon: GraduationCap,
      count: educations.length,
    },
    {
      id: "skills" as TabType,
      label: "Skills & Tech",
      shortLabel: "Skills",
      icon: Sparkles,
      count: skills.length,
    },
    {
      id: "projects" as TabType,
      label: "Projects",
      shortLabel: "Projects",
      icon: FolderGit2,
      count: projects.length,
    },
    {
      id: "certifications" as TabType,
      label: "Certifications",
      shortLabel: "Certs",
      icon: Award,
      count: certifications.length,
    },
    {
      id: "links" as TabType,
      label: "Links & Social",
      shortLabel: "Links",
      icon: LinkIcon,
      count: links.length,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Hero Card */}
      <div className="bg-[#121214]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
          {/* User Avatar and Identity */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-white/20 via-white/10 to-white/5 border border-white/20 flex items-center justify-center text-2xl font-bold text-white shadow-xl shrink-0">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {firstName || lastName
                    ? `${firstName} ${lastName}`.trim()
                    : "Your Profile"}
                </h1>
                <span className="text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Auto-Synced
                </span>
              </div>
              <p className="text-xs text-white/50 mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-white/40" />
                <span>{userEmail}</span>
                {location && (
                  <>
                    <span className="text-white/20">•</span>
                    <MapPin className="w-3.5 h-3.5 text-white/40" />
                    <span>{location}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick Header Metric & Action */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Header Circular Indicator Pill */}
            <div className="hidden sm:flex items-center gap-3 bg-white/[0.04] border border-white/10 px-3.5 py-2 rounded-2xl">
              <CircularProgress
                value={completeness.percentage}
                size={34}
                strokeWidth={4}
                color={completeness.strokeColor}
                showValue={false}
              >
                <span className="text-[10px] font-mono font-bold text-white">
                  {completeness.percentage}%
                </span>
              </CircularProgress>
              <div className="text-left">
                <div className="text-[10px] uppercase font-mono tracking-wider text-white/40">
                  Profile Status
                </div>
                <div className="text-xs font-semibold text-white">
                  {completeness.level}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={() => handleSaveAll()}
              disabled={saving}
              className="h-10 px-5 bg-white hover:bg-white/90 text-black font-semibold text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-white/10 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Toast Notification */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-4 p-3.5 rounded-xl flex items-center gap-3 text-xs ${
                statusMessage.type === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. Top Reusable Stat Cards Grid */}
        <div className="pt-6">
          <ProfileStats
            data={profileData}
            onSelectTab={(tab) => setActiveTab(tab)}
            onNavigateResume={() => router.push("/dashboard/resume")}
          />
        </div>
      </div>

      {/* 3. Tab-Based Profile Content Container */}
      <div className="bg-[#121214]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl space-y-6 shadow-xl">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 border-b border-white/10 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? "text-black font-semibold shadow-sm"
                    : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="profileTabActiveIndicator"
                    className="absolute inset-0 bg-white rounded-xl shadow-md"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? "bg-black/10 text-black font-bold"
                          : "bg-white/10 text-white/70"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        <AnimatePresence mode="wait">
          {/* TAB 1: OVERVIEW & BIO */}
          {activeTab === "overview" && (
            <motion.div
              key="tab-overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-400" />
                  <span>Personal Information</span>
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Primary contact details and high-level career summary.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3 text-white/40" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Alex"
                      className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3 text-white/40" />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Mercer"
                      className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-white/40" />
                    <input
                      type="email"
                      value={userEmail}
                      disabled
                      className="w-full h-10 pl-10 pr-3.5 bg-white/[0.02] border border-white/5 rounded-xl text-xs text-white/60 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3.5 top-3 text-white/40" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Location (City, Country)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3.5 top-3 text-white/40" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="San Francisco, CA"
                    className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-white/70">
                    Professional Summary & Bio
                  </label>
                  <span className="text-[11px] font-mono text-white/40">
                    {summary.length} characters
                  </span>
                </div>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute top-3.5 left-3.5 text-white/40" />
                  <textarea
                    rows={4}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="High-level overview of your background, core technical focus, and standout career achievements..."
                    className="w-full pl-10 pr-3.5 py-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors resize-y leading-relaxed"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: WORK EXPERIENCE */}
          {activeTab === "experience" && (
            <motion.div
              key="tab-experience"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-amber-400" />
                    <span>Work Experience</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Employment positions, responsibilities, and key impact.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Position</span>
                </button>
              </div>

              {experiences.length === 0 ? (
                <div className="p-10 border border-dashed border-white/15 rounded-2xl text-center space-y-3">
                  <Briefcase className="w-8 h-8 text-white/20 mx-auto" />
                  <div className="text-xs text-white/40">
                    No work experience records found.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddExperience}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Position</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {experiences.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                          <Briefcase className="w-4 h-4 text-amber-400" />
                          <span>Position #{idx + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveExperience(idx)}
                          className="text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete position"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Job Title
                          </label>
                          <input
                            type="text"
                            value={exp.job_title || ""}
                            onChange={(e) =>
                              handleUpdateExperience(
                                idx,
                                "job_title",
                                e.target.value
                              )
                            }
                            placeholder="Senior Software Engineer"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={exp.company_name || ""}
                            onChange={(e) =>
                              handleUpdateExperience(
                                idx,
                                "company_name",
                                e.target.value
                              )
                            }
                            placeholder="Acme Corp"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Duration
                          </label>
                          <input
                            type="text"
                            value={exp.duration || ""}
                            onChange={(e) =>
                              handleUpdateExperience(
                                idx,
                                "duration",
                                e.target.value
                              )
                            }
                            placeholder="Jan 2022 - Present"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-white/50 mb-1">
                          Responsibilities & Achievements
                        </label>
                        <textarea
                          rows={3}
                          value={exp.responsibilities || ""}
                          onChange={(e) =>
                            handleUpdateExperience(
                              idx,
                              "responsibilities",
                              e.target.value
                            )
                          }
                          placeholder="Bullet points and achievements..."
                          className="w-full p-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none resize-y leading-relaxed"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: EDUCATION */}
          {activeTab === "education" && (
            <motion.div
              key="tab-education"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-400" />
                    <span>Education</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Degrees, universities, fields of study, and honors.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddEducation}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Education</span>
                </button>
              </div>

              {educations.length === 0 ? (
                <div className="p-10 border border-dashed border-white/15 rounded-2xl text-center space-y-3">
                  <GraduationCap className="w-8 h-8 text-white/20 mx-auto" />
                  <div className="text-xs text-white/40">
                    No education records added.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEducation}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Degree</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {educations.map((edu, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 relative"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                          <GraduationCap className="w-4 h-4 text-emerald-400" />
                          <span>Education #{idx + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEducation(idx)}
                          className="text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Institution
                          </label>
                          <input
                            type="text"
                            value={edu.institution || ""}
                            onChange={(e) =>
                              handleUpdateEducation(
                                idx,
                                "institution",
                                e.target.value
                              )
                            }
                            placeholder="University / College"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Degree
                          </label>
                          <input
                            type="text"
                            value={edu.degree || ""}
                            onChange={(e) =>
                              handleUpdateEducation(
                                idx,
                                "degree",
                                e.target.value
                              )
                            }
                            placeholder="Bachelor of Science"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Field of Study
                          </label>
                          <input
                            type="text"
                            value={edu.field_of_study || ""}
                            onChange={(e) =>
                              handleUpdateEducation(
                                idx,
                                "field_of_study",
                                e.target.value
                              )
                            }
                            placeholder="Computer Science"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Duration / Graduation Year
                          </label>
                          <input
                            type="text"
                            value={edu.duration || ""}
                            onChange={(e) =>
                              handleUpdateEducation(
                                idx,
                                "duration",
                                e.target.value
                              )
                            }
                            placeholder="2018 - 2022"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 4: SKILLS & TECH */}
          {activeTab === "skills" && (
            <motion.div
              key="tab-skills"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Skills & Technical Stack</span>
                </h2>
                <p className="text-xs text-white/50 mt-0.5">
                  Extracted skills, programming languages, and technologies.
                </p>
              </div>

              {/* Input tag box */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={handleAddSkill}
                  placeholder="Type a skill (e.g. React, Next.js, Python) and press Enter..."
                  className="flex-1 h-10 px-4 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-xs text-white placeholder:text-white/30 focus:outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleAddSkill()}
                  className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Skill</span>
                </button>
              </div>

              {/* Suggested Skills */}
              <div className="space-y-2">
                <span className="text-[11px] text-white/40">Suggested skills:</span>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_SKILL_SUGGESTIONS.filter((s) => !skills.includes(s))
                    .slice(0, 8)
                    .map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleAddSuggestedSkill(s)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white border border-white/10 transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-white/40" />
                        <span>{s}</span>
                      </button>
                    ))}
                </div>
              </div>

              {/* Badges List */}
              <div className="flex flex-wrap gap-2 p-5 rounded-2xl bg-white/[0.02] border border-white/10 min-h-[140px]">
                {skills.length === 0 ? (
                  <p className="text-xs text-white/30 italic m-auto">
                    No skills added yet. Type a skill or choose from suggestions above.
                  </p>
                ) : (
                  skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/15 text-xs text-white hover:border-white/30 transition-colors group"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-white/40 hover:text-red-400 p-0.5 cursor-pointer transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 5: PROJECTS */}
          {activeTab === "projects" && (
            <motion.div
              key="tab-projects"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-cyan-400" />
                    <span>Projects & Portfolio</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Open source libraries, applications, and featured work.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddProject}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>
              </div>

              {projects.length === 0 ? (
                <div className="p-10 border border-dashed border-white/15 rounded-2xl text-center space-y-3">
                  <FolderGit2 className="w-8 h-8 text-white/20 mx-auto" />
                  <div className="text-xs text-white/40">
                    No projects listed yet.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProject}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Project</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((proj, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3 relative"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
                          <FolderGit2 className="w-4 h-4 text-cyan-400" />
                          <span>Project #{idx + 1}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProject(idx)}
                          className="text-white/30 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Project Name
                          </label>
                          <input
                            type="text"
                            value={proj.project_name || ""}
                            onChange={(e) =>
                              handleUpdateProject(
                                idx,
                                "project_name",
                                e.target.value
                              )
                            }
                            placeholder="Open Source Analytics App"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-white/50 mb-1">
                            Project Link / Repo URL
                          </label>
                          <input
                            type="url"
                            value={proj.link || ""}
                            onChange={(e) =>
                              handleUpdateProject(idx, "link", e.target.value)
                            }
                            placeholder="https://github.com/username/project"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] text-white/50 mb-1">
                          Description & Tech Stack
                        </label>
                        <textarea
                          rows={2}
                          value={proj.description || ""}
                          onChange={(e) =>
                            handleUpdateProject(
                              idx,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Overview of the system architecture and features..."
                          className="w-full p-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none resize-y"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 6: CERTIFICATIONS */}
          {activeTab === "certifications" && (
            <motion.div
              key="tab-certifications"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-purple-400" />
                    <span>Certifications & Licenses</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    Cloud credentials, certifications, and industry awards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddCertification}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Cert</span>
                </button>
              </div>

              {certifications.length === 0 ? (
                <div className="p-10 border border-dashed border-white/15 rounded-2xl text-center space-y-3">
                  <Award className="w-8 h-8 text-white/20 mx-auto" />
                  <div className="text-xs text-white/40">
                    No certifications added.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCertification}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Certification</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {certifications.map((cert, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center relative"
                    >
                      <div>
                        <label className="block text-[10px] text-white/40 mb-1">
                          Certification Name
                        </label>
                        <input
                          type="text"
                          value={cert.certification_name || ""}
                          onChange={(e) =>
                            handleUpdateCertification(
                              idx,
                              "certification_name",
                              e.target.value
                            )
                          }
                          placeholder="AWS Certified Solutions Architect"
                          className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] text-white/40 mb-1">
                            Issuer / Authority
                          </label>
                          <input
                            type="text"
                            value={cert.issuer || ""}
                            onChange={(e) =>
                              handleUpdateCertification(
                                idx,
                                "issuer",
                                e.target.value
                              )
                            }
                            placeholder="Amazon Web Services"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCertification(idx)}
                          className="text-white/30 hover:text-red-400 p-2 mt-3.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 7: LINKS & SOCIAL */}
          {activeTab === "links" && (
            <motion.div
              key="tab-links"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-sky-400" />
                    <span>Portfolio & Social Links</span>
                  </h2>
                  <p className="text-xs text-white/50 mt-0.5">
                    LinkedIn, GitHub, Personal Website, and portfolio profiles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Link</span>
                </button>
              </div>

              {links.length === 0 ? (
                <div className="p-10 border border-dashed border-white/15 rounded-2xl text-center space-y-3">
                  <LinkIcon className="w-8 h-8 text-white/20 mx-auto" />
                  <div className="text-xs text-white/40">
                    No web or social links added.
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-xs rounded-xl border border-white/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Link</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {links.map((link, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white/[0.03] border border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center"
                    >
                      <div>
                        <label className="block text-[10px] text-white/40 mb-1">
                          Platform / Type
                        </label>
                        <select
                          value={link.url_type || "LinkedIn"}
                          onChange={(e) =>
                            handleUpdateLink(idx, "url_type", e.target.value)
                          }
                          className="w-full h-9 px-2.5 bg-[#181818] border border-white/10 rounded-lg text-xs text-white focus:outline-none"
                        >
                          <option value="LinkedIn">LinkedIn</option>
                          <option value="GitHub">GitHub</option>
                          <option value="Portfolio">Portfolio</option>
                          <option value="Twitter">Twitter / X</option>
                          <option value="Website">Website</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] text-white/40 mb-1">
                            URL
                          </label>
                          <input
                            type="url"
                            value={link.url || ""}
                            onChange={(e) =>
                              handleUpdateLink(idx, "url", e.target.value)
                            }
                            placeholder="https://linkedin.com/in/username"
                            className="w-full h-9 px-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-lg text-xs text-white focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="text-white/30 hover:text-red-400 p-2 mt-3.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Save Bar */}
        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[11px] text-white/40 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-white/60" />
            <span>Profile updates sync directly across all automated job applications</span>
          </div>

          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={saving}
            className="w-full sm:w-auto h-10 px-6 bg-white hover:bg-white/90 text-black font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
