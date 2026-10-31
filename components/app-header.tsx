"use client";

import Link from "next/link";
import { UserSession } from "@/lib/auth";

interface AppHeaderProps {
  user?: UserSession;
  activeCaseTitle?: string;
  tracesCount?: number;
}

export function AppHeader({
  user,
  activeCaseTitle,
  tracesCount = 14,
}: AppHeaderProps) {
  return (
    <header className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-surface/90 backdrop-blur-xl z-40 border-b border-outline-variant/30 shadow-subtle">
      <div className="h-16 w-full px-4 lg:px-8 flex items-center justify-between">
        {/* Left Status Indicator */}
        <div className="flex items-center gap-3">
          {/* Mobile Home Link */}
          <Link href="/cases" className="lg:hidden flex items-center gap-1.5 font-bold text-sm text-primary">
            <span className="material-symbols-outlined text-[18px]">policy</span>
            <span>CaseMemory</span>
          </Link>
        </div>

        {/* Right Quick Controls */}
        <div className="flex items-center gap-3">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-on-surface hidden md:inline">
                {user.name}
              </span>
              <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed">
                {user.role}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

