"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, CheckCircle2, UserCircle, Save, Info, Sparkles } from "lucide-react";
import { MissingFieldInfo } from "@/lib/applications/types";

interface MissingProfileFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  missingFields: MissingFieldInfo[];
  onSuccess?: (savedValues?: Record<string, string>) => void;
}

type SaveState = "idle" | "saving" | "success" | "error";

interface FieldGuidance {
  label: string;
  description: string;
  placeholder: string;
  tip?: string;
}

const FIELD_GUIDANCE_MAP: Record<string, FieldGuidance> = {
  full_name: {
    label: "Full Legal Name",
    description: "Enter your full legal name as it appears on your passport or official identification.",
    placeholder: "e.g. Jane Doe",
  },
  first_name: {
    label: "First Name",
    description: "Your official given name.",
    placeholder: "e.g. Jane",
  },
  last_name: {
    label: "Last Name",
    description: "Your official family name or surname.",
    placeholder: "e.g. Doe",
  },
  email: {
    label: "Email Address",
    description: "The primary email address where employers can reach you for interviews.",
    placeholder: "e.g. jane.doe@example.com",
    tip: "Double-check for typos so you receive all application responses.",
  },
  phone: {
    label: "Phone Number",
    description: "Your contact phone or mobile number, including your country code.",
    placeholder: "e.g. +1 (555) 234-5678",
    tip: "Include your international calling code (e.g. +1 for US/Canada, +44 for UK, +91 for India).",
  },
  location: {
    label: "Current Location",
    description: "The city and country or state where you are currently based.",
    placeholder: "e.g. San Francisco, CA or London, UK",
  },
  city: {
    label: "City",
    description: "The city where you currently reside.",
    placeholder: "e.g. San Francisco",
  },
  state: {
    label: "State / Province",
    description: "The state, region, or province where you live.",
    placeholder: "e.g. California",
  },
  country: {
    label: "Country",
    description: "The country you currently live in.",
    placeholder: "e.g. United States",
  },
  work_authorization: {
    label: "Work Authorization",
    description: "Are you legally authorized to work in this job's country, and do you require visa sponsorship?",
    placeholder: "e.g. Authorized to work without visa sponsorship",
  },
  years_experience: {
    label: "Years of Professional Experience",
    description: "How many total years of relevant work experience do you have in this field?",
    placeholder: "e.g. 4",
    tip: "Enter a number of years (e.g. 3, 5).",
  },
  linkedin_url: {
    label: "LinkedIn Profile URL",
    description: "The web address to your public LinkedIn profile.",
    placeholder: "e.g. https://www.linkedin.com/in/janedoe",
  },
  github_url: {
    label: "GitHub Profile URL",
    description: "The web address to your public code repositories or projects on GitHub.",
    placeholder: "e.g. https://github.com/janedoe",
  },
  portfolio_url: {
    label: "Portfolio / Website URL",
    description: "Link showcasing your work, projects, case studies, or personal website.",
    placeholder: "e.g. https://janedoe.dev",
  },
  website_url: {
    label: "Personal Website",
    description: "Link to your personal website or online portfolio.",
    placeholder: "e.g. https://mywebsite.com",
  },
  summary: {
    label: "Professional Summary",
    description: "A brief 2-3 sentence overview highlighting your background, skills, and goals.",
    placeholder: "e.g. Full-stack software engineer with 4 years of experience building scalable web applications...",
  },
};

