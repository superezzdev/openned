"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MagneticButton } from "./ui/magnetic-button";

export function CTASection() {
  return (
    <section className="relative w-full py-40 md:py-56 overflow-hidden bg-[#0A0A0A] flex items-center justify-center">
      {/* Background Rings / Portal Motif */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Grain overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        
        {/* Radial gradient glow in the center */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_0%,transparent_50%)]" />

        {/* Orbit Rings */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="absolute flex items-center justify-center"
        >
          <div className="absolute w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full border border-white/[0.08]" />
          <div className="absolute w-[600px] h-[600px] md:w-[800px] md:h-[800px] rounded-full border border-white/[0.04]" />
          <div className="absolute w-[800px] h-[800px] md:w-[1000px] md:h-[1000px] rounded-full border border-white/[0.02]" />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-serif text-white tracking-tighter leading-[1.1] mb-6"
        >
          Stop applying one tab at a time.
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-neutral-400 font-sans max-w-2xl mx-auto mb-10 tracking-wide"
        >
          Build your profile once. Let Openned find and apply to the rest.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center"
        >
          <MagneticButton className="group bg-white text-black px-8 py-4 rounded-full font-medium text-lg hover:bg-neutral-200 transition-colors flex items-center gap-2">
            Get started free
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </MagneticButton>
        </motion.div>
      </div>
    </section>
  );
}
