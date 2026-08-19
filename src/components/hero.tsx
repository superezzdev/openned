"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { useRef } from "react";

const OrbitBackground = () => (
  <div className="absolute top-0 inset-x-0 flex items-center justify-center pointer-events-none overflow-hidden h-[120vh]">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      className="relative w-[800px] h-[800px] md:w-[1200px] md:h-[1200px] opacity-[0.04] md:opacity-[0.06]"
    >
      <div className="absolute inset-0 rounded-full border-[2px] border-white" />
      <div className="absolute inset-[10%] rounded-full border-[1px] border-white/50" />
      <div className="absolute inset-[20%] rounded-full border-[1px] border-white/30" />
      
      {/* Orbit nodes */}
      <div className="absolute top-0 left-1/2 w-4 h-4 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(255,255,255,1)]" />
      <div className="absolute bottom-[10%] left-[10%] w-2 h-2 bg-white rounded-full -translate-x-1/2 translate-y-1/2 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
      <div className="absolute top-[20%] right-[5%] w-3 h-3 bg-white rounded-full translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(255,255,255,0.6)]" />
    </motion.div>
  </div>
);

const MockupCard = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [10, -5]);

  return (
    <div ref={containerRef} className="w-full max-w-4xl mx-auto px-6 pb-32 pt-10 perspective-[2000px] z-20 relative">
      <motion.div 
        style={{ y, rotateX }}
        className="border border-white/10 rounded-[2rem] bg-[#111111]/80 backdrop-blur-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-8 shadow-[0_20px_80px_-20px_rgba(255,255,255,0.05)] relative overflow-hidden"
      >
        {/* Subtle noise inside the card */}
        <div className="absolute inset-0 bg-noise opacity-40 pointer-events-none mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        {/* Match Score Ring */}
        <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" className="stroke-white/10" strokeWidth="6" fill="none" />
            <motion.circle 
              cx="50" cy="50" r="42" 
              className="stroke-accent" 
              strokeWidth="6" 
              fill="none"
              strokeDasharray="264" // 2 * PI * 42 = 263.89
              initial={{ strokeDashoffset: 264 }}
              whileInView={{ strokeDashoffset: 264 - (264 * 0.94) }} // 94%
              transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
              viewport={{ once: true, margin: "-100px" }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
            <span className="text-[28px] font-serif tracking-tighter text-accent leading-none flex items-start">
              94<span className="text-sm text-white/50 font-sans font-medium mt-1">%</span>
            </span>
            <span className="text-[9px] text-white/40 uppercase tracking-[0.25em] mt-1 font-medium">Match</span>
          </div>
        </div>

        {/* Job Listing Details */}
        <div className="flex-grow space-y-5 w-full relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl md:text-2xl font-serif text-white tracking-wide">Senior Frontend Engineer</h3>
              <p className="text-white/40 font-sans text-sm mt-1">Vercel • Remote, US</p>
            </div>
            <div className="w-12 h-12 rounded-full border border-white/10 bg-black/50 flex items-center justify-center flex-shrink-0 shadow-inner">
              <svg viewBox="0 0 116 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-white">
                <path fillRule="evenodd" clipRule="evenodd" d="M57.5 0L115 100H0L57.5 0Z" fill="currentColor"/>
              </svg>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-white/60 font-medium">React</span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-white/60 font-medium">Next.js</span>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-white/60 font-medium">Framer Motion</span>
            <span className="px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-[11px] text-accent font-medium">TypeScript</span>
          </div>
          
          <div className="pt-5 border-t border-white/10 flex justify-between items-center">
            <p className="text-xs text-white/40 font-medium">Applied 2m ago via Openned</p>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              Under Review
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export function Hero() {
  return (
    <section className="relative w-full flex flex-col items-center pt-40 overflow-hidden bg-[#0A0A0A]">
      <OrbitBackground />
      
      {/* Radial gradient mask for blending */}
      <div className="absolute top-0 inset-x-0 h-[120vh] bg-[radial-gradient(ellipse_at_center,transparent_0%,#0A0A0A_70%)] pointer-events-none z-10" />

      <div className="relative z-20 w-full max-w-7xl mx-auto px-6 md:px-12 lg:px-20 flex flex-col items-start justify-center min-h-[90vh] pt-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-10"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
          <span className="text-[11px] font-medium text-white/70 uppercase tracking-widest">Your resume, everywhere at once</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="font-serif text-5xl sm:text-7xl md:text-8xl lg:text-[110px] xl:text-[130px] leading-[0.9] tracking-tight mb-8 max-w-4xl text-left"
        >
          One profile.<br />
          Every job board.<br />
          <span className="text-accent italic">Zero copy-paste.</span>
        </motion.h1>

        <motion.div 
          className="w-full max-w-xl ml-0 lg:ml-12 border-l border-white/20 pl-6 lg:pl-10 mb-16"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-white/50 text-base md:text-lg lg:text-xl font-sans font-light leading-relaxed">
            Openned scrapes hundreds of job portals, matches roles to your skills, and applies for you — or takes you straight to the company&apos;s own careers page.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-6 lg:ml-12"
        >
          <MagneticButton className="px-10 py-5 rounded-full bg-accent text-accent-foreground font-medium text-sm md:text-base flex items-center justify-center gap-2 hover:bg-white transition-colors">
            Build your profile
          </MagneticButton>
          <button className="px-8 py-5 rounded-full border border-white/10 bg-transparent text-white font-medium text-sm md:text-base flex items-center justify-center gap-3 hover:bg-white/5 transition-colors group">
            See how it works
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>

      <MockupCard />
      
      {/* Bottom fade to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#0A0A0A] to-transparent z-30 pointer-events-none" />
    </section>
  );
}
