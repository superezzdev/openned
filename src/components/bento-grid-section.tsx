"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Check, Terminal } from "lucide-react";

// Generic Card wrapper with cursor-aware hover lighting
function BentoCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`relative h-full flex flex-col overflow-hidden p-6 md:p-8 bg-[#0C0C0C] border border-white/5 rounded-3xl group ${className}`}
    >
      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
      
      {/* Cursor-aware gradient highlight */}
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100 z-0"
        animate={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.06), transparent 40%)`,
        }}
      />
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

function MasterProfileCard() {
  return (
    <BentoCard>
      <div className="mb-8 md:mb-12">
        <h3 className="text-2xl font-medium text-white mb-2 tracking-tight">Master Profile</h3>
        <p className="text-white/50 text-sm max-w-sm leading-relaxed">
          Build your identity once. We use it to match you against thousands of roles, parsing skills and projects automatically.
        </p>
      </div>
      
      {/* UI Mockup */}
      <div className="relative w-full flex-1 min-h-[240px] md:min-h-[300px] mt-auto">
        <div className="absolute bottom-0 left-0 right-0 h-[120%] bg-[#121212] rounded-t-xl border border-white/10 border-b-0 overflow-hidden shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-4">
          
          {/* Mockup Header */}
          <div className="flex items-center space-x-2 p-4 border-b border-white/5 bg-[#171717]">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          </div>
          
          <div className="p-5 md:p-6 flex flex-col gap-5">
            {/* Profile Header Mock */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-white/20 to-transparent border border-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-white/20 rounded" />
                <div className="h-2 w-1/4 bg-white/10 rounded" />
              </div>
            </div>
            
            {/* Skills Mock */}
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Skills</div>
              <div className="flex flex-wrap gap-2">
                {['React', 'Next.js', 'TypeScript', 'Node.js', 'System Design', 'PostgreSQL'].map((skill) => (
                  <div key={skill} className="px-2.5 py-1 text-[10px] font-mono text-white/70 bg-white/5 rounded-md border border-white/5">
                    {skill}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Projects Mock */}
            <div className="space-y-3">
              <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Top Projects</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 bg-white/5 rounded-lg border border-white/5 p-3 flex flex-col justify-between">
                  <div className="h-2 w-1/2 bg-white/20 rounded" />
                  <div className="h-1.5 w-3/4 bg-white/10 rounded" />
                </div>
                <div className="h-20 bg-white/5 rounded-lg border border-white/5 p-3 flex flex-col justify-between">
                  <div className="h-2 w-1/2 bg-white/20 rounded" />
                  <div className="h-1.5 w-3/4 bg-white/10 rounded" />
                </div>
              </div>
            </div>
          </div>
          
          {/* Gradient overlay to fade bottom */}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none" />
        </div>
      </div>
    </BentoCard>
  );
}

function SmartMatchingCard() {
  const [score, setScore] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let current = 0;
      const target = 94;
      const duration = 2000;
      const interval = 20;
      const step = (target / duration) * interval;

      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          setScore(target);
          clearInterval(timer);
        } else {
          setScore(Math.floor(current));
        }
      }, interval);
      return () => clearInterval(timer);
    }
  }, [isInView]);

  return (
    <BentoCard className="items-center text-center">
      <div className="mb-6">
        <h3 className="text-xl font-medium text-white mb-2 tracking-tight">Smart Matching</h3>
        <p className="text-white/50 text-sm">
          Real-time score precision.
        </p>
      </div>

      <div ref={ref} className="flex-1 flex items-center justify-center relative w-full min-h-[160px]">
        {/* Background rings (Orbit Motif) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-32 h-32 rounded-full border border-white/5" />
          <div className="absolute w-48 h-48 rounded-full border border-white/5 border-dashed animate-[spin_30s_linear_infinite]" />
        </div>

        {/* Progress Ring */}
        <div className="relative w-32 h-32">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="2"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="white"
              strokeWidth="2"
              strokeDasharray={251.2}
              strokeDashoffset={isInView ? 251.2 - (251.2 * score) / 100 : 251.2}
              strokeLinecap="round"
              transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-4xl font-serif text-white tracking-tighter">{score}%</span>
            <span className="text-[9px] font-mono text-white/40 uppercase tracking-[0.2em] mt-1">Match</span>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

function ApplicationTrackerCard() {
  return (
    <BentoCard>
      <div className="mb-6">
        <h3 className="text-xl font-medium text-white mb-2 tracking-tight">App Tracker</h3>
        <p className="text-white/50 text-sm">
          Kanban-style pipeline.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-3 min-h-[140px] relative">
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0C0C0C] to-transparent z-10 pointer-events-none" />
        
        {/* Kanban Board Mockup */}
        <div className="flex gap-3 h-full">
          {/* Column 1: Applied */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1">Applied</div>
            <div className="h-10 bg-white/5 rounded-md border border-white/5" />
            <div className="h-12 bg-white/5 rounded-md border border-white/5 opacity-50" />
          </div>
          {/* Column 2: Interview */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1">Interview</div>
            <motion.div 
              className="h-14 bg-white/10 rounded-md border border-white/20 shadow-[0_4px_20px_rgba(255,255,255,0.05)] relative overflow-hidden"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-white/60" />
              <div className="p-2 space-y-1.5 ml-1">
                <div className="h-1.5 w-1/2 bg-white/40 rounded-full" />
                <div className="h-1 w-1/3 bg-white/20 rounded-full" />
              </div>
            </motion.div>
          </div>
          {/* Column 3: Offer */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1">Offer</div>
            <div className="h-10 border border-white/10 border-dashed rounded-md flex items-center justify-center">
              <span className="text-white/20 text-xs">+</span>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

function OneClickApplyCard() {
  const [applied, setApplied] = useState(false);
  const [useOfficial, setUseOfficial] = useState(false);

  return (
    <BentoCard className="justify-between">
      <div className="mb-6 md:mb-0 max-w-[280px]">
        <h3 className="text-xl font-medium text-white mb-2 tracking-tight">One-Click Apply</h3>
        <p className="text-white/50 text-sm leading-relaxed">
          Skip repetitive forms. Apply inside Openned or auto-fill on company career portals.
        </p>
      </div>

      <div className="flex items-center justify-start md:justify-end w-full mt-auto pt-8">
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-4 w-full md:max-w-sm shadow-2xl transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[-4px]">
          
          <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                 <div className="w-4 h-4 bg-white/40 rounded-sm" />
               </div>
               <div>
                 <div className="h-2 w-20 bg-white/30 rounded mb-1.5" />
                 <div className="h-1.5 w-12 bg-white/10 rounded" />
               </div>
             </div>
             <div className="px-2 py-1 bg-white/5 rounded-full border border-white/10">
                <span className="text-[10px] font-mono text-white/60 tracking-wider">94%</span>
             </div>
          </div>

          <div className="flex items-center justify-between mb-5 px-1 cursor-pointer" onClick={() => setUseOfficial(!useOfficial)}>
            <span className="text-xs text-white/50 transition-colors hover:text-white/80">Apply via official portal</span>
            <div 
              className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${useOfficial ? 'bg-white' : 'bg-white/20'}`}
            >
              <motion.div 
                className="absolute top-[2px] left-[2px] w-3 h-3 bg-[#141414] rounded-full shadow-sm"
                animate={{ x: useOfficial ? 16 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          </div>

          <button 
            onClick={() => setApplied(true)}
            disabled={applied}
            className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              applied ? 'bg-white/5 text-white/50 border border-white/5 cursor-default' : 'bg-white text-black hover:bg-white/90 active:scale-[0.98]'
            }`}
          >
            {applied ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-white" />
                <span className="text-white">Application Sent</span>
              </motion.div>
            ) : (
              <span>{useOfficial ? 'Continue to Portal' : 'Apply Now'}</span>
            )}
          </button>
        </div>
      </div>
    </BentoCard>
  );
}

function RankingsCard() {
  return (
    <BentoCard className="bg-[#0C0C0C]/50 opacity-80 group-hover:opacity-100 transition-opacity duration-500">
      {/* Coming soon badge */}
      <div className="absolute top-6 right-6 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
        <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest">Coming Soon</span>
      </div>

      <div className="mb-4 mt-2 max-w-[220px]">
        <Terminal className="w-5 h-5 text-white/40 mb-5 transition-colors duration-500 group-hover:text-white" />
        <h3 className="text-xl font-medium text-white/80 mb-2 tracking-tight transition-colors duration-500 group-hover:text-white">Developer Rankings</h3>
        <p className="text-white/40 text-sm leading-relaxed transition-colors duration-500 group-hover:text-white/60">
          Connect LeetCode, HackerRank & GitHub. Get ranked by what you actually build and solve.
        </p>
      </div>

      <div className="mt-auto pt-6 flex gap-3">
         {[1,2,3,4].map((i) => (
           <div key={i} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center opacity-40 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500">
             <div className="w-3.5 h-3.5 bg-white/30 rounded-sm transition-colors duration-500 group-hover:bg-white/80" />
           </div>
         ))}
      </div>
    </BentoCard>
  );
}

export function BentoGridSection() {
  return (
    <section className="relative w-full py-24 md:py-32 bg-[#0A0A0A] overflow-hidden">
      <div className="container mx-auto px-6 max-w-6xl">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="mb-16 md:mb-24"
        >
          <h2 className="font-serif text-5xl md:text-6xl lg:text-[72px] leading-tight text-white tracking-tight mb-6">
            Everything you need. <br className="hidden md:block"/>
            <span className="text-white/40 italic">Nothing you don&apos;t.</span>
          </h2>
          <p className="text-white/50 max-w-lg text-lg leading-relaxed">
            A unified gateway for your job search journey. Built for speed, precision, and zero friction.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 auto-rows-[240px]">
          {/* Row 1 & 2 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="md:col-span-8 md:row-span-2"
          >
            <MasterProfileCard />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="md:col-span-4 md:row-span-1"
          >
            <SmartMatchingCard />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="md:col-span-4 md:row-span-1"
          >
            <ApplicationTrackerCard />
          </motion.div>

          {/* Row 3 */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="md:col-span-7 md:row-span-1"
          >
            <OneClickApplyCard />
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="md:col-span-5 md:row-span-1"
          >
            <RankingsCard />
          </motion.div>
        </div>

      </div>
    </section>
  );
}
