"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Status state
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // URL query params check (e.g. from Google OAuth callback)
  const googleMissing = searchParams.get("google_missing") === "true";
  const urlError = searchParams.get("error");

  useEffect(() => {
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [urlError]);

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


        {/* Google OAuth Missing Setup Notification */}
        {googleMissing && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2 animate-fadeIn">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px]">key</span>
              <span>Google OAuth Setup Needed</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              To connect your Google account, add your <code className="bg-amber-100 font-mono px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-amber-100 font-mono px-1 rounded">GOOGLE_CLIENT_SECRET</code> to <code className="bg-amber-100 font-mono px-1 rounded">.env.local</code>.
            </p>
            <div>
              <a
                href="/api/auth/google?demo=true"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-800 hover:bg-amber-900 text-white text-[11px] font-bold transition-colors shadow-xs"
              >
                <span>Click Here for Simulated Google Login</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </a>
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
        <div className="p-6 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-card space-y-4">
          {/* Google Sign-in Button */}
          <div>
            <a
              href="/api/auth/google"
              className="w-full py-2.5 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-on-surface font-label font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>

            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-outline-variant/30 w-full" />
              <span className="bg-surface-container-lowest px-3 font-label text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">
                or continue with credentials
              </span>
            </div>
          </div>

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
          <span>Role-Based Access Control • Google OAuth 2.0 &amp; Salted Hash</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface flex items-center justify-center text-xs">Loading login...</div>}>
      <LoginContent />
    </Suspense>
  );
}
