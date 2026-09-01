"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Cpu,
  Globe,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { AutomationMetrics } from "@/lib/automation/types";
import { Button } from "@/components/ui/button";

export default function AdminAutomationPage() {
  const [metrics, setMetrics] = useState<AutomationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/automation-metrics");
      if (!res.ok) {
        throw new Error("Failed to load automation metrics");
      }
      const data = await res.json();
      setMetrics(data.metrics);
    } catch (err: any) {
      setError(err?.message || "Error fetching metrics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white/50 text-xs font-mono mb-1 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            Observability & Analytics
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Automation Engine Telemetry</h1>
          <p className="text-sm text-white/50 mt-1">
            Real-time performance, fallback diagnostics, and provider reliability metrics.
          </p>
        </div>

        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="h-8 border-white/10 bg-white/5 hover:bg-white/10 text-white/80 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-white/20" />
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Applications */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-white/40 text-xs font-medium">
                <span>Total Applications</span>
                <TrendingUp className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {metrics.totalApplications}
              </div>
              <p className="text-[11px] text-white/40 mt-1">Recorded in system</p>
            </div>

            {/* Local Success Rate */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-white/40 text-xs font-medium">
                <span>Local Success Rate</span>
                <Cpu className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {metrics.localSuccessRate}%
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                {metrics.localSuccesses} ok / {metrics.localFailures} failed
              </p>
            </div>

            {/* Fallback Rate */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-white/40 text-xs font-medium">
                <span>Fallback Rate</span>
                <Zap className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {metrics.fallbackRate}%
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                {metrics.browserbaseFallbacks} routed to Browserbase
              </p>
            </div>

            {/* Browserbase Success Rate */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between text-white/40 text-xs font-medium">
                <span>Browserbase Success Rate</span>
                <Globe className="w-4 h-4 text-violet-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2 font-mono">
                {metrics.browserbaseSuccessRate}%
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                {metrics.browserbaseSuccesses} ok / {metrics.browserbaseFailures} failed
              </p>
            </div>
          </div>

          {/* Secondary Diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Submission Success */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Submission Success Rate
              </div>
              <div className="text-3xl font-bold text-emerald-400 font-mono">
                {metrics.submissionSuccessRate}%
              </div>
              <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                Percentage of queued applications that reach SUBMITTED with employer confirmation.
              </p>
            </div>

            {/* Captcha Encounter Rate */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                CAPTCHA Rate
              </div>
              <div className="text-3xl font-bold text-amber-400 font-mono">
                {metrics.captchaRate}%
              </div>
              <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                Portals triggering active challenge puzzles requiring human verification.
              </p>
            </div>

            {/* Profile Missing Rate */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.01] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
                Missing Profile Rate
              </div>
              <div className="text-3xl font-bold text-sky-400 font-mono">
                {metrics.profileMissingRate}%
              </div>
              <p className="text-[11px] text-white/40 mt-2 leading-relaxed">
                Applications paused because required job fields were not found in user profile.
              </p>
            </div>
          </div>

          {/* Timing & Performance */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-400" />
              Average Execution Duration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                <span className="text-xs text-white/50">Local Browser Automation</span>
                <div className="text-xl font-bold text-white font-mono mt-1">
                  {metrics.averageLocalDurationMs > 0
                    ? `${(metrics.averageLocalDurationMs / 1000).toFixed(1)}s`
                    : "N/A"}
                </div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.01] p-4">
                <span className="text-xs text-white/50">Browserbase Cloud Automation</span>
                <div className="text-xl font-bold text-white font-mono mt-1">
                  {metrics.averageBrowserbaseDurationMs > 0
                    ? `${(metrics.averageBrowserbaseDurationMs / 1000).toFixed(1)}s`
                    : "N/A"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
