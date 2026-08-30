import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { SignOutButton } from "@/components/dashboard/signout-button";
import {
  LayoutDashboard,
  User,
  FileText,
  Briefcase,
  Layers,
  Settings,
  ExternalLink,
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin?redirect=/dashboard");
  }

  // Fetch profile
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
    "User";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f5f5f5] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-[#0e0e0e] border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Top Logo */}
          <div className="flex items-center justify-between px-2 py-3 mb-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-6 h-6 flex items-center justify-center overflow-hidden">
                <Image
                  src="/logo.svg"
                  alt="Openned Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-sans font-medium text-lg tracking-tight text-[#f5f5f5]">
                Openned
              </span>
            </Link>
            <span className="text-[10px] uppercase font-mono tracking-widest bg-white/5 border border-white/10 text-white/50 px-2 py-0.5 rounded-full">
              Console
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-white bg-white/10 rounded-xl transition-all shadow-sm"
            >
              <LayoutDashboard className="w-4 h-4 text-white/80" />
              <span>Overview</span>
            </Link>
            <Link
              href="#profile"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <User className="w-4 h-4 text-white/40" />
              <span>Profile</span>
            </Link>
            <Link
              href="#resumes"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <FileText className="w-4 h-4 text-white/40" />
              <span>Resumes</span>
            </Link>
            <Link
              href="#experiences"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <Briefcase className="w-4 h-4 text-white/40" />
              <span>Experiences</span>
            </Link>
            <Link
              href="#projects"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <Layers className="w-4 h-4 text-white/40" />
              <span>Projects</span>
            </Link>
            <Link
              href="#settings"
              className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            >
              <Settings className="w-4 h-4 text-white/40" />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        {/* User Card & Sign Out */}
        <div className="pt-4 border-t border-white/5 mt-4 space-y-3">
          <div className="px-2 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/20 to-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {(displayName?.[0] || "U").toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-white truncate">
                  {displayName}
                </p>
                <p className="text-[10px] text-white/40 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <Link
              href="/"
              className="text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1 transition-colors px-2 py-1"
            >
              <span>Landing</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-8">{children}</div>
      </main>
    </div>
  );
}
