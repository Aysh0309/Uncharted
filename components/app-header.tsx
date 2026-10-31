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

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant font-label text-xs">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-medium">
              {activeCaseTitle ? `${activeCaseTitle}` : "Evidentiary Memory Synced"}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-container-highest text-on-surface">
              {tracesCount} traces
            </span>
          </div>
        </div>

        {/* Right Quick Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-surface-container text-on-surface-variant text-xs font-label">
            <span className="material-symbols-outlined text-[17px]">database</span>
            <span className="hidden md:inline font-medium">Atlas Vector Store</span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-container-highest text-[10px] font-bold">
              768-D
            </kbd>
          </div>

          <div className="h-5 w-px bg-outline-variant/40" />

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

