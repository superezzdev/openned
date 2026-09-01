"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Eye, Send, AlertCircle, User, Building, Sparkles, PenLine } from "lucide-react";
import { ApplicationStatus, MissingFieldInfo } from "@/lib/applications/types";
import { MissingProfileFieldsDialog } from "./missing-profile-fields-dialog";

export interface ReviewField {
  field_key?: string;
  label: string;
  value?: string | null;
  status: "mapped" | "missing" | "optional";
  type?: string;
  options?: string[];
  required?: boolean;
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
  const [currentFields, setCurrentFields] = useState<ReviewField[]>(fields || []);
  const [missingDialogOpen, setMissingDialogOpen] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Sync with prop if passed, or auto-fetch from API if fields is empty
  useEffect(() => {
    if (!open) return;

    if (fields && fields.length > 0) {
      setCurrentFields(fields);
      return;
    }

    let active = true;
    async function loadFields() {
      setIsLoadingFields(true);
      try {
        const res = await fetch(`/api/applications/${applicationId}`);
        if (res.ok && active) {
          const data = await res.json();
          const forms = data.application?.application_forms || [];
          const formFields = forms[0]?.application_form_fields || [];
          const missing = (data.application?.missing_fields || []) as MissingFieldInfo[];

          if (formFields.length > 0) {
            const mapped: ReviewField[] = formFields.map((ff: any) => ({
              field_key: ff.field_key,
              label: ff.label || ff.field_key,
              value: ff.current_value,
              status: ff.status === "MAPPED" ? "mapped" : ff.status === "MISSING" ? "missing" : "optional",
              type: ff.type,
              options: ff.options_json,
              required: ff.required,
            }));
            setCurrentFields(mapped);
          } else if (missing.length > 0) {
            setCurrentFields(missing.map(m => ({
              field_key: m.field_key,
              label: m.label,
              value: null,
              status: "missing",
              type: m.type,
              options: m.options,
              required: true,
            })));
          }
        }
      } catch {
        // Silently keep default
      } finally {
        if (active) setIsLoadingFields(false);
      }
    }

    loadFields();
    return () => { active = false; };
  }, [open, applicationId, fields]);

  const mappedFields = currentFields.filter(f => f.status === "mapped");
  const missingFields = currentFields.filter(f => f.status === "missing");

  // Construct MissingFieldInfo array for the dialog
  const missingFieldsList: MissingFieldInfo[] = missingFields.map(f => ({
    field_key: f.field_key || f.label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
    label: f.label,
    type: f.type || "text",
    options: f.options,
  }));

  const handleConfirm = async () => {
    if (missingFields.length > 0) {
      setMissingDialogOpen(true);
      return;
    }

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

  const handleMissingFieldsSaved = (savedValues?: Record<string, string>) => {
    if (savedValues) {
      setCurrentFields(prev => prev.map(f => {
        const key = f.field_key || f.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const val = savedValues[key] || savedValues[f.label] || (f.field_key ? savedValues[f.field_key] : undefined);
        if (val) {
          return { ...f, value: val, status: "mapped" };
        }
        return f;
      }));
    }
    setSaveBanner("Information saved to database! Your application is ready to submit.");
    setTimeout(() => setSaveBanner(null), 4000);
  };

  return (
    <>
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

              {/* Success update banner */}
              {saveBanner && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{saveBanner}</span>
                </div>
              )}

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Loading indicator if fetching fields */}
              {isLoadingFields && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>Loading application fields...</span>
                </div>
              )}

              {/* Missing fields alert with button to open missing fields dialog */}
              {!isLoadingFields && missingFields.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-300">
                          {missingFields.length} Required Field{missingFields.length > 1 ? "s" : ""} Couldn't Be Filled
                        </p>
                        <p className="text-[11px] text-amber-200/70 mt-0.5">
                          Please provide the missing details below so the AI agent can submit your application.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pl-6">
                    {missingFields.map(f => (
                      <div key={f.label} className="flex items-center gap-2 text-xs text-amber-200/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    onClick={() => setMissingDialogOpen(true)}
                    className="w-full h-8 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <PenLine className="w-3.5 h-3.5" />
                    Fill Missing Information
                  </Button>
                </div>
              )}

              {/* Field summary */}
              {!isLoadingFields && mappedFields.length > 0 && (
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
                        <span className="text-xs text-white/40 truncate max-w-[140px] text-right">
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
                  className={`flex-1 font-semibold disabled:opacity-40 text-white ${
                    missingFields.length > 0
                      ? "bg-amber-600 hover:bg-amber-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {submitState === "submitting" ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting...</>
                  ) : missingFields.length > 0 ? (
                    <><PenLine className="w-4 h-4 mr-2" />Fill Missing Details to Submit</>
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

      {/* Embedded Missing Profile Fields Dialog */}
      {missingDialogOpen && (
        <MissingProfileFieldsDialog
          open={missingDialogOpen}
          onOpenChange={setMissingDialogOpen}
          applicationId={applicationId}
          jobTitle={jobTitle}
          companyName={companyName}
          missingFields={missingFieldsList}
          onSuccess={handleMissingFieldsSaved}
        />
      )}
    </>
  );
}
