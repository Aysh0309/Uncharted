"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderLock,
  Plus,
  Users,
  Calendar,
  ChevronRight,
  ShieldAlert,
  UserPlus,
  X,
  FileText,
} from "lucide-react";
import { UserSession } from "@/lib/auth";

interface CaseItem {
  id: string;
  title: string;
  description: string;
  status: "active" | "closed" | "cold";
  memberIds: string[];
  summary: string;
  createdAt: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function CasesPage() {
  const [user, setUser] = useState<UserSession | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Case Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Assign Modal State (Admin)
  const [showAssignModal, setShowAssignModal] = useState<CaseItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch user session
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) throw new Error("Authentication required");
      const meData = await meRes.json();
      setUser(meData.user);

      // Fetch accessible cases
      const casesRes = await fetch("/api/cases");
      const casesData = await casesRes.json();
      if (!casesRes.ok) throw new Error(casesData.message || "Failed to load cases");
      setCases(casesData.cases || []);

      // If admin, fetch all users for assignment
      if (meData.user.role === "admin") {
        const usersRes = await fetch("/api/admin/users");
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setAllUsers(usersData.users || []);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          memberIds: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create case");

      setShowCreateModal(false);
      setNewTitle("");
      setNewDescription("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal || !selectedUserId) return;

    setAssigning(true);
    try {
      const res = await fetch(`/api/cases/${showAssignModal.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign user");

      setShowAssignModal(null);
      setSelectedUserId("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <FolderLock className="w-5 h-5 text-amber-400" />
            Active Investigation Files
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {user?.role === "admin"
              ? "Administrator Directory: You have root visibility over all system case files."
              : user?.role === "investigator"
              ? "Investigator Terminal: Access to your assigned case files (Read/Write enabled)."
              : "Viewer Terminal: Access to your assigned case files (Read-only access)."}
          </p>
        </div>

        {user && user.role !== "viewer" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs tracking-wide transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Case File
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500 text-xs">
          Loading authorized investigation files...
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 p-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/20 space-y-3">
          <div className="h-10 w-10 mx-auto rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
            <FolderLock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-medium text-white">No Assigned Cases Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            {user?.role === "admin"
              ? "No cases exist yet. Click 'New Case File' to start an investigation."
              : "You are not assigned to any case files yet. Contact an administrator to be assigned."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700/80 transition flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-white group-hover:text-amber-400 transition">
                    {c.title}
                  </h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2">
                  {c.description || "No description provided."}
                </p>
                {c.summary && (
                  <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/60 text-[11px] text-zinc-300">
                    <span className="text-amber-400 font-semibold block mb-0.5">
                      Working Memory Summary:
                    </span>
                    <span className="line-clamp-2 italic">{c.summary}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 font-mono">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    {c.memberIds?.length || 1} assigned
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {user?.role === "admin" && (
                    <button
                      onClick={() => setShowAssignModal(c)}
                      title="Assign member to case"
                      className="p-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <Link
                    href={`/cases/${c.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
                  >
                    <span>Inspect</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                Open New Case File
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Case Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. The Waterfront Warehouse Incident"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Brief synopsis of reported facts and jurisdiction..."
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Case Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-amber-400" />
                Assign Member to Case
              </h3>
              <button
                onClick={() => setShowAssignModal(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Assign an investigator or viewer to{" "}
              <span className="text-white font-medium">"{showAssignModal.title}"</span>.
            </p>

            <form onSubmit={handleAssignUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">-- Choose User --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedUserId}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold disabled:opacity-50"
                >
                  {assigning ? "Assigning..." : "Assign to Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

