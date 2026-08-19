"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { NumberTicker } from "./ui/number-ticker";

export function StatsSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  };

  return (
    <section className="relative z-10 py-24 sm:py-32 w-full max-w-7xl mx-auto px-6 lg:px-8">
      {/* Subtle border top separator */}
      <div className="absolute top-0 left-6 right-6 lg:left-8 lg:right-8 h-px bg-white/5" />
      
      <motion.div 
        ref={ref}
        variants={container}
        initial="hidden"
        animate={isInView ? "show" : "hidden"}
        className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12"
      >
        <motion.div variants={item} className="flex flex-col gap-y-3">
          <div className="flex items-center text-5xl md:text-6xl font-medium tracking-tighter text-white font-serif">
            <NumberTicker value={500} />
            <span>+</span>
          </div>
          <p className="text-sm md:text-base text-neutral-400 font-sans tracking-wide">
            Job portals scraped
          </p>
        </motion.div>
        
        <motion.div variants={item} className="flex flex-col gap-y-3">
          <div className="flex items-center text-5xl md:text-6xl font-medium tracking-tighter text-white font-serif">
            <NumberTicker value={10000} />
            <span>+</span>
          </div>
          <p className="text-sm md:text-base text-neutral-400 font-sans tracking-wide">
            Roles matched weekly
          </p>
        </motion.div>
        
        <motion.div variants={item} className="flex flex-col gap-y-3">
          <div className="flex items-center text-5xl md:text-6xl font-medium tracking-tighter text-white font-serif">
            <NumberTicker value={3} />
            <span>x</span>
          </div>
          <p className="text-sm md:text-base text-neutral-400 font-sans tracking-wide">
            Faster applications
          </p>
        </motion.div>
        
        <motion.div variants={item} className="flex flex-col gap-y-3">
          <div className="flex items-center text-5xl md:text-6xl font-medium tracking-tighter text-white font-serif">
            <NumberTicker value={1} />
          </div>
          <p className="text-sm md:text-base text-neutral-400 font-sans tracking-wide">
            Profile, everywhere
          </p>
        </motion.div>
      </motion.div>
    </section>
  );
}
