import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden text-[#f5ede4] font-sans selection:bg-secondary-container">
      {/* Complete Full-Bleed Background Image with Atmospheric Float */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-float-slow"
          style={{ backgroundImage: "url('/hero-bg.png')" }}
        />
        {/* Consistent Atmospheric Dark Bokeh Overlay for Maximum Contrast & Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a130f]/85 via-[#1a130f]/65 to-[#1a130f]/90 backdrop-blur-[1px]" />

        {/* Ambient Glowing Light Orbs matching the warm amber bokeh */}
        <div className="absolute top-1/4 left-1/4 w-[420px] h-[420px] rounded-full bg-[#f8dac9]/25 blur-3xl animate-pulse-glow" />
        <div
          className="absolute bottom-1/3 right-1/4 w-[360px] h-[360px] rounded-full bg-[#dec1b1]/20 blur-3xl animate-pulse-glow"
          style={{ animationDelay: "3s" }}
        />
      </div>

      {/* Main Content Container */}
      <main className="relative z-10 min-h-screen px-4 lg:px-8 py-10 max-w-5xl mx-auto flex flex-col justify-between">
        {/* Header */}
        <header className="flex items-center justify-between pb-6 border-b border-white/20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 text-white flex items-center justify-center font-bold text-base shadow-sm transition-transform duration-300 hover:scale-105 hover:rotate-3">
              <span className="material-symbols-outlined text-[20px] text-white">policy</span>
            </div>
            <div>
              <h1 className="font-headline font-bold text-lg text-white tracking-tight drop-shadow-sm">
                CaseMemory
              </h1>
              <p className="font-sans text-xs text-white/95 font-medium drop-shadow-sm">
                Agentic Memory for Criminal Investigations
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 font-label text-xs font-bold px-4 py-2 rounded-full bg-white text-[#271f1a] hover:bg-[#f5ede4] transition-all duration-200 border border-white/40 shadow-md hover:shadow-card hover:scale-[1.02]"
          >
            <span>Sign In</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </header>

        {/* Hero Section */}
        <section className="space-y-6 my-auto py-12">
          {/* Pulsing Status Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 font-label text-xs text-[#f5ede4] font-medium shadow-subtle hover:border-[#f8dac9]/40 transition-colors">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f8dac9] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f8dac9]" />
            </span>
            <span>Continuous Vector Synthesis & Evidentiary Memory</span>
          </div>

          {/* High-Contrast Visible Headline */}
          <h2 className="font-headline text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight max-w-2xl drop-shadow-sm">
            Investigative facts in, <br />
            <span className="text-[#f8dac9] font-extrabold">
              grounded evidentiary intelligence
            </span>{" "}
            out.
          </h2>

          {/* High-Contrast Visible Subtitle / Description */}
          <p className="font-sans text-sm sm:text-base text-[#f5ede4] font-medium max-w-xl leading-relaxed drop-shadow-sm">
            CaseMemory ingests raw investigator notes into structured vector memory,
            detects contradictions, computes explainable suspect scores, and answers questions with verified citations.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/cases"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white hover:bg-[#f5ede4] text-[#271f1a] font-label text-xs font-bold transition-all duration-300 shadow-md hover:shadow-float hover:scale-[1.02] cursor-pointer"
            >
              <span>Launch Case Workspace</span>
              <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </Link>
          </div>

          {/* 3 Core Highlights (Frosted Glassmorphic Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <div className="p-5 rounded-3xl bg-black/40 backdrop-blur-md border border-white/15 space-y-2 shadow-subtle hover:shadow-float hover:border-[#f8dac9]/40 hover:-translate-y-1 transition-all duration-300 group">
              <div className="flex items-center gap-2 text-white font-bold font-label text-xs">
                <div className="w-7 h-7 rounded-xl bg-[#f8dac9]/20 flex items-center justify-center text-[#f8dac9] group-hover:scale-110 group-hover:bg-[#f8dac9] group-hover:text-[#271f1a] transition-all duration-300">
                  <span className="material-symbols-outlined text-[17px]">alt_route</span>
                </div>
                Dual-Pipeline Router
              </div>
              <p className="font-sans text-xs text-[#f5ede4]/90 font-medium leading-relaxed">
                Separates unstructured case facts from investigative queries in one unified console.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-black/40 backdrop-blur-md border border-white/15 space-y-2 shadow-subtle hover:shadow-float hover:border-[#f8dac9]/40 hover:-translate-y-1 transition-all duration-300 group">
              <div className="flex items-center gap-2 text-white font-bold font-label text-xs">
                <div className="w-7 h-7 rounded-xl bg-[#f8dac9]/20 flex items-center justify-center text-[#f8dac9] group-hover:scale-110 group-hover:bg-[#f8dac9] group-hover:text-[#271f1a] transition-all duration-300">
                  <span className="material-symbols-outlined text-[17px]">database</span>
                </div>
                Atlas Vector Search
              </div>
              <p className="font-sans text-xs text-[#f5ede4]/90 font-medium leading-relaxed">
                Strict multi-tenant case filtering combined with cosine vector similarity on notes &amp; events.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-black/40 backdrop-blur-md border border-white/15 space-y-2 shadow-subtle hover:shadow-float hover:border-[#f8dac9]/40 hover:-translate-y-1 transition-all duration-300 group">
              <div className="flex items-center gap-2 text-white font-bold font-label text-xs">
                <div className="w-7 h-7 rounded-xl bg-[#f8dac9]/20 flex items-center justify-center text-[#f8dac9] group-hover:scale-110 group-hover:bg-[#f8dac9] group-hover:text-[#271f1a] transition-all duration-300">
                  <span className="material-symbols-outlined text-[17px]">verified</span>
                </div>
                Explainable Evidentiary Output
              </div>
              <p className="font-sans text-xs text-[#f5ede4]/90 font-medium leading-relaxed">
                Deterministic suspect scores in code and mandatory source citations. No hallucinations.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t border-white/20 font-label text-xs text-white font-medium flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-sm drop-shadow-sm">
          <div className="text-white font-medium">CaseMemory — Agentic Memory for Criminal Investigations</div>
          <div className="text-white font-semibold">Confidential Evidentiary Terminal</div>
        </footer>
      </main>
    </div>
  );
}
