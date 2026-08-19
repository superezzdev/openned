import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { MarqueeSection } from "@/components/marquee-section";
import { HowItWorks } from "@/components/how-it-works";
import { BentoGridSection } from "@/components/bento-grid-section";

export default function Home() {
  return (
    <main className="bg-[#0A0A0A]">
      <Navbar />
      <Hero />
      <MarqueeSection />
      <HowItWorks />
      <BentoGridSection />
    </main>
  );
}
