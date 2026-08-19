import { Navbar } from "@/components/navbar";

export default function Home() {
  return (
    <main className="min-h-[200vh] bg-transparent">
      <Navbar />
      {/* Temporary Hero Placeholder for scroll testing */}
      <section className="h-screen w-full flex items-center justify-center relative overflow-hidden">
        {/* Subtle radial gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0,transparent_50%)] pointer-events-none" />
        
        <div className="text-center z-10 space-y-6 px-6">
          <h1 className="font-serif text-5xl md:text-[80px] lg:text-[100px] leading-none tracking-tight text-[#f5f5f5]">
            The Gateway to <br />
            <span className="text-white/40 italic">Next-Gen</span> Matching.
          </h1>
          <p className="font-sans text-white/50 max-w-xl mx-auto text-lg md:text-xl">
            We pull roles from hundreds of job boards to match your master profile automatically.
          </p>
        </div>
      </section>
    </main>
  );
}
