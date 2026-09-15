"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, User, ExternalLink, Loader2, Zap, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { ApplicationStatus } from "@/lib/applications/types";
import { formatJobPostingTime } from "@/lib/posting-time";

interface ApplyMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  companyName: string;
  applyUrl: string;
  postedAt?: string | null;
  onApplicationCreated?: (applicationId: string, status: ApplicationStatus) => void;
}

type State = "idle" | "loading_manual" | "loading_auto" | "success" | "error";

export function ApplyMethodDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  companyName,
  applyUrl,
  postedAt,
  onApplicationCreated,
}: ApplyMethodDialogProps) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const postingTime = postedAt ? formatJobPostingTime(postedAt) : null;
  const isLoading = state === "loading_manual" || state === "loading_auto";

  const handleManual = async () => {
    setState("loading_manual");
    setError(null);
    try {
      // Create application record
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          apply_url: applyUrl,
          source: "manual",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create application record");
      }

      const { application } = await res.json();

      // Open URL in new tab
      window.open(applyUrl, "_blank", "noopener,noreferrer");

      onApplicationCreated?.(application.id, ApplicationStatus.MANUAL_APPLY_STARTED);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("applications-updated"));
      }
      onOpenChange(false);
      setState("idle");
    } catch (err: any) {
      setError(err?.message || "An error occurred. Please try opening the link manually.");
      setState("error");
      // Fallback: open URL anyway
      window.open(applyUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleAutomatic = async () => {
    setState("loading_auto");
    setError(null);
    try {
      // 1. Create application record
      const createRes = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          apply_url: applyUrl,
          source: "ai_agent",
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "Failed to queue application");
      }

      const { application, already_exists } = await createRes.json();
      setApplicationId(application.id);

      if (!already_exists) {
        // 2. Start automation
        const startRes = await fetch(`/api/applications/${application.id}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!startRes.ok) {
          const data = await startRes.json();
          throw new Error(data.error || "Failed to start automation");
        }
      }

      setState("success");
      onApplicationCreated?.(application.id, ApplicationStatus.QUEUED);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("applications-updated"));
      }

      // Auto-close after showing success
      setTimeout(() => {
        onOpenChange(false);
        setState("idle");
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to start AI automation. Please try manually.");
      setState("error");
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      setTimeout(() => { setState("idle"); setError(null); }, 200);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-[#0f1117] border border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-bold">Apply to this Job</DialogTitle>
          <DialogDescription className="text-white/50 text-sm mt-1 space-y-1">
            <div>
              <span className="font-semibold text-white/70">{jobTitle}</span>
              {" "}at{" "}
              <span className="font-semibold text-white/70">{companyName}</span>
            </div>
            {postingTime && (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-sky-300 pt-1"
                title={postingTime.tooltip}
                suppressHydrationWarning
              >
                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-white/60">Posted {postingTime.displayPrefix || postingTime.relativeText}</span>
                {postingTime.timeOnlyText ? (
                  <>
                    <span className="text-white/30">•</span>
                    <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded border border-white/10 text-[11px] tracking-tight">
                      {postingTime.timeOnlyText}
                    </span>
                  </>
                ) : postingTime.dateOnlyText && postingTime.dateOnlyText !== "Recently" ? (
                  <>
                    <span className="text-white/30">•</span>
                    <span className="font-mono text-white/80 text-[11px]">
                      {postingTime.dateOnlyText}
                    </span>
                  </>
                ) : null}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {state === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white font-semibold">Application Queued!</p>
            <p className="text-white/50 text-sm">
              Your AI agent is working on it. You can track progress in your dashboard.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Option 1: Manual */}
            <button
              onClick={handleManual}
              disabled={isLoading}
              className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-blue-500/40 hover:bg-blue-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 border border-blue-500/25 group-hover:bg-blue-500/25 transition-colors">
                {state === "loading_manual" ? (
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                ) : (
                  <User className="w-5 h-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">Apply Manually</p>
                  <ExternalLink className="w-3 h-3 text-white/30" />
                </div>
                <p className="text-white/45 text-xs mt-0.5 leading-snug">
                  Opens the application page in a new tab. You'll fill it out yourself.
                </p>
              </div>
            </button>

            {/* Option 2: AI Auto */}
            <button
              onClick={handleAutomatic}
              disabled={isLoading}
              className="group relative flex items-center gap-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 text-left transition-all hover:border-violet-500/50 hover:bg-violet-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Subtle gradient glow */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.06),transparent_70%)]" />
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/30 group-hover:bg-violet-500/30 transition-colors relative">
                {state === "loading_auto" ? (
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                ) : (
                  <Bot className="w-5 h-5 text-violet-400" />
                )}
              </div>
              <div className="flex-1 min-w-0 relative">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white text-sm">Apply Automatically</p>
                  <span className="rounded-full bg-violet-500/20 border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-bold text-violet-300 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5" />
                    AI
                  </span>
                </div>
                <p className="text-white/45 text-xs mt-0.5 leading-snug">
                  Your AI agent fills and submits the application using your profile. Review before submission.
                </p>
              </div>
            </button>

            <p className="text-center text-white/25 text-[11px] px-2">
              The AI agent will pause and ask for your review before submitting.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
