"use client";

import React, { useState, useMemo } from "react";
import {
  Globe,
  Briefcase,
  SlidersHorizontal,
  DollarSign,
  Clock,
  Layers,
  X,
  RotateCcw,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  POPULAR_COUNTRIES,
  JOB_TYPE_OPTIONS,
  WORKPLACE_OPTIONS,
  EXPERIENCE_OPTIONS,
  SALARY_OPTIONS,
  DATE_POSTED_OPTIONS,
  ActiveJobFilters,
  JobRecord,
} from "@/lib/jobs-constants";

interface JobsFilterBarProps {
  jobs: JobRecord[];
  filters: ActiveJobFilters;
  onFilterChange: <K extends keyof ActiveJobFilters>(key: K, value: ActiveJobFilters[K]) => void;
  onResetFilters: () => void;
  totalFilteredCount: number;
}

export function JobsFilterBar({
  jobs,
  filters,
  onFilterChange,
  onResetFilters,
  totalFilteredCount,
}: JobsFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Compute dynamic counts per country from current jobs
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: jobs.length };
    for (const j of jobs) {
      const c = (j.country || "").toLowerCase();
      const loc = (j.location || "").toLowerCase();

      for (const opt of POPULAR_COUNTRIES) {
        if (opt.code === "all") continue;
        const code = opt.code.toLowerCase();
        const name = opt.name.toLowerCase();

        if (
          code === "remote" &&
          (c.includes("remote") || c.includes("worldwide") || loc.includes("remote"))
        ) {
          counts["remote"] = (counts["remote"] || 0) + 1;
        } else if (
          c.includes(name) ||
          loc.includes(name) ||
          c === code ||
          (code === "us" && (c.includes("united states") || loc.includes("usa") || loc.includes(", us"))) ||
          (code === "gb" && (c.includes("united kingdom") || loc.includes("uk") || loc.includes("london"))) ||
          (code === "in" && (c.includes("india") || loc.includes("india") || loc.includes("bangalore") || loc.includes("bengaluru"))) ||
          (code === "ca" && (c.includes("canada") || loc.includes("toronto") || loc.includes("vancouver"))) ||
          (code === "de" && (c.includes("germany") || loc.includes("berlin") || loc.includes("munich")))
        ) {
          counts[opt.code] = (counts[opt.code] || 0) + 1;
        }
      }
    }
    return counts;
  }, [jobs]);

  // Compute count of active filters (excluding default "all")
  const activeFilterEntries = useMemo(() => {
    const active: Array<{ key: keyof ActiveJobFilters; label: string; valueDisplay: string }> = [];

    if (filters.country && filters.country !== "all") {
      const countryObj = POPULAR_COUNTRIES.find((c) => c.code === filters.country);
      active.push({
        key: "country",
        label: "Country",
        valueDisplay: countryObj ? `${countryObj.flag} ${countryObj.name}` : filters.country,
      });
    }

    if (filters.jobType && filters.jobType !== "all") {
      const jtObj = JOB_TYPE_OPTIONS.find((t) => t.id === filters.jobType);
      active.push({
        key: "jobType",
        label: "Type",
        valueDisplay: jtObj ? jtObj.label : filters.jobType,
      });
    }

    if (filters.workplace && filters.workplace !== "all") {
      const wpObj = WORKPLACE_OPTIONS.find((w) => w.id === filters.workplace);
      active.push({
        key: "workplace",
        label: "Workplace",
        valueDisplay: wpObj ? `${wpObj.icon || ""} ${wpObj.label}` : filters.workplace,
      });
    }

    if (filters.experienceLevel && filters.experienceLevel !== "all") {
      const expObj = EXPERIENCE_OPTIONS.find((e) => e.id === filters.experienceLevel);
      active.push({
        key: "experienceLevel",
        label: "Experience",
        valueDisplay: expObj ? expObj.label : filters.experienceLevel,
      });
    }

    if (filters.salaryMin && filters.salaryMin !== "all") {
      const salObj = SALARY_OPTIONS.find((s) => s.id === filters.salaryMin);
      active.push({
        key: "salaryMin",
        label: "Min Salary",
        valueDisplay: salObj ? salObj.label : filters.salaryMin,
      });
    }

    if (filters.datePosted && filters.datePosted !== "all") {
      const dpObj = DATE_POSTED_OPTIONS.find((d) => d.id === filters.datePosted);
      active.push({
        key: "datePosted",
        label: "Posted",
        valueDisplay: dpObj ? dpObj.label : filters.datePosted,
      });
    }

    return active;
  }, [filters]);

  const totalActiveCount = activeFilterEntries.length;

  return (
    <div className="rounded-3xl border border-white/10 bg-[#0E0E0E]/90 p-4 sm:p-5 backdrop-blur-xl shadow-2xl space-y-4">
      {/* Primary Filters Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. Country Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wider">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Country / Region</span>
          </label>
          <div className="relative">
            <select
              value={filters.country}
              onChange={(e) => onFilterChange("country", e.target.value)}
              className="w-full h-10 appearance-none bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-2xl px-3.5 pr-8 text-xs text-white font-medium focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 transition-all cursor-pointer"
            >
              {POPULAR_COUNTRIES.map((c) => {
                const count = countryCounts[c.code];
                return (
                  <option key={c.code} value={c.code} className="bg-[#141414] text-white">
                    {c.flag} {c.name} {count !== undefined && count > 0 ? `(${count})` : ""}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 2. Job Type Selector */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wider">
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
            <span>Job Type</span>
          </label>
          <div className="relative">
            <select
              value={filters.jobType}
              onChange={(e) => onFilterChange("jobType", e.target.value)}
              className="w-full h-10 appearance-none bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-2xl px-3.5 pr-8 text-xs text-white font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all cursor-pointer"
            >
              {JOB_TYPE_OPTIONS.map((jt) => (
                <option key={jt.id} value={jt.id} className="bg-[#141414] text-white">
                  {jt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* 3. Workplace / Remote Selector */}
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <label className="text-[11px] font-mono font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Workplace Policy</span>
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-white/[0.03] border border-white/10 rounded-2xl h-10 items-center">
            {WORKPLACE_OPTIONS.map((wp) => {
              const isActive = filters.workplace === wp.id;
              return (
                <button
                  key={wp.id}
                  type="button"
                  onClick={() => onFilterChange("workplace", wp.id)}
                  className={cn(
                    "h-full text-[11px] font-semibold rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer truncate px-1",
                    isActive
                      ? "bg-white text-black shadow-md font-bold"
                      : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  {wp.icon && <span className="text-[10px]">{wp.icon}</span>}
                  <span className="truncate">{wp.id === "all" ? "Any" : wp.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Filter Drawer Button & Secondary Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors cursor-pointer group"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
          <span>{showAdvanced ? "Hide Advanced Filters" : "More Filters (Experience, Salary, Freshness)"}</span>
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-white/40 transition-transform duration-200",
              showAdvanced && "rotate-180"
            )}
          />
        </button>

        {/* Live Filter Count & Reset Button */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white/40">
            <span className="text-white font-semibold">{totalFilteredCount}</span> roles matched
          </span>

          {totalActiveCount > 0 && (
            <button
              onClick={onResetFilters}
              type="button"
              className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset all ({totalActiveCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Advanced Filters Section */}
      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* 4. Experience Level */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Experience Level</span>
            </label>
            <div className="relative">
              <select
                value={filters.experienceLevel}
                onChange={(e) => onFilterChange("experienceLevel", e.target.value)}
                className="w-full h-10 appearance-none bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-2xl px-3.5 pr-8 text-xs text-white font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all cursor-pointer"
              >
                {EXPERIENCE_OPTIONS.map((exp) => (
                  <option key={exp.id} value={exp.id} className="bg-[#141414] text-white">
                    {exp.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 5. Salary Minimum */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Minimum Compensation</span>
            </label>
            <div className="relative">
              <select
                value={filters.salaryMin}
                onChange={(e) => onFilterChange("salaryMin", e.target.value)}
                className="w-full h-10 appearance-none bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-2xl px-3.5 pr-8 text-xs text-white font-medium focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all cursor-pointer"
              >
                {SALARY_OPTIONS.map((sal) => (
                  <option key={sal.id} value={sal.id} className="bg-[#141414] text-white">
                    {sal.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 6. Date Posted */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-white/50 flex items-center gap-1.5 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Date Posted</span>
            </label>
            <div className="relative">
              <select
                value={filters.datePosted}
                onChange={(e) => onFilterChange("datePosted", e.target.value)}
                className="w-full h-10 appearance-none bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 rounded-2xl px-3.5 pr-8 text-xs text-white font-medium focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all cursor-pointer"
              >
                {DATE_POSTED_OPTIONS.map((dp) => (
                  <option key={dp.id} value={dp.id} className="bg-[#141414] text-white">
                    {dp.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Removable Badges */}
      {totalActiveCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className="text-[11px] font-mono text-white/40">Active Filters:</span>
          {activeFilterEntries.map((f) => (
            <span
              key={f.key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.07] hover:bg-white/[0.1] border border-white/10 text-xs text-white/90 font-medium transition-all group"
            >
              <span className="text-white/50 text-[10px] uppercase font-mono">{f.label}:</span>
              <span>{f.valueDisplay}</span>
              <button
                type="button"
                onClick={() => onFilterChange(f.key, "all")}
                className="w-4 h-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                title={`Remove ${f.label} filter`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
