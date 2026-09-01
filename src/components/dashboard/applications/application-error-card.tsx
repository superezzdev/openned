"use client";

import React from "react";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { FailureCode, FAILURE_CODE_MESSAGES } from "@/lib/applications/types";
import { Button } from "@/components/ui/button";

interface ApplicationErrorCardProps {
  failureCode?: string | null;
  errorMessage?: string | null;
  applyUrl?: string;
  onRetry?: () => void;
  className?: string;
}

export function ApplicationErrorCard({
  failureCode,
  errorMessage,
  applyUrl,
  onRetry,
  className = "",
}: ApplicationErrorCardProps) {
  const code = failureCode as FailureCode | null;
  const friendlyMessage = code
    ? FAILURE_CODE_MESSAGES[code] || errorMessage || "An unexpected error occurred."
    : errorMessage || "An unexpected error occurred.";

  const canRetry = code !== FailureCode.AUTH_REQUIRED && code !== FailureCode.CAPTCHA_REQUIRED;

  return (
    <div className={`rounded-2xl border border-red-500/25 bg-red-500/8 p-4 space-y-3 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/25 flex items-center justify-center shrink-0 mt-0.5">
          <AlertCircle className="w-4 h-4 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-300">Application Failed</p>
          <p className="text-xs text-red-300/70 mt-0.5 leading-snug">{friendlyMessage}</p>
          {failureCode && (
            <p className="text-[10px] text-red-400/40 mt-1 font-mono">code: {failureCode}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {canRetry && onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            className="flex-1 h-8 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/25 text-xs font-semibold"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Retry
          </Button>
        )}
        {applyUrl && (
          <Button
            size="sm"
            onClick={() => window.open(applyUrl, "_blank", "noopener,noreferrer")}
            className={`${canRetry && onRetry ? "flex-1" : "w-full"} h-8 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 text-xs font-semibold`}
          >
            <ExternalLink className="w-3 h-3 mr-1.5" />
            Apply Manually
          </Button>
        )}
      </div>
    </div>
  );
}
