"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  Activity,
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  Building2,
  Clock,
  Sparkles,
  Layers,
  Database,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface JobSourceItem {
  id: string;
  source: string;
  source_name: string;
  source_identifier: string;
  company_name: string;
  company_logo?: string | null;
  source_url: string;
  enabled: boolean;
  active_jobs_count: number;
  last_synced_at?: string | null;
  last_success_at?: string | null;
  last_error_at?: string | null;
  last_error_message?: string | null;
  consecutive_failures: number;
}

interface Metrics {
  totalCanonicalJobs: number;
  activeCanonicalJobs: number;
  totalSources: number;
  enabledSources: number;
  platformBreakdown: Record<string, number>;
}

export default function AdminJobSourcesPage() {
  const [sources, setSources] = useState<JobSourceItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");

  // Add source form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchStatusAndSources = async () => {
    try {
      setLoading(true);
      const [sourcesRes, statusRes] = await Promise.all([
        fetch("/api/admin/job-sources"),
        fetch("/api/admin/job-sources/status"),
      ]);

      if (sourcesRes.ok) {
        const data = await sourcesRes.json();
        setSources(data.sources || []);
      }

      if (statusRes.ok) {
        const data = await statusRes.json();
        setMetrics(data.metrics || null);
        setRecentLogs(data.recentLogs || []);
      }
    } catch (err) {
      console.error("Error fetching admin sources data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndSources();
  }, []);

  const handleTriggerSync = async (dryRun = false, singleSourceId?: string) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      let bodyPayload: any = { dryRun };
      if (singleSourceId) {
        const sourceObj = sources.find((s) => s.id === singleSourceId);
        if (sourceObj) {
          bodyPayload.source = sourceObj.source;
          bodyPayload.company = sourceObj.source_identifier;
        }
      }

      const res = await fetch("/api/admin/job-sources/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (data.success) {
        setSyncResult(data.summary);
        await fetchStatusAndSources();
      } else {
        alert(`Sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Sync request failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleSource = async (id: string, currentEnabled: boolean) => {
    try {
      const nextEnabled = !currentEnabled;
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: nextEnabled } : s))
      );

      const res = await fetch("/api/admin/job-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: nextEnabled }),
      });

      if (!res.ok) {
        throw new Error("Failed to update source status");
      }
    } catch (err) {
      console.error(err);
      await fetchStatusAndSources();
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    setIsAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/admin/job-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          company_name: newCompanyName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add source");
      }

      setShowAddModal(false);
      setNewUrl("");
      setNewCompanyName("");
      await fetchStatusAndSources();
    } catch (err: any) {
      setAddError(err?.message || "Failed to add source");
    } finally {
      setIsAdding(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    const matchesSearch =
      s.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.source_identifier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform =
      selectedPlatform === "all" || s.source.toLowerCase() === selectedPlatform.toLowerCase();
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 p-6 md:p-10 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Job Ingestion Control Center
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ingestion Engine Online
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Source-adapter ingestion system collecting live normalized jobs across Greenhouse, Lever, Ashby, and Workable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => handleTriggerSync(true)}
            disabled={syncing}
            className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-medium"
          >
            <Play className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
            Dry Run
          </Button>

          <Button
            onClick={() => handleTriggerSync(false)}
            disabled={syncing}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-lg shadow-emerald-950/40"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing Providers..." : "Sync All Sources"}
          </Button>

          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Job Source
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-8 space-y-8">
        {/* Sync Result Banner */}
        {syncResult && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-4 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-emerald-300">
                {syncResult.dryRun ? "Dry Run Completed (No Database Mutations)" : "Synchronization Succeeded"}
              </h4>
              <p className="text-xs text-emerald-200/80">
                Processed <strong>{syncResult.sourcesProcessed}</strong> sources ({syncResult.succeeded} succeeded, {syncResult.failed} failed).
                Fetched <strong>{syncResult.jobsFetched}</strong> jobs: <strong>+{syncResult.jobsCreated}</strong> created, <strong>{syncResult.jobsUpdated}</strong> updated, <strong>{syncResult.jobsUnchanged}</strong> unchanged, <strong>{syncResult.jobsDeactivated}</strong> deactivated.
              </p>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>Active Canonical Jobs</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {metrics?.activeCanonicalJobs ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {metrics?.totalCanonicalJobs ?? 0} total indexed jobs
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>Connected Sources</span>
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {metrics?.enabledSources ?? 0} <span className="text-lg text-slate-500 font-normal">/ {metrics?.totalSources ?? 0}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Enabled ATS boards
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>Greenhouse & Lever</span>
              <Layers className="w-4 h-4 text-teal-400" />
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {(metrics?.platformBreakdown?.greenhouse || 0) + (metrics?.platformBreakdown?.lever || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {metrics?.platformBreakdown?.greenhouse || 0} Greenhouse • {metrics?.platformBreakdown?.lever || 0} Lever
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-3">
              <span>Ashby & Workable</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-white tracking-tight">
              {(metrics?.platformBreakdown?.ashby || 0) + (metrics?.platformBreakdown?.workable || 0)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {metrics?.platformBreakdown?.ashby || 0} Ashby • {metrics?.platformBreakdown?.workable || 0} Workable
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {["all", "greenhouse", "lever", "ashby", "workable"].map((plat) => (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  selectedPlatform === plat
                    ? "bg-indigo-600 text-white shadow"
                    : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {plat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search companies or slugs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Sources Management Table */}
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Company & Provider</th>
                  <th className="py-3.5 px-4">Identifier / Slug</th>
                  <th className="py-3.5 px-4">Active Jobs</th>
                  <th className="py-3.5 px-4">Last Synced</th>
                  <th className="py-3.5 px-4">Health Status</th>
                  <th className="py-3.5 px-4 text-center">Enabled</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredSources.map((source) => {
                  const isHealthy = (source.consecutive_failures || 0) === 0;
                  return (
                    <tr key={source.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-700/60 shrink-0">
                            {source.company_logo ? (
                              <Image
                                src={source.company_logo}
                                alt={source.company_name}
                                width={28}
                                height={28}
                                className="object-contain"
                              />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              {source.company_name}
                              <a
                                href={source.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-slate-300"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 capitalize">
                              {source.source}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {source.source_identifier}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-emerald-400">
                        {source.active_jobs_count}
                      </td>

                      <td className="py-3.5 px-4 text-slate-400">
                        {source.last_synced_at
                          ? new Date(source.last_synced_at).toLocaleString()
                          : "Never"}
                      </td>

                      <td className="py-3.5 px-4">
                        {isHealthy ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Healthy
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-medium" title={source.last_error_message || ""}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {source.consecutive_failures} fails
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleSource(source.id, source.enabled)}
                          className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                            source.enabled ? "bg-emerald-600" : "bg-slate-700"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              source.enabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTriggerSync(false, source.id)}
                          disabled={syncing}
                          className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Sync
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {filteredSources.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No job sources found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sync Audit History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              Recent Sync Audit Logs
            </h3>
          </div>

          <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden">
            <div className="divide-y divide-slate-800/40 text-xs">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/20">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === "success"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : log.status === "partial"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="font-semibold text-slate-300 capitalize">{log.source}</span>
                    <span className="text-slate-500">
                      +{log.jobs_created} created, {log.jobs_updated} updated, {log.jobs_unchanged} unchanged
                    </span>
                    {log.error_message && (
                      <span className="text-red-400 truncate max-w-xs" title={log.error_message}>
                        ({log.error_message})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                    <span>{log.duration_ms}ms</span>
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}

              {recentLogs.length === 0 && (
                <div className="p-6 text-center text-slate-500">
                  No synchronization logs recorded yet. Trigger a sync to view execution stats.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Job Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add New Job Source</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Paste any career URL or job board link (Greenhouse, Lever, Ashby, Workable, or career site). The system will automatically detect the ATS provider and slug.
            </p>

            <form onSubmit={handleAddSource} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Career or Board URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://boards.greenhouse.io/stripe"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Company Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-detect"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {addError && (
                <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                  {addError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  {isAdding ? "Detecting & Adding..." : "Save Source"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
