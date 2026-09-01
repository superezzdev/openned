"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignOutButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  compact?: boolean;
}

export const SignOutButton = React.forwardRef<
  HTMLButtonElement,
  SignOutButtonProps
>(({ className, compact = false, ...props }, ref) => {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    props.onClick?.(e);
    if (e.defaultPrevented) return;

    setLoading(true);
    try {
      await supabase.auth.signOut();
      // Navigate to the landing page and trigger a full reset of client state and cookies
      window.location.replace("/");
    } catch (error) {
      console.error("Sign out error:", error);
      window.location.replace("/");
    }
  };

  return (
    <button
      ref={ref}
      {...props}
      onClick={handleSignOut}
      disabled={loading || props.disabled}
      title={props.title || "Sign out"}
      aria-label="Sign out"
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-xs font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer disabled:opacity-50",
        compact && "px-0 py-0 justify-center",
        className
      )}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        <LogOut className="w-4 h-4 shrink-0" />
      )}
      {!compact && <span>Sign out</span>}
    </button>
  );
});

SignOutButton.displayName = "SignOutButton";
