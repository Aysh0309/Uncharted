"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserSession } from "@/lib/auth";

interface AppSidebarProps {
  user: UserSession;
  activeCase?: { id: string; title: string };
  notesCount?: number;
}

export function AppSidebar({ user, activeCase, notesCount = 3 }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

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
        return "bg-secondary-fixed text-on-secondary-fixed";
      case "investigator":
        return "bg-secondary-container text-on-secondary-container";
      case "viewer":
        return "bg-surface-container-high text-on-surface-variant";
      default:
        return "bg-surface-container text-on-surface";
    }
  };

  const isCaseDetail = pathname.startsWith("/cases/") && pathname !== "/cases";

  return (
    <aside className="fixed left-0 top-0 h-full w-72 bg-surface-container-low z-50 hidden lg:flex flex-col justify-between py-6 border-r border-outline-variant/30 shadow-subtle select-none">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="px-6 flex items-center justify-between">
          <Link href="/cases" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
              <span className="material-symbols-outlined text-[18px]">policy</span>
            </div>
            <span className="font-headline font-bold text-lg text-primary tracking-tight">
              CaseMemory
            </span>
          </Link>
        </div>

        {/* Active Case Context Pill */}
        <div className="px-4">
          <Link
            href="/cases"
            className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high cursor-pointer transition-colors border border-outline-variant/20"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[17px]">folder_special</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label text-xs font-bold text-on-surface truncate">
                  {activeCase?.title || "Active Case Files"}
                </span>
                <span className="font-label text-[11px] text-on-surface-variant truncate">
                  {activeCase ? `Case #${activeCase.id.slice(-6)} • Open` : "Investigation Directory"}
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
              unfold_more
            </span>
          </Link>
        </div>

        {/* Navigation Section */}
        <div className="px-4">
          <div className="px-2 mb-2 font-label text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
            Evidentiary Workspace
          </div>
          <nav className="flex flex-col gap-1">
            <Link
              href={activeCase ? `/cases/${activeCase.id}` : "/cases"}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                pathname === "/cases" || isCaseDetail
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">chat_bubble</span>
              <span>Chat & Evidentiary Stream</span>
            </Link>

            <Link
              href="/cases"
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold ${
                pathname === "/cases" && !activeCase
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">folder_open</span>
              <span>Case Files Directory</span>
            </Link>
          </nav>
        </div>

        {/* Admin Supervision Section */}
        {user.role === "admin" && (
          <div className="px-4">
            <div className="px-2 mb-2 font-label text-[11px] uppercase tracking-wider text-secondary font-semibold flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-error">admin_panel_settings</span>
              <span>Root Administration</span>
            </div>
            <nav className="flex flex-col gap-1">
              <Link
                href="/cases?tab=personnel"
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-xs font-semibold text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[19px]">group</span>
                <span>Personnel &amp; Users</span>
              </Link>
            </nav>
          </div>
        )}
      </div>

      {/* Bottom Metadata & User Session */}
      <div className="px-4 flex flex-col gap-3">
        {/* User Profile Card */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-subtle">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center font-bold text-xs text-on-secondary-container shrink-0">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="font-label text-xs font-bold text-on-surface truncate">
                {user.name}
              </span>
              <span className={`text-[9px] uppercase font-bold font-mono px-1.5 py-0.2 rounded w-fit ${getRoleBadge(user.role)}`}>
                {user.role}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

