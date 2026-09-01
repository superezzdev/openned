"use client";

import React, { useState, useEffect } from "react";
import { Cpu, Globe, Zap, Check, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { AutomationPreference } from "@/lib/automation/types";

interface EngineOption {
  id: AutomationPreference;
  title: string;
  badge?: string;
  badgeColor?: string;
  description: string;
  details: string;
  icon: React.ElementType;
}

const ENGINE_OPTIONS: EngineOption[] = [
  {
    id: AutomationPreference.AUTO,
    title: "Automatic",
    badge: "Recommended",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    description: "Try local automation first and use Browserbase when fallback is required.",
    details: "Combines local speed with cloud resilience. If local rendering or DOM checks encounter an issue, Browserbase resumes seamlessly.",
    icon: Sparkles,
  },
  {
    id: AutomationPreference.LOCAL_ONLY,
    title: "My Browser Automation",
    badge: "Local Only",
    badgeColor: "bg-blue-500/15 text-blue-300 border-blue-500/25",
    description: "Use local automation only.",
    details: "Runs automation entirely in your local headless environment. Never falls back to cloud browsers.",
    icon: Cpu,
  },
  {
    id: AutomationPreference.BROWSERBASE_ONLY,
    title: "Browserbase",
    badge: "Cloud Always",
    badgeColor: "bg-violet-500/15 text-violet-300 border-violet-500/25",
    description: "Always use Browserbase for automatic applications.",
    details: "Directs all automated application runs straight to Browserbase cloud sessions with full replay inspection.",
    icon: Globe,
  },
];

export function AutomationSettingsCard() {
  const [preference, setPreference] = useState<AutomationPreference>(AutomationPreference.AUTO);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreference() {
      try {
        const res = await fetch("/api/user/automation-preference");
        if (res.ok) {
          const data = await res.json();
          if (data.automation_preference) {
            setPreference(data.automation_preference as AutomationPreference);
          }
        }
      } catch (err: unknown) {
        console.warn("Failed to load automation preference:", err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoading(false);
      }
    }
    fetchPreference();
  }, []);

  const handleSelect = async (newPref: AutomationPreference) => {
    if (newPref === preference || isSaving) return;
    setPreference(newPref);
    setIsSaving(true);
    setErrorMessage(null);
    setSavedSuccess(false);

    try {
      const res = await fetch("/api/user/automation-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation_preference: newPref }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save preference");
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl shadow-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Automation Engine</h2>
              <p className="text-xs text-white/50">
                Choose how your AI agent executes job applications in the browser.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
            </span>
          )}
          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <Check className="h-3.5 w-3.5" /> Saved
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {errorMessage}
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-white/30" />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {ENGINE_OPTIONS.map((option) => {
            const isSelected = preference === option.id;
            const Icon = option.icon;

            return (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-violet-500/50 bg-violet-500/[0.08] shadow-lg shadow-violet-500/5"
                    : "border-white/5 bg-white/[0.01] hover:border-white/15 hover:bg-white/[0.03]"
                }`}
              >
                {/* Radio Circle */}
                <div className="pt-0.5">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? "border-violet-400 bg-violet-500"
                        : "border-white/30 bg-white/5"
                    }`}
                  >
                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>

                {/* Icon */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    isSelected
                      ? "border-violet-500/30 bg-violet-500/20 text-violet-300"
                      : "border-white/10 bg-white/5 text-white/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{option.title}</span>
                    {option.badge && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${option.badgeColor}`}
                      >
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/70 mt-1 font-medium">{option.description}</p>
                  <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{option.details}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.01] p-3 text-[11px] text-white/40">
        <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
        <span>
          Credentials and session tokens are encrypted and strictly managed on the server. Browserbase sessions never expose sensitive credentials.
        </span>
      </div>
    </div>
  );
}
