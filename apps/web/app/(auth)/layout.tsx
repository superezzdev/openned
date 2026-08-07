import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Column (40%) - Content */}
      <div className="flex w-full flex-col justify-between p-6 lg:w-[40%] lg:px-12 lg:py-10">
        
        {/* Header - Logo */}
        <div className="flex items-center">
          <Link href="/">
            <Image
              src="/logo.svg"
              alt="Openned Logo"
              width={40}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
        </div>

        {/* Middle - Forms */}
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center my-auto">
          {children}
        </div>

        {/* Footer - Links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground/80 mt-10">
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">About</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Get App</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Help</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Terms</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Privacy</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Cookies</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Careers</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Developers</Link>
          <Link href="#" className="hover:text-foreground hover:underline transition-colors">Accessibility</Link>
        </div>
      </div>

      {/* Right Column (60%) - Large Logo */}
      <div className="hidden lg:flex lg:w-[60%] items-center justify-center bg-white border-l border-border/40">
        <div className="w-[55%] flex justify-center items-center opacity-90">
           <Image
              src="/logo.svg"
              alt="Openned Large Logo"
              width={800}
              height={800}
              className="w-full h-auto object-contain"
              priority
            />
        </div>
      </div>
    </div>
  );
}
