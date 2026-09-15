import { Marquee } from "./ui/marquee";

export function MarqueeSection() {
  const platforms = [
    "Greenhouse",
    "Lever",
    "Ashby",
    "Workday",
    "Wellfound",
    "Y Combinator",
    "Levels.fyi",
    "RemoteOK",
    "LinkedIn Direct",
  ];

  return (
    <section className="w-full border-t border-b border-white/5 bg-[#080808] py-5 relative overflow-hidden">
      {/* Gradient masks for smooth fade effect at edges */}
      <div className="absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-[#0A0A0A] to-transparent z-10 pointer-events-none" />
      
      <div className="text-center text-[10px] font-mono tracking-widest uppercase text-white/30 mb-3">
        Direct Ingestion from Leading ATS Portals & Tech Career Hubs
      </div>

      <Marquee pauseOnHover className="[--duration:45s]" repeat={5}>
        {platforms.map((platform, idx) => (
          <div key={idx} className="flex items-center gap-8">
            <span className="text-xs md:text-sm font-medium tracking-widest text-white/50 uppercase hover:text-white transition-colors duration-300">
              {platform}
            </span>
            <span className="text-white/20 text-xs">◆</span>
          </div>
        ))}
      </Marquee>
    </section>
  );
}
