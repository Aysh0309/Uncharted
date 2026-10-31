"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Sign up form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupRole, setSignupRole] = useState<"investigator" | "viewer" | "admin">("investigator");
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Status state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setMode("login");
    setLoginEmail(demoEmail);
    setLoginPassword(demoPass);
    setError(null);
    setSuccess(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to log in");
      }

      setSuccess(`Authenticated as ${data.user.name}. Redirecting...`);
      router.push("/cases");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
          role: signupRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      setSuccess(`Account created for ${data.user.name}! Redirecting to terminal...`);
      router.push("/cases");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-10 relative selection:bg-secondary-container">
      {/* Subtle background decoration */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40" />

      <div className="w-full max-w-md space-y-5 relative z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-card transition-transform hover:scale-105">
            <span className="material-symbols-outlined text-[26px]">policy</span>
          </div>
          <h1 className="font-headline font-extrabold text-2xl text-primary tracking-tight">
            CaseMemory Terminal
          </h1>
          <p className="font-sans text-xs text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Forensic episodic memory, continuous ingest, and grounded evidentiary retrieval.
          </p>
        </div>

        {/* Mode Toggle Switcher (Sign In vs Sign Up) */}
        <div className="p-1 rounded-2xl bg-surface-container border border-outline-variant/30 flex items-center shadow-xs">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-label text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === "login"
                ? "bg-surface-container-lowest text-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">login</span>
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl font-label text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === "signup"
                ? "bg-surface-container-lowest text-primary shadow-xs"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[17px]">person_add</span>
            <span>Create Account</span>
          </button>
        </div>

        {/* Demo Quick-Fill Bar (Only in Login Mode) */}
        {mode === "login" && (
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 space-y-2 shadow-subtle">
            <div className="font-label text-[10px] uppercase tracking-wider text-secondary flex items-center justify-between font-bold">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">badge</span>
                Demo Credentials (1-Click Fill)
              </span>
              <span className="text-[9px] font-normal text-on-surface-variant">Instant Access</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemo("admin@casememory.local", "AdminPass123!")}
                className="text-left p-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 transition-all font-label shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                  <span className="font-bold text-primary block text-[11px] group-hover:text-secondary">Admin</span>
                </div>
                <span className="text-on-surface-variant text-[10px] block mt-0.5">All Cases</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("investigator@casememory.local", "InvestPass123!")}
                className="text-left p-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 transition-all font-label shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span className="font-bold text-secondary block text-[11px]">Investigator</span>
                </div>
                <span className="text-on-surface-variant text-[10px] block mt-0.5">Read / Write</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("viewer@casememory.local", "ViewerPass123!")}
                className="text-left p-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/20 transition-all font-label shadow-xs cursor-pointer group"
              >
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                  <span className="font-bold text-on-surface block text-[11px]">Viewer</span>
                </div>
                <span className="text-on-surface-variant text-[10px] block mt-0.5">Ask Queries</span>
              </button>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-xs flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-2xl bg-secondary-container text-on-secondary-container text-xs flex items-center gap-2 animate-fadeIn">
            <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
            <span className="font-medium">{success}</span>
          </div>
        )}

        {/* Main Card Container */}
        <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-card">
          {mode === "login" ? (
            /* ================= LOGIN FORM ================= */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant">mail</span>
                  Email Address
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="investigator@casememory.local"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans transition-colors"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[15px] text-on-surface-variant">lock</span>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="text-[11px] text-on-surface-variant hover:text-primary font-label flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {showLoginPassword ? "visibility_off" : "visibility"}
                    </span>
                    <span>{showLoginPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <input
                  type={showLoginPassword ? "text" : "password"}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label font-bold text-xs tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Terminal</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                  className="text-xs text-on-surface-variant hover:text-primary font-label transition-colors cursor-pointer"
                >
                  Don't have an account? <span className="font-bold underline text-secondary">Sign up here</span>
                </button>
              </div>
            </form>
          ) : (
            /* ================= SIGN UP FORM ================= */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant">person</span>
                  Full Name &amp; Title
                </label>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="e.g. Det. Alex Cross"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant">mail</span>
                  Official Email Address
                </label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="alex.cross@casememory.local"
                  required
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3.5 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans transition-colors"
                />
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant">shield_person</span>
                  Operational Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupRole("investigator")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-label ${
                      signupRole === "investigator"
                        ? "bg-secondary-container/40 border-secondary text-on-surface shadow-xs"
                        : "bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-secondary">search_insights</span>
                      <span className="text-[11px] font-bold block">Investigator</span>
                    </div>
                    <span className="text-[9px] text-on-surface-variant block mt-0.5 leading-tight">
                      Read/Write Cases
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole("viewer")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-label ${
                      signupRole === "viewer"
                        ? "bg-secondary-container/40 border-secondary text-on-surface shadow-xs"
                        : "bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-outline">visibility</span>
                      <span className="text-[11px] font-bold block">Analyst</span>
                    </div>
                    <span className="text-[9px] text-on-surface-variant block mt-0.5 leading-tight">
                      Read &amp; Query
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole("admin")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-label ${
                      signupRole === "admin"
                        ? "bg-secondary-container/40 border-secondary text-on-surface shadow-xs"
                        : "bg-surface-container-low border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-error">admin_panel_settings</span>
                      <span className="text-[11px] font-bold block">Admin</span>
                    </div>
                    <span className="text-[9px] text-on-surface-variant block mt-0.5 leading-tight">
                      Manage All
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-on-surface-variant">lock</span>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="text-[10px] text-on-surface-variant hover:text-primary font-label cursor-pointer"
                    >
                      {showSignupPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-label text-xs font-bold text-on-surface flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">check_circle</span>
                    Confirm
                  </label>
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    minLength={6}
                    className={`w-full bg-surface-container-low border rounded-xl px-3 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none font-sans ${
                      signupConfirmPassword && signupPassword !== signupConfirmPassword
                        ? "border-error focus:border-error"
                        : "border-outline-variant/30 focus:border-primary"
                    }`}
                  />
                </div>
              </div>

              {signupConfirmPassword && signupPassword === signupConfirmPassword && (
                <div className="text-[11px] text-secondary font-label flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check</span>
                  Passwords match
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label font-bold text-xs tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  <>
                    <span>Register &amp; Access Terminal</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="text-xs text-on-surface-variant hover:text-primary font-label transition-colors cursor-pointer"
                >
                  Already registered? <span className="font-bold underline text-secondary">Sign in instead</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Security / System Footer */}
        <div className="text-center font-label text-[10px] text-on-surface-variant/70 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-[13px]">lock</span>
          <span>Role-Based Access Control • Salted &amp; Hashed Authentication</span>
        </div>
      </div>
    </div>
  );
}
