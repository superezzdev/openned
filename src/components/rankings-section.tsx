"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { AnimatedBeam } from "./ui/animated-beam";
import { SiLeetcode, SiGeeksforgeeks, SiHackerrank, SiGithub } from "react-icons/si";
import { ArrowRight } from "lucide-react";

export function RankingsSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const leetcodeRef = useRef<HTMLDivElement>(null);
  const gfgRef = useRef<HTMLDivElement>(null);
  const hackerrankRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLDivElement>(null);

  return (
    <section className="relative min-h-screen w-full bg-[#0A0A0A] text-[#F5F5F5] overflow-hidden py-24 lg:py-32 flex flex-col items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_50%)]" />
      <div className="absolute inset-0 z-0 opacity-5 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      <div className="container relative z-10 px-4 md:px-6 max-w-6xl mx-auto flex flex-col items-center gap-16 lg:gap-24">
        {/* Header Content */}
        <div className="max-w-3xl text-center flex flex-col gap-6 items-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-6xl lg:text-[5rem] leading-[1.1] font-serif tracking-tight"
          >
            Coming next: get ranked for what you build, not just what you write.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg md:text-xl text-neutral-400 max-w-2xl font-light"
          >
            Connect LeetCode, GeeksforGeeks, HackerRank, and GitHub — Openned
            pulls your problem-solving activity and project contributions into a
            live developer score recruiters can see.
          </motion.p>
        </div>

        {/* Visual: Animated Beam Nodes */}
        <div className="relative w-full max-w-lg mx-auto aspect-square flex items-center justify-center" ref={containerRef}>
          {/* Beams */}
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={leetcodeRef}
            toRef={centerRef}
            pathColor="rgba(255,255,255,0.05)"
            gradientStartColor="transparent"
            gradientStopColor="rgba(255,255,255,0.8)"
            duration={3}
            delay={0}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={gfgRef}
            toRef={centerRef}
            pathColor="rgba(255,255,255,0.05)"
            gradientStartColor="transparent"
            gradientStopColor="rgba(34,197,94,0.8)" // GFG green
            duration={4}
            delay={0.5}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={hackerrankRef}
            toRef={centerRef}
            pathColor="rgba(255,255,255,0.05)"
            gradientStartColor="transparent"
            gradientStopColor="rgba(34,197,94,0.8)" // HR green
            duration={3.5}
            delay={1}
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={githubRef}
            toRef={centerRef}
            pathColor="rgba(255,255,255,0.05)"
            gradientStartColor="transparent"
            gradientStopColor="rgba(255,255,255,0.8)"
            duration={4.5}
            delay={1.5}
          />

          {/* Center Logo Mark Node */}
          <div
            ref={centerRef}
            className="absolute z-20 flex h-24 w-24 items-center justify-center rounded-3xl bg-[#0A0A0A] border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
          >
            <div className="relative flex h-10 w-10 items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-white/90" />
              <div className="absolute inset-1 rounded-full border border-white/40" />
            </div>
          </div>

          {/* Orbiting Nodes */}
          {/* Top Left - LeetCode */}
          <div
            ref={leetcodeRef}
            className="absolute top-8 left-8 z-20 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1A1A] border border-white/5 shadow-xl"
          >
            <SiLeetcode className="text-2xl text-yellow-500" />
          </div>

          {/* Top Right - GitHub */}
          <div
            ref={githubRef}
            className="absolute top-8 right-8 z-20 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1A1A] border border-white/5 shadow-xl"
          >
            <SiGithub className="text-2xl text-white" />
          </div>

          {/* Bottom Left - HackerRank */}
          <div
            ref={hackerrankRef}
            className="absolute bottom-8 left-8 z-20 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1A1A] border border-white/5 shadow-xl"
          >
            <SiHackerrank className="text-2xl text-green-500" />
          </div>

          {/* Bottom Right - GFG */}
          <div
            ref={gfgRef}
            className="absolute bottom-8 right-8 z-20 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1A1A1A] border border-white/5 shadow-xl"
          >
            <SiGeeksforgeeks className="text-2xl text-green-600" />
          </div>

          {/* Orbit Rings Decoration */}
          <div className="absolute inset-4 rounded-full border border-white/5 animate-[spin_60s_linear_infinite]" />
          <div className="absolute inset-12 rounded-full border border-white/5 border-dashed animate-[spin_40s_linear_infinite_reverse]" />
        </div>

        {/* CTA: Email Capture */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-4 w-full max-w-md"
        >
          <form className="relative flex w-full items-center">
            <input
              type="email"
              placeholder="Get notified when rankings launch"
              className="w-full rounded-full bg-white/5 border border-white/10 px-6 py-4 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
              required
            />
            <button
              type="submit"
              className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          <p className="text-xs text-neutral-500 font-medium tracking-wide uppercase">
            No spam. Unsubscribe anytime.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