function humanizeLabel(rawKey: string, fallbackLabel?: string): string {
  if (fallbackLabel && fallbackLabel.trim() && !fallbackLabel.includes("_")) {
    return fallbackLabel.trim().replace(/[*:]+$/, "");
  }
  const clean = (rawKey || fallbackLabel || "field")
    .replace(/[_-]/g, " ")
    .replace(/[*:]+$/, "")
    .trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function MissingProfileFieldsDialog({
  open,
  onOpenChange,
  applicationId,
  jobTitle,
  companyName,
  missingFields,
  onSuccess,
}: MissingProfileFieldsDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleChange = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  const isOptional = (f: MissingFieldInfo) =>
    f.type?.startsWith("optional") || f.label?.toLowerCase().includes("(optional)");

  const requiredFields = missingFields.filter(f => !isOptional(f));
  const allRequiredFilled = requiredFields.every(f => values[f.field_key]?.trim());

  const getFieldDetails = (field: MissingFieldInfo): FieldGuidance => {
    const key = field.field_key?.toLowerCase() || "";
    if (FIELD_GUIDANCE_MAP[key]) {
      return FIELD_GUIDANCE_MAP[key];
    }
    if (key.includes("phone") || key.includes("tel")) return FIELD_GUIDANCE_MAP.phone;
    if (key.includes("email")) return FIELD_GUIDANCE_MAP.email;
    if (key.includes("linkedin")) return FIELD_GUIDANCE_MAP.linkedin_url;
    if (key.includes("github")) return FIELD_GUIDANCE_MAP.github_url;
    if (key.includes("portfolio")) return FIELD_GUIDANCE_MAP.portfolio_url;
    if (key.includes("experience")) return FIELD_GUIDANCE_MAP.years_experience;
    if (key.includes("sponsor") || key.includes("authoriz")) return FIELD_GUIDANCE_MAP.work_authorization;
    if (key.includes("location") || key.includes("city")) return FIELD_GUIDANCE_MAP.location;

    return {
      label: humanizeLabel(field.field_key, field.label),
      description: "This question was specifically requested by the employer for this job application.",
      placeholder: `Enter ${field.label ? field.label.toLowerCase() : "your response"}...`,
    };
  };

  const handleSave = async () => {
    setSaveState("saving");
    setError(null);

    // Validate email if present
    for (const f of requiredFields) {
      const val = values[f.field_key]?.trim();
      if (!val) {
        setError(`Please provide "${getFieldDetails(f).label}" to continue.`);
        setSaveState("error");
        return;
      }
      if (f.type === "email" || f.field_key === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          setError(`Please enter a valid email address for "${getFieldDetails(f).label}".`);
          setSaveState("error");
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/applications/${applicationId}/missing-fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save information");
      }

      setSaveState("success");
      onSuccess?.(values);
      setTimeout(() => {
        onOpenChange(false);
        setSaveState("idle");
        setValues({});
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "An error occurred while saving. Please try again.");
      setSaveState("error");
    }
  };

  const renderFieldInput = (field: MissingFieldInfo, details: FieldGuidance) => {
    const value = values[field.field_key] || "";
    const baseClass =
      "w-full rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500 focus:bg-white/[0.08] focus:ring-1 focus:ring-violet-500/50 transition-all";

    if (field.type === "select" && field.options?.length) {
      return (
        <select
          value={value}
          onChange={e => handleChange(field.field_key, e.target.value)}
          className={`${baseClass} [&>option]:bg-[#0f1117] [&>option]:text-white`}
        >
          <option value="">Select an option...</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (field.type === "radio" && field.options?.length) {
      return (
        <div className="flex flex-wrap gap-2 pt-1">
          {field.options.map(opt => {
            const isSelected = value === opt;
            return (
              <label
                key={opt}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm cursor-pointer transition-all ${
                  isSelected
                    ? "border-violet-500 bg-violet-500/20 text-white font-medium shadow-sm"
                    : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <input
                  type="radio"
                  name={field.field_key}
                  value={opt}
                  checked={isSelected}
                  onChange={() => handleChange(field.field_key, opt)}
                  className="hidden"
                />
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? "border-violet-400 bg-violet-500" : "border-white/30"}`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      );
    }

    if (field.type === "textarea" || (field.label && field.label.length > 50)) {
      return (
        <textarea
          value={value}
          onChange={e => handleChange(field.field_key, e.target.value)}
          placeholder={details.placeholder}
          rows={3}
          className={`${baseClass} resize-none`}
        />
      );
    }

    const inputTypeMap: Record<string, string> = {
      email: "email",
      tel: "tel",
      number: "number",
      date: "date",
      url: "url",
    };

    return (
      <input
        type={inputTypeMap[field.type] || "text"}
        value={value}
        onChange={e => handleChange(field.field_key, e.target.value)}
        placeholder={details.placeholder}
        className={baseClass}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={open => {
      if (saveState !== "saving") onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-xl bg-[#0f1117] border border-white/15 shadow-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">Complete Application Details</DialogTitle>
              <p className="text-xs text-white/50">
                Applying to <span className="text-white font-medium">{jobTitle}</span> at{" "}
                <span className="text-white font-medium">{companyName}</span>
              </p>
            </div>
          </div>
        </DialogHeader>

        {saveState === "success" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-semibold text-base">Information Saved Successfully!</p>
            <p className="text-white/60 text-sm max-w-sm">
              Your profile has been updated. These details will be used directly to complete your application.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 mt-3">
            {/* Beginner-friendly explanation banner */}
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3.5 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-semibold text-indigo-300">Saved for all future applications</p>
                <p className="text-indigo-200/70 leading-relaxed">
                  Enter the required details below. We save this directly to your profile and application form, so the AI agent can fill it automatically without asking you again.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* List of missing fields with beginner-friendly instructions */}
            <div className="space-y-4">
              {missingFields.map(field => {
                const details = getFieldDetails(field);
                const required = !isOptional(field);

                return (
                  <div
                    key={field.field_key}
                    className="flex flex-col gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] p-3.5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-sm font-semibold text-white/90 flex items-center gap-1.5">
                        {details.label}
                        {required ? (
                          <span className="text-red-400 text-xs font-bold" title="Required field">*</span>
                        ) : (
                          <span className="text-white/40 text-[11px] font-normal">(optional)</span>
                        )}
                      </label>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        required
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/25"
                          : "bg-white/5 text-white/40 border-white/10"
                      }`}>
                        {required ? "Required" : "Optional"}
                      </span>
                    </div>

                    {/* Detailed helper text for non-technical candidates */}
                    <p className="text-xs text-white/50 leading-relaxed">
                      {details.description}
                    </p>

                    <div className="pt-1">
                      {renderFieldInput(field, details)}
                    </div>

                    {details.tip && (
                      <p className="text-[11px] text-white/40 flex items-center gap-1 pt-0.5">
                        <Info className="w-3 h-3 text-white/30 shrink-0" />
                        <span>{details.tip}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveState === "saving"}
                className="flex-1 rounded-xl border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07] hover:text-white h-10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!allRequiredFilled || saveState === "saving"}
                className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold h-10 shadow-lg shadow-violet-600/25 disabled:opacity-40"
              >
                {saveState === "saving" ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving Details...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />Save & Continue</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
