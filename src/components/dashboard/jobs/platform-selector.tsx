"use client";

import React from "react";
import Image from "next/image";
import { Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUPPORTED_PLATFORMS } from "@/lib/jobs-constants";


export interface PlatformItem {
  id: string;
  name: string;
  domain: string;
  count: number;
  badgeClass: string;
  activeColor: string;
  activeBorder: string;
  activeBg: string;
  logoSrc?: string;
}

interface PlatformSelectorProps {
  selectedPlatform: string;
  onSelectPlatform: (platformId: string) => void;
  counts: Record<string, number>;
}

export function PlatformSelector({
  selectedPlatform,
  onSelectPlatform,
  counts,
}: PlatformSelectorProps) {
  const allPlatforms: PlatformItem[] = [
    {
      id: "all",
      name: "All Platforms",
      domain: "Cross-platform unified feed",
      count: counts.all || 0,
      badgeClass: "bg-white/10 text-white border-white/20",
      activeColor: "text-white",
      activeBorder: "border-white/50 shadow-white/5",
      activeBg: "bg-white/[0.08]",
    },
    ...SUPPORTED_PLATFORMS.map((p) => ({
      id: p.id,
      name: p.name,
      domain: p.domain,
      count: counts[p.id] || counts[p.id.replace("-", "_")] || 0,
      badgeClass: p.badgeClass,
      activeColor: p.badgeClass.split(" ")[1] || "text-white",
      activeBorder: `${p.badgeClass.split(" ")[2]} shadow-lg`,
      activeBg: `${p.badgeClass.split(" ")[0]} backdrop-blur-md`,
      logoSrc: p.logoSrc,
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono uppercase tracking-wider text-white/50 flex items-center gap-2">
          <span>Target Job Platforms ({allPlatforms.length - 1})</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
        </h2>
        <span className="text-xs text-white/40">Select platform to filter & search</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-3">
        {allPlatforms.map((p) => {
          const isSelected = selectedPlatform === p.id;


          return (
            <button
              key={p.id}
              onClick={() => onSelectPlatform(p.id)}
              className={cn(
                "group relative text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-md shadow-lg",
                isSelected
                  ? cn(p.activeBg, p.activeBorder, "ring-1 ring-white/20")
                  : "bg-white/[0.03] border-white/10 hover:border-white/25 hover:bg-white/[0.05]"
              )}
            >
              {/* Active Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center shadow-md">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                {/* Platform Logo or All Icon */}
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center p-1.5 transition-transform group-hover:scale-105 overflow-hidden",
                    isSelected
                      ? "bg-white/10 shadow-inner border border-white/15"
                      : "bg-white/[0.04] border border-white/5"
                  )}
                >
                  {p.logoSrc ? (
                    <Image
                      src={p.logoSrc}
                      alt={p.name}
                      width={28}
                      height={28}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Layers className="w-5 h-5 text-white" />
                  )}
                </div>

                {!isSelected && (
                  <span
                    className={cn(
                      "text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border",
                      p.badgeClass
                    )}
                  >
                    {p.count}
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-1">
                  <h3
                    className={cn(
                      "font-semibold text-sm tracking-tight truncate",
                      isSelected ? "text-white" : "text-white/80 group-hover:text-white"
                    )}
                  >
                    {p.name}
                  </h3>
                  {isSelected && (
                    <span className="text-[11px] font-mono font-bold text-white shrink-0">
                      {p.count}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-white/40 truncate font-mono">
                  {p.domain}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
