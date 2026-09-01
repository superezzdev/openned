"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Sparkles,
  Loader2,
  Briefcase,
  GraduationCap,
  Wrench,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Check,
} from "lucide-react";
import { ParsedResumeData } from "@/lib/resume-parser";
import { StrictResumeExtraction } from "@/lib/resume/types";

interface OnboardingDialogProps {
  userEmail: string;
  userName?: string;
}

const steps = [
  { id: 1, label: "Uploading file to Supabase Storage..." },
  { id: 2, label: "Extracting resume text & sections..." },
  { id: 3, label: "AI analyzing skills, experience & education..." },
  { id: 4, label: "Populating your profile in database..." },
];

export function OnboardingDialog({
  userEmail,
  userName = "there",
}: OnboardingDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedResumeData | null>(null);
  const [strictResult, setStrictResult] = useState<StrictResumeExtraction | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    warnings: string[];
    rejectedFields: Array<{ field: string; value: any; reason: string }>;
  } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndProcess(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndProcess(file);
    }
  };

  const validateAndProcess = (file: File) => {
    const validExtensions = [".pdf", ".docx", ".doc", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setError("Please upload a valid PDF, DOCX, or TXT resume file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    setError(null);
    setSelectedFile(file);
    startUploadAndParse(file);
  };

  const startUploadAndParse = async (file: File) => {
    setIsProcessing(true);
    setActiveStep(1);
    setError(null);

    // Step simulation timers for visual progress feedback
    const step2Timer = setTimeout(() => setActiveStep(2), 1200);
    const step3Timer = setTimeout(() => setActiveStep(3), 2600);
    const step4Timer = setTimeout(() => setActiveStep(4), 4200);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      clearTimeout(step2Timer);
      clearTimeout(step3Timer);
      clearTimeout(step4Timer);

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to process resume");
      }

      setActiveStep(4);
      setParsedResult(data.data);
      setStrictResult(data.strict || null);
      setValidationResult(data.validation || null);
      setIsCompleted(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(message);
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    router.push("/dashboard/profile");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none overflow-y-auto">
      {/* Background glow accents */}
      <div className="absolute w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none -top-20 -left-20" />
      <div className="absolute w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none -bottom-20 -right-20" />

      {/* Main Modal Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-xl bg-[#0e0e0e] border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/80 overflow-hidden text-white my-8"
      >
        {/* Subtle top light beam */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {!isCompleted ? (
          <div>
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-mono text-white/80 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>One-Time Onboarding</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Upload your resume to get started
              </h2>
              <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto leading-relaxed">
                Welcome, {userName}! Openned extracts your work history, skills,
                and credentials to power your AI applications and personalized profile.
              </p>
            </div>

            {/* Error Notification */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span className="flex-1">{error}</span>
                  <button
                    onClick={() => {
                      setError(null);
                      setSelectedFile(null);
                      setIsProcessing(false);
                    }}
                    className="underline text-[11px] hover:text-white cursor-pointer"
                  >
                    Try again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Processing / Upload Stepper View */}
            {isProcessing ? (
              <div className="mt-8 space-y-6">
                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {selectedFile?.name}
                      </p>
                      <p className="text-[11px] text-white/40">
                        {selectedFile
                          ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                          : "Uploading..."}
                      </p>
                    </div>
                    <Loader2 className="w-5 h-5 text-white/60 animate-spin shrink-0" />
                  </div>

                  {/* Stepper items */}
                  <div className="space-y-3 pt-3 border-t border-white/5">
                    {steps.map((step) => {
                      const isDone = activeStep > step.id;
                      const isCurrent = activeStep === step.id;

                      return (
                        <div
                          key={step.id}
                          className="flex items-center gap-3 text-xs"
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : isCurrent ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-white/20 shrink-0" />
                          )}
                          <span
                            className={
                              isDone
                                ? "text-white/40 line-through"
                                : isCurrent
                                ? "text-white font-medium"
                                : "text-white/30"
                            }
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-[11px] text-white/40">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Securely stored in Supabase with private access</span>
                </div>
              </div>
            ) : (
              /* Dropzone view */
              <div className="mt-8 space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc,.txt"
                  className="hidden"
                />

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? "border-white bg-white/[0.08] scale-[1.01]"
                      : "border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-4 text-white group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-7 h-7 text-white/80" />
                  </div>

                  <p className="text-sm font-semibold text-white">
                    Click to browse or drag and drop your resume
                  </p>
                  <p className="text-xs text-white/40 mt-1">
                    Supports PDF, DOCX, DOC, TXT (up to 10MB)
                  </p>

                  <button
                    type="button"
                    className="mt-5 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors shadow-md inline-flex items-center gap-2"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-white/40 px-1 pt-2">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    AI Auto-Extraction
                  </span>
                  <span>Required to initialize dashboard</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Success & Review Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5 text-left py-1"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-white">
                  Resume parsed successfully!
                </h3>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Evidence-Based • Zero Hallucination Verified</span>
                </div>
              </div>
            </div>

            {/* Candidate Identity & Contact Review Card */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-white/70 border-b border-white/5 pb-2">
                <span>Extracted Candidate Identity</span>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                  <Check className="w-3 h-3" /> Grounded In Resume
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-white/40 block text-[11px]">Full Name</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-white">
                      {[parsedResult?.profile.first_name, parsedResult?.profile.last_name].filter(Boolean).join(" ") || "Not found"}
                    </span>
                    {parsedResult?.profile.first_name && (
                      <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-white/40 block text-[11px]">Email</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-semibold text-white truncate max-w-[200px]">
                      {parsedResult?.profile.email || "Not found"}
                    </span>
                    {parsedResult?.profile.email && (
                      <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-white/40 block text-[11px]">Phone Number</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {parsedResult?.profile.phone ? (
                      <>
                        <span className="font-semibold text-white">
                          {parsedResult.profile.phone}
                        </span>
                        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                          Verified
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Please verify in profile
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-white/40 block text-[11px]">Home Location</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {parsedResult?.profile.location ? (
                      <>
                        <span className="font-semibold text-white">
                          {parsedResult.profile.location}
                        </span>
                        <span className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                          Verified
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 font-mono bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" /> Not in resume (Please verify)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Extracted stats pills */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                  <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Skills</span>
                </div>
                <p className="text-base font-bold text-white font-mono">
                  {parsedResult?.skills.length || 0}
                </p>
                <span className="text-[10px] text-emerald-400/80 font-mono block">
                  All Grounded
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                  <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                  <span>Experience</span>
                </div>
                <p className="text-base font-bold text-white font-mono">
                  {parsedResult?.experiences.length || 0}
                </p>
                <span className="text-[10px] text-emerald-400/80 font-mono block truncate">
                  {parsedResult?.experiences[0]?.company_name || "None"}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-white/40 text-[11px]">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Education</span>
                </div>
                <p className="text-base font-bold text-white font-mono">
                  {parsedResult?.educations.length || 0}
                </p>
                <span className="text-[10px] text-emerald-400/80 font-mono block truncate">
                  {parsedResult?.educations[0]?.degree || "None"}
                </span>
              </div>
            </div>

            {/* Verified Skills Preview */}
            {(parsedResult?.skills.length || 0) > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-white/40 font-medium">Verified Skills Preview</span>
                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                  {parsedResult?.skills.slice(0, 10).map((skill, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-white/80 font-mono"
                    >
                      {skill}
                    </span>
                  ))}
                  {(parsedResult?.skills.length || 0) > 10 && (
                    <span className="px-2 py-0.5 rounded-lg bg-white/[0.04] text-[10px] text-white/40 font-mono">
                      +{(parsedResult?.skills.length || 0) - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action button */}
            <div className="pt-2">
              <button
                onClick={handleFinish}
                className="w-full h-11 bg-white hover:bg-white/90 text-black font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10 cursor-pointer"
              >
                <span>Confirm & View Profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
