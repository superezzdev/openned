"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

const faqs = [
  {
    question: "How does Openned save me 15+ hours every week?",
    answer:
      "Instead of spending 30–45 minutes manually filling out identical contact details, education history, and past work bullets into Workday, Lever, and Greenhouse forms for every role, Openned stores your ATS-optimized Master Profile once. You can review precision matches and submit in 30 seconds with 1-Click Apply.",
  },
  {
    question: "Will automated applications get me flagged or rejected by ATS?",
    answer:
      "No. Unlike spam bots that blast generic PDF templates to hundreds of random inboxes, Openned generates authentic submissions tailored to each company's exact ATS requirements (Greenhouse, Lever, Ashby, Workday). You always retain control: you can review answers, make edits, or click to apply directly on the official company portal.",
  },
  {
    question: "How is Openned different from LinkedIn or Indeed?",
    answer:
      "Traditional job boards are plagued with ghost jobs, recruiter spam, and reposted listings that were filled weeks ago. Openned bypasses the middleman by indexing directly from verified company career pages. If a job is on Openned, it's live on the employer's actual ATS.",
  },
  {
    question: "How does the AI Match Score work?",
    answer:
      "Our matching engine conducts a semantic analysis of the job description against your Master Profile. It evaluates core technical skills, framework proficiency, and project experience to give you a transparent score (e.g., 94% match) and highlights both matching strengths and missing keywords before you apply.",
  },
  {
    question: "Can I choose between applying on Openned or on the official company site?",
    answer:
      "Yes! Every job card has a toggle. You can choose 1-Click Apply directly inside Openned, or click 'Apply on Company Portal' to be taken directly to the employer's official career page with pre-formatted answers ready.",
  },
  {
    question: "Is Openned free to start?",
    answer:
      "Yes! You can sign up, upload your resume, generate your ATS Master Profile, and browse matched jobs completely free with no credit card required.",
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative w-full py-24 md:py-36 bg-[#0A0A0A] overflow-hidden">
      {/* Subtle radial background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-white/[0.02] rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-6 max-w-4xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16 md:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-6">
            <HelpCircle className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
              Frequently Asked Questions
            </span>
          </div>

          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl leading-[1.1] tracking-tight text-white mb-6">
            Everything you need to know. <br />
            <span className="text-white/40 italic">Clear and transparent.</span>
          </h2>

          <p className="text-white/60 text-base md:text-lg font-sans font-light leading-relaxed max-w-xl mx-auto">
            Got questions about how Openned protects your privacy, interacts with ATS portals, and accelerates your job search? We have answers.
          </p>
        </motion.div>

        {/* Accordion List */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.06 }}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? "bg-[#141414] border-white/20 shadow-[0_10px_30px_rgba(255,255,255,0.03)]"
                    : "bg-[#0E0E0E]/60 border-white/5 hover:border-white/15"
                }`}
              >
                <button
                  onClick={() => toggle(idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                >
                  <span className="text-base sm:text-lg font-medium text-white tracking-tight">
                    {faq.question}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all duration-300 ${
                      isOpen
                        ? "bg-white text-black border-white rotate-180"
                        : "bg-white/5 text-white/50 border-white/10"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="px-6 pb-6 pt-1 text-sm md:text-base text-white/60 leading-relaxed border-t border-white/5">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom prompt */}
        <div className="mt-12 text-center">
          <p className="text-sm text-white/50 mb-3">
            Still have a question or need special support?
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-sm text-white font-medium hover:underline underline-offset-4"
          >
            Create your profile free and see it live
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
