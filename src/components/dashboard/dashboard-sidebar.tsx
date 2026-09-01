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
  initialActiveApplicationsCount?: number;
}

export function DashboardSidebar({
  user,
  credits = {
    used: 160,
    total: 500,
    plan: "Pro Tier",
  },
  initialActiveApplicationsCount = 0,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, isMobileOpen, setIsMobileOpen } =
    useDashboard();

  const [activeCount, setActiveCount] = React.useState<number>(
    initialActiveApplicationsCount
  );

  // Sync state if prop changes
  React.useEffect(() => {
    if (typeof initialActiveApplicationsCount === "number") {
      setActiveCount(initialActiveApplicationsCount);
    }
  }, [initialActiveApplicationsCount]);

  const fetchActiveCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/applications/active-count", {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === "number") {
          setActiveCount(data.count);
        }
      }
    } catch {
      // Ignore background network errors
    }
  }, []);

  // Listen to application update events dispatched from dashboard actions
  React.useEffect(() => {
    const handleUpdate = () => {
      fetchActiveCount();
    };

    window.addEventListener("applications-updated", handleUpdate);
    return () => {
      window.removeEventListener("applications-updated", handleUpdate);
    };
  }, [fetchActiveCount]);

  // Re-fetch when navigating to or from pages
  React.useEffect(() => {
    fetchActiveCount();
  }, [pathname, fetchActiveCount]);

  // If there are active applications, poll periodically to clear badge when they complete
  React.useEffect(() => {
    if (activeCount <= 0) return;
    const interval = setInterval(fetchActiveCount, 6000);
    return () => clearInterval(interval);
  }, [activeCount, fetchActiveCount]);

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
      title: "Applications",
      href: "/dashboard/applications",
      icon: ListChecks,
      badge: activeCount > 0 ? `${activeCount} Active` : undefined,
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
        prefetch={true}
        onClick={() => setIsMobileOpen(false)}
        className={cn(
          "relative flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-[15px] font-medium transition-all duration-200 group",
          isActive
            ? "bg-white text-black shadow-md shadow-white/5 font-semibold"
            : "text-white/65 hover:text-white hover:bg-white/[0.06]",
          isCollapsed ? "justify-center px-2.5 py-3" : "justify-between"
        )}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <Icon
            className={cn(
              "w-5 h-5 shrink-0 transition-colors",
              isActive
                ? "text-black"
                : "text-white/65 group-hover:text-white group-hover:scale-110 duration-200"
            )}
          />
          {!isCollapsed && (
            <span className="truncate tracking-tight">{item.title}</span>
          )}
        </div>

        {!isCollapsed && item.badge && (
          <span
            className={cn(
              "text-[11px] uppercase font-mono tracking-wider px-2.5 py-0.5 rounded-full shrink-0 font-medium",
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
              "flex items-center pb-5 border-b border-white/10 transition-all duration-300",
              isCollapsed ? "justify-center" : "justify-between"
            )}
          >
            <Link
              href="/dashboard/jobs"
              className={cn(
                "flex items-center gap-3 group outline-none",
                isCollapsed && "justify-center"
              )}
            >
              <div className="relative w-10 h-10 rounded-xl bg-black border border-white/15 p-1.5 flex items-center justify-center shadow-inner group-hover:border-white/30 transition-colors shrink-0">
                <Image
                  src="/logo.svg"
                  alt="openned logo"
                  width={26}
                  height={26}
                  className="object-contain"
                  priority
                />
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-sans font-bold text-xl tracking-tight text-white group-hover:text-white/90 transition-colors">
                    openned
                  </span>
                  <span className="text-[10px] uppercase font-mono tracking-widest bg-white/10 text-white/80 px-2 py-0.5 rounded-md border border-white/10">
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
                className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 cursor-pointer"
              >
                <ChevronLeft className="w-4.5 h-4.5" />
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
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors border border-white/10 cursor-pointer"
                    >
                      <ChevronRight className="w-4.5 h-4.5" />
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
          <div className="space-y-2">
            {!isCollapsed && (
              <p className="px-3.5 text-xs font-semibold uppercase tracking-wider text-white/40 mb-2.5 font-mono">
                Platform
              </p>
            )}
            <nav className="space-y-2">{mainNavItems.map(renderNavLink)}</nav>
          </div>
        </div>

        {/* Bottom / Footer Section */}
        <div className="space-y-5 pt-5 border-t border-white/10">
          {/* Proper Credits Display Section */}
          {!isCollapsed ? (
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-3.5 relative overflow-hidden backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>AI Credits</span>
                </div>
                <Link
                  href="/dashboard/billing"
                  className="text-xs font-medium text-white/60 hover:text-white flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-white/10"
                >
                  <span>Buy</span>
                  <Plus className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Progress Bar & Numeric Indicator */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between font-mono">
                  <span className="font-bold text-white text-base">
                    {remainingCredits}
                  </span>
                  <span className="text-white/45 text-xs">
                    / {credits.total} left
                  </span>
                </div>

                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
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

              <div className="flex items-center justify-between text-xs text-white/45 pt-0.5">
                <span className="truncate">{credits.plan}</span>
                <span className="text-emerald-400/90 font-mono font-medium">
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
                      className="w-11 h-11 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex flex-col items-center justify-center text-amber-400 transition-colors group"
                    >
                      <Sparkles className="w-4.5 h-4.5 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-mono font-bold text-white/80 mt-0.5">
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
          <div className="space-y-2">
            {!isCollapsed && (
              <p className="px-3.5 text-xs font-semibold uppercase tracking-wider text-white/40 mb-2 font-mono">
                Manage
              </p>
            )}
            <nav className="space-y-2">{footerNavItems.map(renderNavLink)}</nav>
          </div>

          {/* User Account / Profile Section */}
          <div
            className={cn(
              "pt-4 border-t border-white/10 flex items-center gap-3",
              isCollapsed ? "justify-center" : "justify-between"
            )}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        href="/dashboard/settings"
                        className="w-10 h-10 rounded-full bg-gradient-to-tr from-white/20 to-white/5 border border-white/15 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner hover:scale-105 transition-transform"
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

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <SignOutButton
                        compact
                        className="w-10 h-10 p-0 flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                      />
                    }
                  />
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="bg-[#181818] border border-white/15 text-white"
                  >
                    <p className="text-xs font-semibold">Sign out</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-white/20 to-white/5 border border-white/15 flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">
                      {user.displayName}
                    </p>
                    <p className="text-xs text-white/45 truncate">
                      {user.email || "Signed in"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <SignOutButton className="p-2 px-2.5 text-xs text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl" />
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
          "hidden md:flex flex-col bg-[#0A0A0A] border-r border-white/10 h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out z-30",
          isCollapsed ? "w-20 p-3.5" : "w-72 p-5"
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
          <div className="relative w-80 bg-[#0A0A0A] border-r border-white/10 p-5 h-full z-50 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
