"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, ArrowRight, UserCheck, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to log in");
      }

      router.push("/cases");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 items-center justify-center text-amber-400 mb-2">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            CaseMemory Login
          </h1>
          <p className="text-xs text-zinc-400">
            Sign in to access case files, memory retrieval, and investigation logs
          </p>
        </div>

        {/* Demo Quick-Fill Section for Hackathon Judges */}
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
          <div className="text-[11px] font-mono uppercase text-amber-400 flex items-center gap-1.5 font-semibold">
            <UserCheck className="w-3.5 h-3.5" />
            Hackathon Demo Roles (Click to fill)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemo("admin@casememory.local", "AdminPass123!")}
              className="text-left p-2 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 transition text-[11px]"
            >
              <span className="font-semibold text-rose-400 block">Admin</span>
              <span className="text-zinc-400 text-[10px]">All Cases</span>
            </button>
            <button
              type="button"
              onClick={() =>
                fillDemo("investigator@casememory.local", "InvestPass123!")
              }
              className="text-left p-2 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 transition text-[11px]"
            >
              <span className="font-semibold text-amber-400 block">Investigator</span>
              <span className="text-zinc-400 text-[10px]">Read/Write</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo("viewer@casememory.local", "ViewerPass123!")}
              className="text-left p-2 rounded-lg bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 transition text-[11px]"
            >
              <span className="font-semibold text-blue-400 block">Viewer</span>
              <span className="text-zinc-400 text-[10px]">Read-Only</span>
            </button>
          </div>
        </div>

        {/* Login Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investigator@casememory.local"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 transition"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

