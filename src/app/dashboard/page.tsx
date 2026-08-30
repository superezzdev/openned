import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/dashboard/profile-editor";
import {
  Sparkles,
  Database,
  ShieldCheck,
  Zap,
  TrendingUp,
  CheckCircle,
} from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If somehow null (though guarded by layout & middleware), fallback
  if (!user) {
    return null;
  }

  // Fetch public.profiles record
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const displayName =
    profile?.first_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.first_name ||
    user.email?.split("@")[0] ||
    "Explorer";

  // Calculate profile completeness
  const fields = [
    profile?.first_name,
    profile?.last_name,
    profile?.email || user.email,
    profile?.phone,
    profile?.location,
    profile?.summary,
  ];
  const filledFields = fields.filter(Boolean).length;
  const completeness = Math.round((filledFields / fields.length) * 100);

  const authProvider = user.app_metadata?.provider || "email";

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-white/[0.08] via-white/[0.03] to-transparent border border-white/10 rounded-2xl p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-white/[0.04] to-transparent pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-white/90" />
            <span>Welcome to your Openned Dashboard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">
            Hello, {displayName} 👋
          </h1>
          <p className="mt-1 text-sm text-white/50 max-w-xl">
            Your Supabase authentication and database integration are active and
            synced. Manage your profile and workspace details below.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#121212]/80 border border-white/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Profile Strength</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {completeness}%
          </div>
          <div className="mt-2 w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>

        <div className="bg-[#121212]/80 border border-white/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Auth Provider</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white capitalize">
            {authProvider}
          </div>
          <p className="mt-2 text-[11px] text-white/40">
            {user.email_confirmed_at ? "Email verified" : "Active session"}
          </p>
        </div>

        <div className="bg-[#121212]/80 border border-white/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Database Status</span>
            <Database className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">Connected</div>
          <p className="mt-2 text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            PostgreSQL 17
          </p>
        </div>

        <div className="bg-[#121212]/80 border border-white/10 rounded-xl p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-white/50 text-xs">
            <span>Security Layer</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">RLS Active</div>
          <p className="mt-2 text-[11px] text-white/40">
            Row Level Security Enabled
          </p>
        </div>
      </div>

      {/* Profile Editor Component */}
      <div id="profile">
        <ProfileEditor
          initialProfile={profile}
          userEmail={user.email || ""}
          userId={user.id}
        />
      </div>

      {/* Supabase Technical Integration Details Card */}
      <div className="bg-[#121212]/60 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-sm font-medium text-white flex items-center gap-2 mb-4">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Active Supabase Integration Specs</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-white/40 block mb-1">Authenticated UID</span>
            <span className="font-mono text-white/90 break-all select-all">
              {user.id}
            </span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-white/40 block mb-1">Session Expiration</span>
            <span className="font-mono text-white/90">
              Auto-refreshed via Middleware
            </span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <span className="text-white/40 block mb-1">Data Model</span>
            <span className="font-mono text-white/90">
              public.profiles (Postgres)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
