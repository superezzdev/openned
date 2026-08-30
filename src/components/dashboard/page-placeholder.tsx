import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface PagePlaceholderProps {
  title: string;
  description: string;
  badge?: string;
  icon: React.ComponentType<{ className?: string }>;
  actionLabel?: string;
  actionHref?: string;
}

export function PagePlaceholder({
  title,
  description,
  badge,
  icon: Icon,
  actionLabel,
  actionHref,
}: PagePlaceholderProps) {
  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white font-sans">
              {title}
            </h1>
            {badge && (
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-white/50 max-w-2xl">
            {description}
          </p>
        </div>

        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-black bg-white hover:bg-white/90 rounded-xl transition-all shadow-sm active:scale-[0.98]"
          >
            <span>{actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {/* Blank / Empty Placeholder Container */}
      <div className="min-h-[420px] rounded-2xl border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center text-center p-8 transition-all hover:border-white/25 hover:bg-white/[0.03]">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 mb-4 shadow-inner">
          <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-base font-medium text-white tracking-tight">
          {title} Workspace
        </h3>
        <p className="mt-1 text-xs text-white/40 max-w-md">
          This section is currently being prepared. You can switch between sidebar views to explore the layout and settings.
        </p>

        <div className="mt-6 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-white/60">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Module ready for upcoming features</span>
        </div>
      </div>
    </div>
  );
}
