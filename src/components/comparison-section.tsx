"use client";

import { motion } from "framer-motion";
import { XCircle, CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

const painPoints = [
  {
    title: "45 minutes per application",
    description: "Endlessly re-typing the exact same contact, education, and past work details into Workday and Taleo forms.",
  },
  {
    title: "Ghost jobs & stale aggregators",
    description: "Applying to 3-week-old reposts and sponsored listings on crowded job boards where your resume is never seen.",
  },
  {
    title: "ATS black hole rejection",
    description: "Getting auto-rejected by keyword bots within seconds with zero feedback or explanation of what went wrong.",
  },
  {
    title: "Chaotic spreadsheet tracking",
    description: "Scrambling across 50 browser tabs, lost recruiter emails, and broken manual spreadsheets to remember where you applied.",
  },
];

const opennedPerks = [
  {
    title: "30 seconds with 1-Click Apply",
    description: "Build your ATS-optimized Master Profile once. Apply across hundreds of roles with one click or auto-pilot queue.",
    highlight: "90% time saved",
  },
  {
    title: "100% Direct Employer ATS Portals",
    description: "Indexes verified live roles straight from Greenhouse, Lever, Ashby, and Workday — zero ghost jobs, zero middlemen.",
    highlight: "Direct to hiring teams",
  },
  {
    title: "Transparent AI Match Breakdown",
    description: "See your exact skill fit score (e.g. 94%), matching technologies, and missing keywords before you even submit.",
    highlight: "Higher callback rate",
  },
  {
    title: "Real-time Live Kanban Pipeline",
    description: "Every submission automatically tracks across Applied, Under Review, Interview, and Offer in your private dashboard.",
    highlight: "Zero lost follow-ups",
  },
];

export function ComparisonSection() {
  return (
    <section id="why-openned" className="relative w-full py-24 md:py-36 bg-[#0A0A0A] overflow-hidden">
      {/* Background glow and grid accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-noise opacity-30 pointer-events-none" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-16 md:mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
              The Reality Check
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[68px] leading-[1.08] tracking-tight text-white mb-6">
            Job hunting feels broken. <br className="hidden sm:inline" />
            <span className="text-white/40 italic">Here is how Openned fixes it.</span>
          </h2>

          <p className="text-white/60 text-base md:text-lg font-sans font-light leading-relaxed max-w-2xl mx-auto">
            You shouldn&apos;t need to spend 20 hours a week doing repetitive data entry just to get an interview. 
            See how your job search transforms when technology works for you.
          </p>
        </motion.div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: The Old Way (Frustrating) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-red-500/10 bg-[#0E0E0E]/80 backdrop-blur-md p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500/40 via-red-500/10 to-transparent" />
            
            <div>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-semibold block mb-1">
                    Without Openned
                  </span>
                  <h3 className="text-2xl font-serif text-white tracking-tight">The Exhausting Way</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <XCircle className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-6">
                {painPoints.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4 group">
                    <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5 text-red-400">
                      <span className="text-xs font-mono font-bold">{idx + 1}</span>
                    </div>
                    <div>
                      <h4 className="text-white/90 text-base font-medium tracking-tight mb-1">
                        {item.title}
                      </h4>
                      <p className="text-white/40 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-white/40 font-mono">
              <span>Result: Burnout & Low Response</span>
              <span className="text-red-400 font-semibold">~15 hrs wasted / week</span>
            </div>
          </motion.div>

          {/* Card 2: The Openned Way (Fast, Smart, Direct) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl border border-white/20 bg-gradient-to-b from-[#141414] to-[#0D0D0D] backdrop-blur-md p-8 sm:p-10 flex flex-col justify-between relative shadow-[0_20px_80px_-20px_rgba(255,255,255,0.06)] overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/60 via-white/20 to-transparent" />
            {/* Soft corner highlight */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.03] rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/10">
                <div>
                  <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold block mb-1">
                    With Openned
                  </span>
                  <h3 className="text-2xl font-serif text-white tracking-tight">The Modern Advantage</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-6">
                {opennedPerks.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-white text-base font-medium tracking-tight">
                          {item.title}
                        </h4>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {item.highlight}
                        </span>
                      </div>
                      <p className="text-white/60 text-sm leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-white/50 font-mono">
                Average outcome: <span className="text-emerald-400 font-semibold">3.4x more interview invites</span>
              </div>

              <Link
                href="/signup"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-medium text-xs md:text-sm hover:bg-neutral-200 transition-colors group"
              >
                Start Applying Free
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
