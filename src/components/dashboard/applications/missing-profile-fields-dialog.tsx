"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, CheckCircle2, UserCircle, Save } from "lucide-react";
import { MissingFieldInfo } from "@/lib/applications/types";

interface MissingProfileFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  jobTitle: string;
  companyName: string;
  missingFields: MissingFieldInfo[];
  onSuccess?: () => void;
}

type SaveState = "idle" | "saving" | "success" | "error";

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

  const requiredFields = missingFields.filter(f => !f.type.startsWith("optional"));
  const allRequiredFilled = requiredFields.every(f => values[f.field_key]?.trim());

  const handleSave = async () => {
    setSaveState("saving");
    setError(null);

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
      onSuccess?.();
      setTimeout(() => {
        onOpenChange(false);
        setSaveState("idle");
        setValues({});
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "An error occurred. Please try again.");
      setSaveState("error");
    }
  };

  const renderFieldInput = (field: MissingFieldInfo) => {
    const value = values[field.field_key] || "";
    const baseClass =
      "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors";

    if (field.type === "select" && field.options?.length) {
      return (
        <select
          value={value}
          onChange={e => handleChange(field.field_key, e.target.value)}
          className={`${baseClass} [&>option]:bg-[#0f1117]`}
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
        <div className="flex flex-wrap gap-2">
          {field.options.map(opt => (
            <label
              key={opt}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm cursor-pointer transition-all ${
                value === opt
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20"
              }`}
            >
              <input
                type="radio"
                name={field.field_key}
                value={opt}
                checked={value === opt}
                onChange={() => handleChange(field.field_key, opt)}
                className="hidden"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          value={value}
          onChange={e => handleChange(field.field_key, e.target.value)}
          placeholder={`Enter ${field.label.toLowerCase()}...`}
          rows={3}
          className={`${baseClass} resize-none`}
        />
      );
    }

    const inputTypeMap: Record<string, string> = {
      email: "email", tel: "tel", number: "number",
      date: "date", url: "url",
    };

    return (
      <input
        type={inputTypeMap[field.type] || "text"}
        value={value}
        onChange={e => handleChange(field.field_key, e.target.value)}
        placeholder={`Enter ${field.label.toLowerCase()}...`}
        className={baseClass}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={open => {
      if (saveState !== "saving") onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg bg-[#0f1117] border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <UserCircle className="w-4 h-4 text-amber-400" />
            </div>
            <DialogTitle className="text-white text-base font-bold">Complete Your Profile</DialogTitle>
          </div>
          <DialogDescription className="text-white/50 text-sm mt-1">
            The AI agent needs a few more details to apply to{" "}
            <span className="text-white/70 font-medium">{jobTitle}</span> at{" "}
            <span className="text-white/70 font-medium">{companyName}</span>.
            These will be saved to your profile for future applications.
          </DialogDescription>
        </DialogHeader>

        {saveState === "success" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white font-semibold">Profile updated!</p>
            <p className="text-white/50 text-sm">Resuming your application...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {missingFields.map(field => (
              <div key={field.field_key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-white/80 flex items-center gap-1.5">
                  {field.label}
                  <span className="text-red-400 text-xs">*</span>
                </label>
                {renderFieldInput(field)}
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveState === "saving"}
                className="flex-1 border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!allRequiredFilled || saveState === "saving"}
                className="flex-1 bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40"
              >
                {saveState === "saving" ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</>
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
