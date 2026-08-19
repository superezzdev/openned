"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MagneticButton } from "./ui/magnetic-button";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 20,
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        isScrolled
          ? "bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Left: Logo & Wordmark */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-[28px] h-[28px] flex items-center justify-center overflow-hidden transition-opacity group-hover:opacity-80">
            <Image src="/logo.svg" alt="Openned Logo" fill className="object-contain" />
          </div>
          <span className="font-sans font-medium text-[20px] tracking-tight text-[#f5f5f5]">
            Openned
          </span>
        </Link>

        {/* Center/Right: Nav Links */}
        <nav className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
          {["Product", "How it works"].map((item) => (
            <Link
              key={item}
              href="#"
              className="text-sm text-white/60 hover:text-[#f5f5f5] transition-colors"
            >
              {item}
            </Link>
          ))}
          <Link
            href="#"
            className="text-sm text-white/60 hover:text-[#f5f5f5] transition-colors flex items-center gap-2 group"
          >
            Rankings
            <span className="text-[10px] uppercase tracking-wider bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-full text-white/40 group-hover:text-white/60 transition-colors">
              Coming soon
            </span>
          </Link>
          <Link
            href="#"
            className="text-sm text-white/60 hover:text-[#f5f5f5] transition-colors"
          >
            Pricing
          </Link>
        </nav>

        {/* Right: Auth Buttons */}
        <div className="flex items-center gap-4">
          <Link
            href="#"
            className="text-sm font-medium text-white/80 hover:text-[#f5f5f5] transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <MagneticButton
            intensity={0.15}
            className="bg-[#f5f5f5] text-[#0a0a0a] text-sm font-medium px-5 py-2.5 rounded-full hover:bg-white transition-colors"
          >
            Get started
          </MagneticButton>
        </div>
      </div>
    </motion.header>
  );
}
