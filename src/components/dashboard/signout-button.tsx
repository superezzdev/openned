"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Loader2 } from "lucide-react";

export function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.refresh();
      router.push("/signin");
    } catch (error) {
      console.error("Sign out error:", error);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={
        className ||
        "flex items-center gap-2 px-3 py-2 text-xs font-medium text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
      }
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <LogOut className="w-3.5 h-3.5" />
      )}
      <span>Sign out</span>
    </button>
  );
}
