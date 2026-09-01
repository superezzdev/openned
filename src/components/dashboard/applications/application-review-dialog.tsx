"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Eye, Send, AlertCircle, FileText, User, Building } from "lucide-react";
import { ApplicationStatus } from "@/lib/applications/types";

interface ReviewField {
  label: string;
  value?: string | null;
  status: "mapped" | "missing" | "optional";
}

interface ApplicationReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  platform?: string;
  fields: ReviewField[];
  onConfirm?: () => void;
  onStatusChange?: (status: ApplicationStatus) => void;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

export function ApplicationReviewDialog({
  open,
  onOpenChange,
  applicationId,
  jobTitle,
  companyName,
  platform,
  fields,
  onConfirm,
  onStatusChange,
}: ApplicationReviewDialogProps) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setSubmitState("submitting");
    setError(null);

    try {
      const res = await fetch(`/api/applications/${applicationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          // Double-click or already in progress — handle gracefully as success
          setSubmitState("success");
          onConfirm?.();
          onStatusChange?.(data.status || ApplicationStatus.SUBMITTING);
          setTimeout(() => {
            onOpenChange(false);
            setSubmitState("idle");
          }, 1500);
          return;
        }
        throw new Error(data.error || "Failed to confirm review");
      }

      setSubmitState("success");
      onConfirm?.();
      onStatusChange?.(ApplicationStatus.SUBMITTING);

      setTimeout(() => {
        onOpenChange(false);
        setSubmitState("idle");
      }, 2500);
    } catch (err: any) {
      setError(err?.message || "An error occurred. Please try again.");
      setSubmitState("error");
    }
  };

  const mappedFields = fields.filter(f => f.status === "mapped");
  const missingFields = fields.filter(f => f.status === "missing");

  return (
    <Dialog open={open} onOpenChange={open => {
      if (submitState !== "submitting") onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg bg-[#0f1117] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/25 flex items-center justify-center">
              <Eye className="w-4 h-4 text-sky-400" />
            </div>
            <DialogTitle className="text-white text-base font-bold">Review Before Submitting</DialogTitle>
          </div>
          <DialogDescription className="text-white/50 text-sm mt-1">
            Review the information the AI agent will submit for{" "}
            <span className="text-white/70 font-medium">{jobTitle}</span> at{" "}
            <span className="text-white/70 font-medium">{companyName}</span>.
          </DialogDescription>
        </DialogHeader>

        {submitState === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white font-semibold">Submitting your application...</p>
            <p className="text-white/50 text-sm">You'll receive an update once it's confirmed.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            {/* Job info */}
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex items-center gap-3">
              <Building className="w-4 h-4 text-white/40 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{jobTitle}</p>
                <p className="text-xs text-white/50">{companyName} {platform && `· via ${platform}`}</p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Missing fields warning */}
            {missingFields.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 p-3">
                <p className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {missingFields.length} field{missingFields.length > 1 ? "s" : ""} couldn't be filled
                </p>
                <div className="space-y-1">
                  {missingFields.map(f => (
                    <div key={f.label} className="flex items-center gap-2 text-xs text-amber-300/70">
                      <div className="w-1 h-1 rounded-full bg-amber-500/50 shrink-0" />
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Field summary */}
            {mappedFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {mappedFields.length} Fields Ready
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {mappedFields.map(f => (
                    <div
                      key={f.label}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="w-3 h-3 text-white/25 shrink-0" />
                        <span className="text-xs text-white/60 truncate">{f.label}</span>
                      </div>
                      <span className="text-xs text-white/40 truncate max-w-[120px] text-right">
                        {f.value ? (f.value.length > 25 ? f.value.substring(0, 25) + "…" : f.value) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitState === "submitting"}
                className="flex-1 border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={submitState === "submitting"}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40"
              >
                {submitState === "submitting" ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Submit Application</>
                )}
              </Button>
            </div>

            <p className="text-center text-white/25 text-[10px]">
              By submitting, you authorize the AI agent to complete and submit this application on your behalf.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
