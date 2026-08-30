"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, ArrowUpRight } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconColor?: string; // Tailwind text color class, e.g. "text-emerald-400"
  iconBgColor?: string; // Tailwind bg color class, e.g. "bg-emerald-500/10 border-emerald-500/20"
  badge?: {
    text: string;
    variant?: "emerald" | "amber" | "cyan" | "blue" | "neutral" | "rose";
  };
  progressSlot?: React.ReactNode;
  onClick?: () => void;
  actionLabel?: string;
  className?: string;
  highlight?: boolean;
}

const badgeVariants = {
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  neutral: "bg-white/5 text-white/70 border-white/10",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-white/80",
  iconBgColor = "bg-white/[0.06] border-white/10",
  badge,
  progressSlot,
  onClick,
  actionLabel,
  className,
  highlight = false,
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-2xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 backdrop-blur-xl group overflow-hidden",
        "bg-[#141415]/90 border border-white/10",
        highlight && "border-white/20 bg-[#171719]/90 shadow-lg shadow-black/40",
        isClickable &&
          "cursor-pointer hover:border-white/25 hover:bg-[#19191b] hover:shadow-md hover:-translate-y-0.5",
        className
      )}
    >
      {/* Top subtle glow on hover */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] group-hover:bg-white/[0.04] rounded-full blur-2xl pointer-events-none transition-colors" />

      {/* Card Header: Icon + Badge / Action */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className={cn(
                "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                iconBgColor
              )}
            >
              <Icon className={cn("w-4 h-4", iconColor)} />
            </div>
          )}
          <span className="text-xs font-medium text-white/60 group-hover:text-white/80 transition-colors line-clamp-1">
            {title}
          </span>
        </div>

        {badge && (
          <span
            className={cn(
              "text-[10px] font-medium font-mono px-2 py-0.5 rounded-full border shrink-0",
              badgeVariants[badge.variant || "neutral"]
            )}
          >
            {badge.text}
          </span>
        )}

        {!badge && isClickable && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 group-hover:text-white/80 shrink-0">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Card Body: Value & Progress Slot */}
      <div className="flex items-center justify-between gap-4 mt-auto">
        <div className="space-y-1 min-w-0">
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight truncate">
            {value}
          </div>
          {subtitle && (
            <div className="text-xs text-white/40 group-hover:text-white/60 transition-colors truncate">
              {subtitle}
            </div>
          )}
        </div>

        {progressSlot && (
          <div className="shrink-0 flex items-center justify-center">
            {progressSlot}
          </div>
        )}
      </div>

      {/* Optional bottom action text */}
      {actionLabel && isClickable && (
        <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40 group-hover:text-white/70 transition-colors">
          <span>{actionLabel}</span>
          <ArrowUpRight className="w-3 h-3 text-white/40 group-hover:text-white/70" />
        </div>
      )}
    </div>
  );
}
