"use client";

import { useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Profile {
  id?: string;
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  summary?: string | null;
}

export function ProfileEditor({
  initialProfile,
  userEmail,
  userId,
}: {
  initialProfile: Profile | null;
  userEmail: string;
  userId: string;
}) {
  const [firstName, setFirstName] = useState(initialProfile?.first_name || "");
  const [lastName, setLastName] = useState(initialProfile?.last_name || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [location, setLocation] = useState(initialProfile?.location || "");
  const [summary, setSummary] = useState(initialProfile?.summary || "");

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const supabase = createClient();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const { error } = await supabase
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
        );

      if (error) {
        throw error;
      }

      setStatusMessage({
        type: "success",
        text: "Profile updated successfully!",
      });
      setTimeout(() => {
        setStatusMessage(null);
      }, 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile.";
      setStatusMessage({
        type: "error",
        text: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const initials =
    ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase() ||
    (userEmail?.[0] || "U").toUpperCase();

  return (
    <div className="bg-[#121212]/90 border border-white/10 rounded-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/20 to-white/5 border border-white/15 flex items-center justify-center text-lg font-bold text-white shadow-inner">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-medium text-white flex items-center gap-2">
              {firstName || lastName
                ? `${firstName} ${lastName}`.trim()
                : "Your Profile"}
              <span className="text-[11px] font-mono font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Active
              </span>
            </h2>
            <p className="text-xs text-white/50">{userEmail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] uppercase tracking-wider text-white/40 block">
              Database Sync
            </span>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 justify-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </div>
        </div>
      </div>

      {/* Status notification */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mt-4 p-3 rounded-xl flex items-center gap-3 text-xs ${
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
            <span>{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form */}
      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              First Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alex"
                className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/25 rounded-xl text-xs text-[#f5f5f5] placeholder:text-white/30 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Last Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Morgan"
                className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/25 rounded-xl text-xs text-[#f5f5f5] placeholder:text-white/30 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/25 rounded-xl text-xs text-[#f5f5f5] placeholder:text-white/30 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Location
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <MapPin className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco, CA"
                className="w-full h-10 pl-10 pr-3.5 bg-white/[0.04] border border-white/10 focus:border-white/25 rounded-xl text-xs text-[#f5f5f5] placeholder:text-white/30 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/70 mb-1.5">
            Professional Summary
          </label>
          <div className="relative">
            <div className="absolute top-3 left-3.5 pointer-events-none text-white/40">
              <FileText className="w-4 h-4" />
            </div>
            <textarea
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary about your skills, focus, and background..."
              className="w-full pl-10 pr-3.5 py-2.5 bg-white/[0.04] border border-white/10 focus:border-white/25 rounded-xl text-xs text-[#f5f5f5] placeholder:text-white/30 focus:outline-none transition-colors resize-none"
            />
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <div className="text-[11px] text-white/40 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-white/60" />
            <span>Changes sync in real-time to Supabase</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="h-9 px-4 bg-[#f5f5f5] hover:bg-white text-[#0a0a0a] font-medium text-xs rounded-xl transition-all flex items-center gap-2 shadow-md shadow-white/10 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
