"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, LogOut, Briefcase, UserCheck } from "lucide-react";
import { UserSession } from "@/lib/auth";

interface NavbarProps {
  user: UserSession;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "investigator":
        return "bg-amber-500/10 text-amber-300 border-amber-500/30";
      case "viewer":
        return "bg-blue-500/10 text-blue-300 border-blue-500/30";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/cases" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-white flex items-center gap-1.5">
                CaseMemory
              </span>
              <span className="text-[10px] text-zinc-400 block -mt-1 font-mono">
                Agentic Investigation
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/cases"
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              Cases
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-zinc-200">{user.name}</div>
            <div className="text-[11px] text-zinc-400 font-mono">{user.email}</div>
          </div>

          <span
            className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${getRoleBadge(
              user.role
            )}`}
          >
            {user.role}
          </span>

          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

