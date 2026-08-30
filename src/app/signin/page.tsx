"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    errorParam ? "Authentication error. Please try again." : null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        setSuccessMessage("Signed in successfully! Redirecting...");
        router.refresh();
        setTimeout(() => {
          router.push(redirectPath);
        }, 500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(message);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);

    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?redirect=${encodeURIComponent(
            redirectPath
          )}`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to initiate Google sign-in.";
      setErrorMessage(message);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#f5f5f5] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-white/20 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-white/[0.07] via-blue-500/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-purple-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      {/* Header / Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col items-center"
      >
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105">
            <Image src="/logo.svg" alt="Openned Logo" fill className="object-contain" />
          </div>
          <span className="font-sans font-medium text-2xl tracking-tight text-[#f5f5f5]">
            Openned
          </span>
        </Link>
        <p className="mt-2 text-sm text-white/50 text-center">
          Welcome back. Sign in to your workspace.
        </p>
      </motion.div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-[#121212]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl shadow-black/80 relative z-10"
      >
        {/* Alerts */}
        <AnimatePresence mode="wait">
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3.5 bg-red-500/10 border border-red-500/25 rounded-xl flex items-center gap-3 text-red-300 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-3 text-emerald-300 text-sm"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          type="button"
          className="w-full h-11 px-4 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 hover:border-white/20 text-[#f5f5f5] font-medium text-sm rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white/70" />
          ) : (
            <FcGoogle className="w-5 h-5 group-hover:scale-110 transition-transform" />
          )}
          <span>Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#121212] px-3 text-xs uppercase tracking-wider text-white/40 font-mono">
            or with email
          </span>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">
              Email address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full h-11 pl-10 pr-4 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-sm text-[#f5f5f5] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-white/70">
                Password
              </label>
              <Link
                href="#"
                className="text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-10 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-xl text-sm text-[#f5f5f5] placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full h-11 mt-2 bg-[#f5f5f5] hover:bg-white text-[#0a0a0a] font-medium text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-white/10 hover:shadow-white/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a]" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-xs text-white/50">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup${
              redirectPath !== "/dashboard"
                ? `?redirect=${encodeURIComponent(redirectPath)}`
                : ""
            }`}
            className="text-[#f5f5f5] hover:underline font-medium ml-1 inline-flex items-center gap-1"
          >
            Sign up
            <Sparkles className="w-3 h-3 text-white/70" />
          </Link>
        </p>
      </motion.div>

      {/* Bottom status badge */}
      <div className="mt-8 flex items-center gap-2 text-xs text-white/40">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Protected with Supabase Auth & Row Level Security</span>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white/50">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

