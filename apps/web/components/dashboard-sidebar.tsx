"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Activity,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Settings,
  Sparkles,
  User,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

const navItems = [
  {
    title: "Jobs",
    href: "/dashboard/jobs",
    icon: Briefcase,
  },
  {
    title: "Resume",
    href: "/dashboard/resume",
    icon: FileText,
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    title: "Application Status",
    href: "/dashboard/status",
    icon: Activity,
  },
]

const footerItems = [
  {
    title: "Billing / Credits",
    href: "/dashboard/billing",
    icon: CreditCard,
  },
  {
    title: "Profile Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function DashboardSidebar() {
  const [isCollapsed, setIsCollapsed] = React.useState(false)
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "relative flex flex-col h-screen border-r bg-card transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[80px]" : "w-[280px]"
      )}
    >
      {/* Header / Logo */}
      <div className="flex h-14 items-center justify-between border-b px-4 py-4">
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center">
            <Image src="/logo.svg" alt="openned logo" width={32} height={32} className="object-contain" />
          </div>
          <span
            className={cn(
              "font-semibold whitespace-nowrap text-lg transition-opacity duration-300",
              isCollapsed ? "opacity-0 hidden" : "opacity-100"
            )}
          >
            openned
          </span>
        </Link>
      </div>

      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute -right-4 top-16 z-10 h-8 w-8 rounded-full border bg-background shadow-sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  isCollapsed ? "justify-center" : "justify-start"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer Navigation & Credits */}
      <div className="border-t p-4">
        <div className="grid gap-1">
          {footerItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  isCollapsed ? "justify-center" : "justify-start"
                )}
                title={isCollapsed ? item.title : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            )
          })}
        </div>

        {/* Credits Display */}
        <div
          className={cn(
            "mt-4 rounded-lg border bg-muted/50 p-4 transition-all duration-300",
            isCollapsed ? "hidden" : "block"
          )}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Credits</span>
            <span className="text-muted-foreground">15 / 50</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: "30%" }} />
          </div>
          <Link href="/dashboard/billing" className={cn(buttonVariants({ variant: "link" }), "mt-2 h-auto p-0 text-xs text-primary")}>
            Upgrade plan
          </Link>
        </div>
      </div>
    </div>
  )
}
