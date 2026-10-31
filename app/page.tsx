import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-surface text-on-surface px-4 lg:px-8 py-10 max-w-5xl mx-auto flex flex-col justify-between">
      {/* Header */}
      <header className="flex items-center justify-between pb-6 border-b border-outline-variant/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center font-bold text-base shadow-sm">
            <span className="material-symbols-outlined text-[20px]">policy</span>
          </div>
          <div>
            <h1 className="font-headline font-bold text-lg text-primary tracking-tight flex items-center gap-2">
              CaseMemory
              <span className="font-label text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">
                UNCHARTED 2026
              </span>
            </h1>
            <p className="font-sans text-xs text-on-surface-variant">
              Agentic Memory for Criminal Investigations
            </p>
          </div>
        </div>

        <Link
          href="/api/health"
          target="_blank"
          className="inline-flex items-center gap-1.5 font-label text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant/20"
        >
          <span className="w-2 h-2 rounded-full bg-secondary" />
          <span>GET /api/health</span>
        </Link>
      </header>

      {/* Hero Section */}
      <section className="space-y-6 my-auto py-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 font-label text-xs text-on-surface-variant font-medium">
          <span className="w-2 h-2 rounded-full bg-secondary" />
          Continuous Vector Synthesis & Evidentiary Memory
        </div>

        <h2 className="font-headline text-4xl sm:text-5xl font-extrabold text-primary tracking-tight leading-tight max-w-2xl">
          Investigative facts in, <br />
          <span className="text-secondary">
            grounded evidentiary intelligence
          </span> out.
        </h2>

        <p className="font-sans text-sm sm:text-base text-on-surface-variant max-w-xl leading-relaxed">
          CaseMemory ingests raw investigator notes into structured vector memory,
          detects contradictions, computes explainable suspect scores, and answers questions with verified citations.
        </p>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <span>Launch Case Workspace</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface font-label text-xs font-bold transition-colors border border-outline-variant/30"
          >
            <span>Demo Roles Login</span>
          </Link>
        </div>

        {/* 3 Core Minimalist Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 space-y-1.5 shadow-subtle">
            <div className="flex items-center gap-2 text-primary font-bold font-label text-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary">alt_route</span>
              Dual-Pipeline Router
            </div>
            <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
              Separates unstructured case facts from investigative queries in one unified console.
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 space-y-1.5 shadow-subtle">
            <div className="flex items-center gap-2 text-primary font-bold font-label text-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary">database</span>
              Atlas Vector Search
            </div>
            <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
              Strict multi-tenant case filtering combined with cosine vector similarity on notes & events.
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 space-y-1.5 shadow-subtle">
            <div className="flex items-center gap-2 text-primary font-bold font-label text-xs">
              <span className="material-symbols-outlined text-[18px] text-secondary">verified</span>
              Explainable Evidentiary Output
            </div>
            <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
              Deterministic suspect scores in code and mandatory source citations. No hallucinations.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-8 border-t border-outline-variant/30 font-label text-xs text-on-surface-variant flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>Next.js 14 • MongoDB Atlas • Google Gemini • Material Editorial Theme</div>
        <div className="text-outline">Clean &amp; Minimalist</div>
      </footer>
    </main>
  );
}
