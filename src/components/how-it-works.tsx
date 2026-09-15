"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  Radar, 
  MousePointerClick, 
  Kanban, 
  Check, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Briefcase
} from "lucide-react";
import Link from "next/link";

const steps = [
  {
    num: "01",
    id: "profile",
    title: "Build Your Master Profile",
    tagline: "Upload once. Ready for every ATS.",
    description:
      "Upload your existing PDF resume or input your experience once. Openned extracts your skills, achievements, and tech stack into a structured, ATS-compliant master profile that powers every application.",
    icon: Upload,
    metric: "60-second setup",
    previewType: "profile",
  },
  {
    num: "02",
    id: "scan",
    title: "AI Scans 500+ Direct Portals",
    tagline: "Direct ATS postings, zero ghost jobs.",
    description:
      "We continuously index live openings straight from company careers portals (Greenhouse, Lever, Ashby, Workday). Our Smart Match algorithm scores each role against your master profile with full keyword transparency.",
    icon: Radar,
    metric: "10,000+ roles indexed weekly",
    previewType: "matching",
  },
  {
    num: "03",
    id: "apply",
    title: "1-Click Apply or Jump to Portal",
    tagline: "Zero copy-paste. Complete control.",
    description:
      "Apply with one click using tailored responses, or jump straight to the company's verified application page with your details prepped. You decide whether to run on autopilot or review each role.",
    icon: MousePointerClick,
    metric: "30s per application",
    previewType: "apply",
  },
  {
    num: "04",
    id: "track",
    title: "Live Kanban Status Tracking",
    tagline: "Never lose track of an interview.",
    description:
      "Every application is automatically synced into your unified Kanban dashboard. Monitor real-time statuses from Applied and Under Review to Screening, Technical Rounds, and Offers in one place.",
    icon: Kanban,
    metric: "100% pipeline visibility",
    previewType: "tracker",
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how-it-works" className="relative w-full py-24 md:py-36 overflow-hidden bg-[#0A0A0A]">
      {/* Background radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center max-w-3xl mx-auto mb-16 md:mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
              Step-by-step clarity
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[72px] leading-[1.08] tracking-tight text-white mb-6">
            How Openned works, <br className="hidden sm:inline" />
            <span className="text-white/40 italic">from zero to offer.</span>
          </h2>

          <p className="text-white/60 text-base md:text-lg font-sans font-light leading-relaxed max-w-2xl mx-auto">
            A frictionless, 4-step workflow engineered to eliminate manual form filling and connect you directly with hiring teams.
          </p>
        </motion.div>

        {/* Step Selector & Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Interactive Step Cards */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            {steps.map((step, idx) => {
              const isActive = activeStep === idx;
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  onClick={() => setActiveStep(idx)}
                  className={`cursor-pointer rounded-2xl p-6 transition-all duration-300 border relative overflow-hidden ${
                    isActive
                      ? "bg-white/[0.06] border-white/30 shadow-[0_10px_30px_rgba(255,255,255,0.04)]"
                      : "bg-[#0F0F0F]/60 border-white/5 hover:border-white/15 hover:bg-[#0F0F0F]"
                  }`}
                >
                  {/* Left accent bar on active */}
                  {isActive && (
                    <motion.div
                      layoutId="activeStepIndicator"
                      className="absolute left-0 top-0 bottom-0 w-1 bg-white"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}

                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? "bg-white text-black font-semibold shadow-md"
                          : "bg-white/5 text-white/50 border border-white/10"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-white/40 tracking-wider">
                            STEP {step.num}
                          </span>
                          <span className="text-xs text-white/20">/</span>
                          <span className="text-xs font-mono text-emerald-400">
                            {step.metric}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-lg md:text-xl font-medium text-white tracking-tight mb-1">
                        {step.title}
                      </h3>

                      <p className="text-xs font-medium text-white/40 mb-2">
                        {step.tagline}
                      </p>

                      <p
                        className={`text-sm leading-relaxed transition-colors ${
                          isActive ? "text-white/70" : "text-white/40"
                        }`}
                      >
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right Column: Live Visual Step Demonstration */}
          <div className="lg:col-span-6">
            <div className="relative rounded-3xl border border-white/10 bg-[#0E0E0E] p-6 sm:p-8 min-h-[460px] flex flex-col justify-between shadow-2xl overflow-hidden">
              {/* Subtle top glare */}
              <div className="absolute -top-24 -right-24 w-60 h-60 bg-white/[0.04] rounded-full blur-2xl pointer-events-none" />

              {/* Step indicator header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                    Interactive Walkthrough
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-xs text-white/40">
                  <span className="text-white font-bold">{activeStep + 1}</span> of 4
                </div>
              </div>

              {/* Dynamic Preview Content based on activeStep */}
              <div className="flex-1 flex items-center justify-center relative z-10">
                <AnimatePresence mode="wait">
                  {activeStep === 0 && (
                    <motion.div
                      key="step-0"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full space-y-4"
                    >
                      <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white">
                              <FileCheck className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">Alex_Chen_Resume.pdf</div>
                              <div className="text-xs text-white/40">Parsed in 1.2s • ATS Ready</div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-400 text-xs font-mono border border-emerald-400/20">
                            98/100 Score
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Extracted Tech Stack</div>
                          <div className="flex flex-wrap gap-1.5">
                            {["TypeScript", "React", "Next.js", "Node.js", "TailwindCSS", "PostgreSQL", "System Design", "GraphQL"].map((skill) => (
                              <span key={skill} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/80 font-mono">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3 flex items-center justify-between text-xs text-white/60">
                          <span>✓ Work history standardized</span>
                          <span>✓ Contact fields verified</span>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 1 && (
                    <motion.div
                      key="step-1"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full space-y-3"
                    >
                      {[
                        { company: "Vercel", role: "Senior Frontend Engineer", match: 94, portal: "Lever", badge: "Remote" },
                        { company: "Supabase", role: "Full Stack Engineer", match: 91, portal: "Greenhouse", badge: "Remote, US" },
                        { company: "Linear", role: "Product Engineer", match: 88, portal: "Ashby", badge: "Hybrid" },
                      ].map((job, i) => (
                        <div key={i} className="rounded-xl border border-white/10 bg-[#141414] p-4 flex items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-white/40">{job.company}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/5 border border-white/10 text-white/50">
                                {job.portal}
                              </span>
                            </div>
                            <div className="text-sm font-medium text-white">{job.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-serif font-bold text-white flex items-center gap-1 justify-end">
                              {job.match}%
                              <span className="text-[10px] font-sans font-normal text-emerald-400">match</span>
                            </div>
                            <span className="text-[10px] text-white/40">{job.badge}</span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {activeStep === 2 && (
                    <motion.div
                      key="step-2"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full space-y-4"
                    >
                      <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 space-y-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-serif text-white">Vercel — Staff Frontend</h4>
                            <p className="text-xs text-white/40">Verified direct Greenhouse ATS listing</p>
                          </div>
                          <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-emerald-400">
                            <Check className="w-5 h-5" />
                          </div>
                        </div>

                        <div className="rounded-xl bg-white/[0.03] border border-white/5 p-3.5 space-y-2">
                          <div className="flex justify-between text-xs text-white/70">
                            <span>Form Auto-Fill:</span>
                            <span className="text-emerald-400 font-mono">100% Pre-Populated</span>
                          </div>
                          <div className="flex justify-between text-xs text-white/70">
                            <span>Custom Questions:</span>
                            <span className="text-white font-mono">AI Drafted from Master Profile</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button className="flex-1 py-3 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors flex items-center justify-center gap-1.5">
                            <Check className="w-3.5 h-3.5" />
                            1-Click Apply Now
                          </button>
                          <button className="py-3 px-4 rounded-xl border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-colors">
                            Official Portal ↗
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeStep === 3 && (
                    <motion.div
                      key="step-3"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3 }}
                      className="w-full"
                    >
                      <div className="grid grid-cols-3 gap-2.5">
                        {/* Applied Column */}
                        <div className="rounded-xl bg-[#141414] border border-white/5 p-3 space-y-2">
                          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider flex justify-between">
                            <span>Applied</span>
                            <span>14</span>
                          </div>
                          <div className="p-2 rounded bg-white/5 border border-white/5 text-[11px] text-white/80">
                            Stripe • Backend
                          </div>
                          <div className="p-2 rounded bg-white/5 border border-white/5 text-[11px] text-white/80">
                            Linear • Frontend
                          </div>
                        </div>

                        {/* Interview Column */}
                        <div className="rounded-xl bg-[#141414] border border-white/20 p-3 space-y-2 shadow-lg">
                          <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider flex justify-between">
                            <span>Interview</span>
                            <span>3</span>
                          </div>
                          <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 font-medium">
                            Vercel • Round 2
                          </div>
                          <div className="p-2 rounded bg-white/5 border border-white/5 text-[11px] text-white/80">
                            Supabase • Prep
                          </div>
                        </div>

                        {/* Offer Column */}
                        <div className="rounded-xl bg-[#141414] border border-white/5 p-3 space-y-2">
                          <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider flex justify-between">
                            <span>Offer</span>
                            <span>1</span>
                          </div>
                          <div className="p-2 rounded bg-white/10 border border-white/20 text-[11px] text-white font-medium">
                            Acme Corp 🎉
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Bottom Quick Action */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
                <div className="text-xs text-white/50">
                  Ready to test drive? Setup takes 2 minutes.
                </div>
                <Link
                  href="/signup"
                  className="text-xs text-white font-medium hover:text-white/80 transition-colors flex items-center gap-1 group"
                >
                  Create Master Profile
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
