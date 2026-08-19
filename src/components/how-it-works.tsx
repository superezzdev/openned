"use client";

import { motion } from "framer-motion";
import { Upload, Radar, MousePointerClick } from "lucide-react";

const steps = [
  {
    num: "01",
    title: "Build your profile",
    description:
      "Upload a resume or build a master profile with projects, skills, and details. Openned turns it into a structured, ATS-ready profile once.",
    icon: Upload,
  },
  {
    num: "02",
    title: "We scan everything",
    description:
      "Openned continuously scrapes hundreds of job boards and company career pages, matching new postings against your profile in real time.",
    icon: Radar,
  },
  {
    num: "03",
    title: "Apply in one click",
    description:
      "Apply directly inside Openned or jump to the official company portal — either way, track every application's status from one dashboard.",
    icon: MousePointerClick,
  },
];

export function HowItWorks() {
  return (
    <section className="relative w-full py-24 md:py-32 overflow-hidden bg-[#0A0A0A]">
      {/* Background grain texture is applied via body class, but we can add some radial gradients for depth */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-20 md:mb-32"
        >
          <h2 className="font-serif text-5xl md:text-7xl lg:text-[80px] leading-tight tracking-tight text-white mb-6">
            From resume to offer,{" "}
            <span className="text-white/40 italic block md:inline">
              on autopilot.
            </span>
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line (Desktop) */}
          <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-[1px] bg-white/10" />
          <motion.div
            className="hidden md:block absolute top-8 left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent origin-left"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
          />

          {/* Connecting line (Mobile) */}
          <div className="md:hidden absolute top-[10%] bottom-[10%] left-8 w-[1px] bg-white/10" />
          <motion.div
            className="md:hidden absolute top-[10%] bottom-[10%] left-8 w-[1px] bg-gradient-to-b from-transparent via-white/50 to-transparent origin-top"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            viewport={{ once: true, margin: "-100px" }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.2,
                  ease: [0.16, 1, 0.3, 1],
                }}
                viewport={{ once: true, margin: "-100px" }}
                className="relative flex flex-row md:flex-col items-start md:items-center text-left md:text-center group"
              >
                {/* Node icon & orbit rings */}
                <div className="relative shrink-0 flex items-center justify-center w-16 h-16 rounded-full border border-white/20 bg-[#0A0A0A] mr-6 md:mr-0 md:mb-8 transition-colors duration-500 group-hover:border-white/60 group-hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] z-10">
                  {/* Orbit paths */}
                  <motion.div
                    className="absolute inset-[-12px] rounded-full border border-white/10 border-dashed"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <motion.div
                    className="absolute inset-[-24px] rounded-full border border-white/5"
                    animate={{ rotate: -360 }}
                    transition={{
                      duration: 25,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  
                  <step.icon className="w-6 h-6 text-white relative z-10" />
                </div>

                {/* Content */}
                <div className="flex flex-col md:items-center">
                  <span className="text-xs font-mono text-white/50 mb-3 tracking-[0.2em]">
                    {step.num}
                  </span>
                  <h3 className="text-xl md:text-2xl font-medium text-white mb-3 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-sm md:text-base text-white/60 leading-relaxed max-w-[280px]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
