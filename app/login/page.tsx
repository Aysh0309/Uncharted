"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-12 relative">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-card">
            <span className="material-symbols-outlined text-[24px]">policy</span>
          </div>
          <h1 className="font-headline font-bold text-2xl text-primary tracking-tight">
            CaseMemory Terminal
          </h1>
          <p className="font-sans text-xs text-on-surface-variant max-w-xs mx-auto">
            Forensic episodic memory, structured ingestion, and grounded evidentiary retrieval.
          </p>
        </div>

        {/* Demo Quick-Fill Bar (For Hackathon Judges) */}
        <div className="p-4 rounded-3xl bg-surface-container-low border border-outline-variant/30 space-y-2.5 shadow-subtle">
          <div className="font-label text-[11px] uppercase tracking-wider text-secondary flex items-center gap-1.5 font-bold">
            <span className="material-symbols-outlined text-[15px]">badge</span>
            Demo Credentials (1-Click Fill)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => fillDemo("admin@casememory.local", "AdminPass123!")}
              className="text-left p-2.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 transition-all font-label shadow-xs cursor-pointer"
            >
              <span className="font-bold text-primary block text-[11px]">Admin</span>
              <span className="text-on-surface-variant text-[10px]">All Cases</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo("investigator@casememory.local", "InvestPass123!")}
              className="text-left p-2.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 transition-all font-label shadow-xs cursor-pointer"
            >
              <span className="font-bold text-secondary block text-[11px]">Investigator</span>
              <span className="text-on-surface-variant text-[10px]">Read/Write</span>
            </button>
            <button
              type="button"
              onClick={() => fillDemo("viewer@casememory.local", "ViewerPass123!")}
              className="text-left p-2.5 rounded-2xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 transition-all font-label shadow-xs cursor-pointer"
            >
              <span className="font-bold text-on-surface block text-[11px]">Viewer</span>
              <span className="text-on-surface-variant text-[10px]">Ask-Only</span>
            </button>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-label text-xs font-bold text-on-surface">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investigator@casememory.local"
                required
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="font-label text-xs font-bold text-on-surface">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label font-bold text-xs tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
