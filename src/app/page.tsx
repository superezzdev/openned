import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { MarqueeSection } from "@/components/marquee-section";
import { HowItWorks } from "@/components/how-it-works";
import { BentoGridSection } from "@/components/bento-grid-section";
import { RankingsSection } from "@/components/rankings-section";
import { StatsSection } from "@/components/stats-section";
import { CTASection } from "@/components/cta-section";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="bg-[#0A0A0A] min-h-screen">
      <Navbar />
      <Hero />
      <StatsSection />
      <MarqueeSection />
      <HowItWorks />
      <BentoGridSection />
      <RankingsSection />
      <CTASection />
      <Footer />
    </main>
  );
}
