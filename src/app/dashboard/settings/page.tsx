import { AutomationSettingsCard } from "@/components/dashboard/settings/automation-settings-card";
import { Settings, Shield, Bell } from "lucide-react";

export const metadata = {
  title: "Settings | Openned",
  description: "Configure your application automation preferences, account security, and notification settings.",
};

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <div>
        <div className="flex items-center gap-2 text-white/50 text-xs font-mono mb-1 uppercase tracking-wider">
          <Settings className="w-3.5 h-3.5" />
          Settings & Preferences
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Application & Engine Settings</h1>
        <p className="text-sm text-white/50 mt-1">
          Manage how your automated job application agent executes across employer portals.
        </p>
      </div>

      {/* Automation Engine Configuration */}
      <AutomationSettingsCard />

      {/* Informational Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5">
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Anti-Bot & Verification Policy
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Openned adheres to strict ethical automation. Cloud execution engines are never used to bypass CAPTCHAs, Cloudflare checks, or authentication barriers. When employer verification is detected, your application pauses safely for your action.
          </p>
        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5">
          <div className="flex items-center gap-2 text-white font-medium text-sm mb-2">
            <Bell className="w-4 h-4 text-sky-400" />
            Execution Concurrency
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            To prevent platform rate-limiting and duplicate submissions, applications run with per-user queuing. Cloud sessions are governed by active concurrency limits and automatically cleaned up upon task completion.
          </p>
        </div>
      </div>
    </div>
  );
}
