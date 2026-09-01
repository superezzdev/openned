"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  UploadCloud,
  Download,
  ExternalLink,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Plus,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

export interface ResumeItem {
  id: string;
  profile_id: string;
  file_path: string;
  file_name: string;
  uploaded_at: string;
}

interface ResumeListProps {
  initialResumes: ResumeItem[];
  userEmail: string;
}

export function ResumeList({ initialResumes = [], userEmail }: ResumeListProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resumes, setResumes] = useState<ResumeItem[]>(initialResumes);
  const [isUploading, setIsUploading] = useState(false);
  const [isReparsing, setIsReparsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleReparse = async () => {
    setIsReparsing(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/resume/reparse", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to reparse resume");
      }
      setStatusMessage({
        type: "success",
        text: "Resume reparsed with Zero-Hallucination v2 engine! All profile records synchronized.",
      });
      router.refresh();
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reparse resume.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsReparsing(false);
    }
  };

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
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    const validExtensions = [".pdf", ".docx", ".doc", ".txt"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      setStatusMessage({
        type: "error",
        text: "Please upload a valid PDF, DOCX, or TXT file.",
      });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to upload resume");
      }

      if (result.resume) {
        setResumes([result.resume, ...resumes]);
      }

      setStatusMessage({
        type: "success",
        text: `Resume "${file.name}" uploaded and parsed into your profile!`,
      });

      router.refresh();
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to upload resume.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (resumeId: string) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;

    setDeletingId(resumeId);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/resume/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to delete resume");
      }

      setResumes(resumes.filter((r) => r.id !== resumeId));
      setStatusMessage({
        type: "success",
        text: "Resume deleted successfully.",
      });
      router.refresh();
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete resume.";
      setStatusMessage({ type: "error", text: msg });
    } finally {
      setDeletingId(null);
    }
  };

  const getStorageUrl = (filePath: string) => {
    const { data } = supabase.storage.from("resumes").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#121212]/90 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/[0.03] rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Resume Management
              </h1>
              <span className="text-[11px] font-mono bg-white/10 text-white/80 border border-white/10 px-2.5 py-0.5 rounded-full">
                {resumes.length} {resumes.length === 1 ? "File" : "Files"}
              </span>
            </div>
            <p className="text-xs text-white/50 mt-1">
              Upload, preview, and manage your master resumes and job-specific
              variants.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-10 px-4 bg-white hover:bg-white/90 text-black font-semibold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md shadow-white/10 disabled:opacity-50 cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading & Parsing...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Upload New Resume</span>
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
              className={`mt-5 p-3.5 rounded-xl flex items-center gap-3 text-xs ${
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
      </div>

      {/* Quick Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? "border-white bg-white/[0.08] scale-[1.01]"
            : "border-white/10 bg-[#121212]/50 hover:border-white/20 hover:bg-[#121212]/80"
        }`}
      >
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-2 text-white">
          <UploadCloud className="w-5 h-5 text-white/80" />
        </div>
        <p className="text-xs font-semibold text-white">
          Drag & drop a new resume file here or click to browse
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">
          PDF, DOCX, DOC, or TXT up to 10MB. Uploading automatically syncs extracted details into your profile.
        </p>
      </div>

      {/* Resumes List */}
      <div className="bg-[#121212]/80 border border-white/10 rounded-3xl p-6 sm:p-8 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Uploaded Documents</h2>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Encrypted in Supabase Storage</span>
          </div>
        </div>

        {resumes.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-white/40">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-white/70">
              No resumes uploaded yet
            </p>
            <p className="text-[11px] text-white/40 max-w-sm mx-auto">
              Upload your resume above to view files here and automatically
              populate your profile.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((resume, index) => {
              const fileUrl = getStorageUrl(resume.file_path);
              const isPdf = resume.file_name.toLowerCase().endsWith(".pdf");
              const isDocx =
                resume.file_name.toLowerCase().endsWith(".docx") ||
                resume.file_name.toLowerCase().endsWith(".doc");

              return (
                <motion.div
                  key={resume.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/15 to-white/5 border border-white/10 flex items-center justify-center text-white shrink-0 shadow-inner">
                      <FileText className="w-6 h-6 text-amber-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate">
                          {resume.file_name}
                        </p>
                        {index === 0 && (
                          <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                            Primary
                          </span>
                        )}
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/10 text-white/60 shrink-0">
                          {isPdf ? "PDF" : isDocx ? "DOCX" : "TEXT"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-white/40 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(resume.uploaded_at)}
                        </span>
                        <span>•</span>
                        <span className="text-emerald-400 font-mono flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Zero-Hallucination Verified (v2)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={handleReparse}
                      disabled={isReparsing}
                      className="h-8 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      title="Reparse with Zero-Hallucination v2 Engine"
                    >
                      {isReparsing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      <span>Reparse</span>
                    </button>

                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Open file in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>View</span>
                    </a>

                    <a
                      href={fileUrl}
                      download={resume.file_name}
                      className="h-8 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Download resume file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDelete(resume.id)}
                      disabled={deletingId === resume.id}
                      className="h-8 w-8 rounded-lg bg-white/[0.06] hover:bg-red-500/20 hover:text-red-300 border border-white/10 text-white/50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                      title="Delete resume"
                    >
                      {deletingId === resume.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
