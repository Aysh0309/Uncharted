import Link from "next/link";
import { Shield, Brain, Database, Sparkles, Activity } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-12 max-w-5xl mx-auto flex flex-col justify-between">
      <header className="flex items-center justify-between border-b border-zinc-800 pb-6 mb-12">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              CaseMemory
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                v0.1.0-alpha
              </span>
            </h1>
            <p className="text-xs text-zinc-400">Agentic Memory for Criminal Case Investigations</p>
          </div>
        </div>

        <Link
          href="/api/health"
          target="_blank"
          className="inline-flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          GET /api/health
        </Link>
      </header>

      <section className="space-y-6 my-auto py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          UNCHARTED 2026 | Agentic Memory Track
        </div>
        
        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
          Investigative facts in, <br />
          <span className="bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500 bg-clip-text text-transparent">
            grounded evidentiary intelligence
          </span> out.
        </h2>

        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
          CaseMemory extracts unstructured investigator inputs into structured events, entities, and timelines.
          Every answer is strictly grounded in case memory with verified note citations.
        </p>

        <div className="pt-2 flex items-center gap-3">
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm tracking-wide transition shadow-lg shadow-amber-500/10"
          >
            Launch Case Terminal
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-sm font-medium transition"
          >
            Sign In / Demo Roles
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Brain className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-white">Dual-Pipeline Router</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              Automatically distinguishes case facts from investigative queries in a unified input console.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Database className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-white">Atlas Vector Search</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              Combines semantic similarity on notes and events with strict case-isolated scoping and RBAC.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <Shield className="w-4 h-4" />
              <h3 className="text-sm font-semibold text-white">Explainable Evidentiary Output</h3>
            </div>
            <p className="text-xs text-zinc-400 leading-normal">
              Calculates deterministic suspect scores and gap analysis while never declaring premature guilt.
            </p>
          </div>
        </div>
      </section>

      <footer className="pt-12 border-t border-zinc-900 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          Stack: Next.js (App Router) • MongoDB Atlas • JWT RBAC • Tailwind CSS
        </div>
        <div className="font-mono text-zinc-500">
          Ready for Vercel deployment
        </div>
      </footer>
    </main>
  );
}

