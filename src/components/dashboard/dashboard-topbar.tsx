"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "./dashboard-context";
import { Menu, PanelLeft, ChevronRight, Bell, Sparkles } from "lucide-react";

const routeNames: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/jobs": "Jobs",
  "/dashboard/resume": "Resume",
  "/dashboard/profile": "Profile",
  "/dashboard/applications": "Applications",
  "/dashboard/billing": "Billing & Credits",
  "/dashboard/settings": "Profile Settings",
};

export function DashboardTopbar() {
  const pathname = usePathname();
  const { toggleCollapse, toggleMobile, isCollapsed } = useDashboard();

  const currentTitle = routeNames[pathname] || "Dashboard";

  return (
    <header className="sticky top-0 z-20 h-16 w-full border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4">
      {/* Left section: Toggles & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={toggleMobile}
          className="flex md:hidden items-center justify-center w-9 h-9 rounded-xl text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
          aria-label="Open mobile menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop sidebar toggle button */}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
          title={`Toggle sidebar (${isCollapsed ? "Expand" : "Collapse"})`}
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {/* Breadcrumb path */}
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/dashboard/jobs"
            className="text-white/40 hover:text-white/80 transition-colors hidden sm:inline font-medium"
          >
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-white/25 hidden sm:inline" />
          <span className="font-semibold text-white truncate text-sm">
            {currentTitle}
          </span>
        </div>
      </div>

      {/* Right section: Global status & Actions */}
      <div className="flex items-center gap-3">
        {/* Sync Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-mono text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Synced</span>
        </div>

        {/* Shortcut pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/40 font-mono">
          <span>⌘</span>
          <span>B</span>
          <span className="text-[10px] text-white/30 ml-1">Sidebar</span>
        </div>

        {/* Notifications Icon Button */}
        <button
          className="relative w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
        </button>

        {/* Quick Upgrade / Credits Link */}
        <Link
          href="/dashboard/billing"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-black bg-white hover:bg-white/90 rounded-xl transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Credits</span>
        </Link>
      </div>
    </header>
  );
}
