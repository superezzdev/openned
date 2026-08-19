import Link from "next/link";
import { FaTwitter, FaGithub, FaLinkedin } from "react-icons/fa";

export function Footer() {
  return (
    <footer className="relative bg-[#0A0A0A] text-[#F5F5F5] pt-24 pb-12 overflow-hidden border-t border-white/5">
      {/* Background oversized ring */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] md:w-[1200px] md:h-[1200px] pointer-events-none z-0">
        <div className="w-full h-full rounded-full border border-white/[0.03] shadow-[inset_0_0_100px_rgba(255,255,255,0.02)]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1 flex flex-col items-start">
            <Link href="/" className="flex items-center gap-3 mb-6 group">
              {/* Logo Mark: White ring/orbit on black rounded square */}
              <div className="w-10 h-10 bg-[#0A0A0A] rounded-xl border border-white/20 flex items-center justify-center relative overflow-hidden transition-colors group-hover:border-white/40">
                <div className="w-5 h-5 rounded-full border-[1.5px] border-white/90" />
              </div>
              <span className="font-serif text-2xl tracking-tight text-white">Openned</span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed font-sans max-w-xs">
              Your gateway to the perfect role. Upload your profile once, and let the portal match you with opportunities across the web.
            </p>
          </div>

          {/* Links: Product */}
          <div className="col-span-1">
            <h4 className="text-white font-medium mb-5 tracking-tight">Product</h4>
            <ul className="space-y-3 font-sans text-sm text-white/50">
              <li>
                <Link href="#features" className="hover:text-white transition-colors">Features</Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-white transition-colors">How it works</Link>
              </li>
              <li>
                <Link href="#rankings" className="hover:text-white transition-colors">Rankings</Link>
              </li>
            </ul>
          </div>

          {/* Links: Company */}
          <div className="col-span-1">
            <h4 className="text-white font-medium mb-5 tracking-tight">Company</h4>
            <ul className="space-y-3 font-sans text-sm text-white/50">
              <li>
                <Link href="#" className="hover:text-white transition-colors">About</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">Blog</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">Contact</Link>
              </li>
            </ul>
          </div>

          {/* Links: Legal */}
          <div className="col-span-1">
            <h4 className="text-white font-medium mb-5 tracking-tight">Legal</h4>
            <ul className="space-y-3 font-sans text-sm text-white/50">
              <li>
                <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-xs text-white/40 font-sans">
              &copy; {new Date().getFullYear()} Openned. All rights reserved.
            </p>
            <p className="text-xs text-white/40 font-sans text-center md:text-left leading-relaxed">
              Build and managed by - <a href="https://github.com/superezzdev/" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/60">ARYA RCB</a>
              <span className="hidden md:inline mx-3 text-white/20">|</span>
              <span className="md:hidden block mt-1"></span>
              Open source project: <a href="https://github.com/superezzdev/openned/" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white transition-colors underline underline-offset-4 decoration-white/20 hover:decoration-white/60">GitHub Repository</a>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#" className="text-white/40 hover:text-white transition-colors">
              <FaTwitter className="w-4 h-4" />
              <span className="sr-only">Twitter</span>
            </Link>
            <Link href="#" className="text-white/40 hover:text-white transition-colors">
              <FaGithub className="w-4 h-4" />
              <span className="sr-only">GitHub</span>
            </Link>
            <Link href="#" className="text-white/40 hover:text-white transition-colors">
              <FaLinkedin className="w-4 h-4" />
              <span className="sr-only">LinkedIn</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
