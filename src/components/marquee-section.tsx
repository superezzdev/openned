import { Marquee } from "./ui/marquee";

export function MarqueeSection() {
  const jobs = [
    "LinkedIn",
    "Indeed",
    "Wellfound",
    "Naukri",
    "AngelList",
    "Glassdoor",
    "Levels.fyi",
  ];

  return (
    <section className="w-full border-t border-b border-white/5 bg-background py-4 relative overflow-hidden">
      {/* Gradient masks for smooth fade effect at edges */}
      <div className="absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      
      <Marquee pauseOnHover className="[--duration:50s]" repeat={6}>
        {jobs.map((job, idx) => (
          <div key={idx} className="flex items-center gap-8">
            <span className="text-sm md:text-base font-medium tracking-widest text-white/40 uppercase hover:text-white/80 transition-colors duration-300">
              {job}
            </span>
            <span className="text-white/20 text-xs">·</span>
          </div>
        ))}
      </Marquee>
    </section>
  );
}
