"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useDashboard } from "./dashboard-context";
import { SignOutButton } from "./signout-button";
import {
  Briefcase,
  FileText,
  User,
  ListChecks,
  CreditCard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Plus,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface UserProfile {
  id: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
}

interface DashboardSidebarProps {
  user: UserProfile;
  credits?: {
    used: number;
    total: number;
    plan: string;
  };
}

export function DashboardSidebar({
  user,
  credits = {
    used: 160,
    total: 500,
    plan: "Pro Tier",
  },
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, isMobileOpen, setIsMobileOpen } =
    useDashboard();

  const remainingCredits = Math.max(0, credits.total - credits.used);
  const creditPercentage = Math.min(
    100,
    Math.round((remainingCredits / credits.total) * 100)
  );

  const mainNavItems = [
    {
      title: "Jobs",
      href: "/dashboard/jobs",
      icon: Briefcase,
      badge: "New",
      description: "Explore curated job matches",
    },
    {
      title: "Resume",
      href: "/dashboard/resume",
      icon: FileText,
      description: "Manage tailored resume versions",
    },
    {
      title: "Profile",
      href: "/dashboard/profile",
      icon: User,
      description: "Personal and career background",
    },
    {
      title: "Application Status",
      href: "/dashboard/applications",
      icon: ListChecks,
      badge: "3 Active",
      description: "Track submission pipeline",
    },
    {
      title: "Job Ingestion",
      href: "/dashboard/admin/sources",
      icon: Sparkles,
      badge: "Admin",
      description: "ATS sync and crawler observability",
    },
  ];

  const footerNavItems = [
    {
      title: "Billing / Credits",
      href: "/dashboard/billing",
      icon: CreditCard,
      description: "Subscription and AI credits",
    },
    {
      title: "Profile Settings",
      href: "/dashboard/settings",
      icon: Settings,
      description: "Account preferences and security",
    },
  ];

  // Helper to render a navigation link with tooltip support in collapsed state
  const renderNavLink = (item: (typeof mainNavItems)[0]) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));
    const Icon = item.icon;

    const linkContent = (
      <Link
        href={item.href}
        onClick={() => setIsMobileOpen(false)}
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
          isActive
            ? "bg-white text-black shadow-md shadow-white/5 font-semibold"
            : "text-white/60 hover:text-white hover:bg-white/[0.06]",
          isCollapsed ? "justify-center px-2" : "justify-between"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon
            className={cn(
              "w-4 h-4 shrink-0 transition-colors",
              isActive
                ? "text-black"
                : "text-white/60 group-hover:text-white group-hover:scale-110 duration-200"
            )}
          />
          {!isCollapsed && (
            <span className="truncate tracking-tight">{item.title}</span>
          )}
        </div>

        {!isCollapsed && item.badge && (
          <span
            className={cn(
              "text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full shrink-0",
              isActive
                ? "bg-black/10 text-black font-semibold"
                : "bg-white/10 text-white/70"
            )}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger render={<div className="w-full" />}>
            {linkContent}
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={12}
            className="bg-[#181818] border border-white/15 text-white shadow-xl px-3 py-1.5"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-xs">{item.title}</span>
              {item.description && (
                <span className="text-[10px] text-white/50">
                  {item.description}
                </span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  const sidebarContent = (
    <TooltipProvider delay={100}>
      <div className="flex flex-col h-full justify-between select-none">
        {/* Top Header & Navigation */}
        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div
            className={cn(
              "flex items-center pb-4 border-b border-white/10 transition-all duration-300",
              isCollapsed ? "justify-center" : "justify-between"
            )}
          >
            <Link
              href="/dashboard/jobs"
              className={cn(
                "flex items-center gap-2.5 group outline-none",
                isCollapsed && "justify-center"
              )}
            >
              <div className="relative w-8 h-8 rounded-lg bg-black border border-white/15 p-1 flex items-center justify-center shadow-inner group-hover:border-white/30 transition-colors shrink-0">
                <Image
                  src="/logo.svg"
                  alt="openned logo"
                  width={24}
                  height={24}
                  className="object-contain"
                  priority
                />
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-sans font-bold text-lg tracking-tight text-white group-hover:text-white/90 transition-colors">
                    openned
                  </span>
                  <span className="text-[9px] uppercase font-mono tracking-widest bg-white/10 text-white/70 px-1.5 py-0.5 rounded border border-white/10">
                    Pro
                  </span>
                </div>
              )}
            </Link>

            {/* Collapse Toggle Button (Desktop) */}
            {!isCollapsed && (
              <button
                onClick={toggleCollapse}
                title="Collapse sidebar (Cmd+B)"
                className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* If Collapsed, show Expand toggle below logo */}
          {isCollapsed && (
            <div className="hidden md:flex justify-center -mt-2">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      onClick={toggleCollapse}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  }
                />
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-[#181818] border border-white/15 text-white"
                >
                  Expand Sidebar (Cmd+B)
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Section: Main Navigation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[11px] font-medium uppercase tracking-wider text-white/35 mb-2 font-mono">
                Platform
              </p>
            )}
            <nav className="space-y-1.5">{mainNavItems.map(renderNavLink)}</nav>
          </div>
        </div>

        {/* Bottom / Footer Section */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          {/* Proper Credits Display Section */}
          {!isCollapsed ? (
            <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-3.5 space-y-3 relative overflow-hidden backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Credits</span>
                </div>
                <Link
                  href="/dashboard/billing"
                  className="text-[10px] font-medium text-white/50 hover:text-white flex items-center gap-0.5 transition-colors"
                >
                  <span>Buy</span>
                  <Plus className="w-3 h-3" />
                </Link>
              </div>

              {/* Progress Bar & Numeric Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="font-bold text-white text-sm">
                    {remainingCredits}
                  </span>
                  <span className="text-white/40 text-[11px]">
                    / {credits.total} left
                  </span>
                </div>

                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      creditPercentage > 40
                        ? "bg-gradient-to-r from-emerald-400 to-teal-300"
                        : creditPercentage > 15
                        ? "bg-gradient-to-r from-amber-400 to-orange-400"
                        : "bg-gradient-to-r from-red-500 to-rose-400"
                    )}
                    style={{ width: `${creditPercentage}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/40 pt-0.5">
                <span className="truncate">{credits.plan}</span>
                <span className="text-emerald-400/80 font-mono">
                  {creditPercentage}%
                </span>
              </div>
            </div>
          ) : (
            /* Collapsed credits compact meter */
            <div className="flex justify-center">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/dashboard/billing"
                      className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex flex-col items-center justify-center text-amber-400 transition-colors group"
                    >
                      <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-mono font-bold text-white/80 mt-0.5">
                        {remainingCredits}
                      </span>
                    </Link>
                  }
                />
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-[#181818] border border-white/15 text-white"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">
                      {remainingCredits} / {credits.total} Credits Available
                    </p>
                    <p className="text-[10px] text-white/50">
                      Click to manage billing & add credits
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Secondary Nav (Billing & Settings) */}
          <div className="space-y-1.5">
            {footerNavItems.map(renderNavLink)}
          </div>

          {/* User Account / Profile Section */}
          <div
            className={cn(
              "pt-3 border-t border-white/10 flex items-center gap-3",
              isCollapsed ? "justify-center" : "justify-between"
            )}
          >
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Link
                      href="/dashboard/settings"
                      className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/20 to-white/5 border border-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner hover:scale-105 transition-transform"
                    >
                      {user.displayName.charAt(0).toUpperCase()}
                    </Link>
                  }
                />
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-[#181818] border border-white/15 text-white"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-xs">{user.displayName}</p>
                    <p className="text-[10px] text-white/50">
                      {user.email || "Profile Settings"}
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/20 to-white/5 border border-white/15 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-inner">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 overflow-hidden">
                    <p className="text-xs font-semibold text-white truncate">
                      {user.displayName}
                    </p>
                    <p className="text-[10px] text-white/40 truncate">
                      {user.email || "Signed in"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <SignOutButton />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );

  return (
    <>
      {/* Desktop Persistent Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-[#0A0A0A] border-r border-white/10 p-4 h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-30",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Slide-over Sheet) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity animate-in fade-in"
          />

          {/* Drawer content */}
          <div className="relative w-72 bg-[#0A0A0A] border-r border-white/10 p-5 h-full z-50 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
