"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) throw new Error("Authentication required");
      const meData = await meRes.json();
      setUser(meData.user);

      const casesRes = await fetch("/api/cases");
      const casesData = await casesRes.json();
      if (!casesRes.ok) throw new Error(casesData.message || "Failed to load cases");
      setCases(casesData.cases || []);

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
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-label text-xs uppercase tracking-widest text-secondary font-semibold">
              Case Memory Directory • {cases.length} Files
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="font-label text-xs text-on-surface-variant font-medium">
              Multi-tenant RBAC Scoped
            </span>
          </div>
          <h1 className="font-headline font-bold text-2xl text-primary tracking-tight">
            Active Case Directory
          </h1>
          <p className="font-sans text-xs text-on-surface-variant max-w-xl">
            {user?.role === "admin"
              ? "Administrator root directory: Full visibility across all forensic case threads."
              : user?.role === "investigator"
              ? "Investigator terminal: Access to assigned active threads with write privileges."
              : "Viewer terminal: Read-only access to assigned active threads."}
          </p>
        </div>

        {user && user.role !== "viewer" && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-semibold transition-all shadow-sm cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            <span>Open New Case</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-on-surface-variant text-xs font-label">
          Loading assigned case files...
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-20 p-8 border border-dashed border-outline-variant/40 rounded-3xl bg-surface-container-low space-y-2">
          <div className="w-10 h-10 mx-auto rounded-2xl bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[20px]">folder_off</span>
          </div>
          <h3 className="font-headline font-bold text-sm text-primary">No Assigned Cases Found</h3>
          <p className="font-sans text-xs text-on-surface-variant max-w-sm mx-auto">
            {user?.role === "admin"
              ? "No cases exist yet. Click 'Open New Case' to initialize the first case."
              : "You are not assigned to any cases. Contact an administrator to be assigned."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cases.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-headline font-bold text-base text-primary group-hover:text-secondary transition-colors">
                    {c.title}
                  </h3>
                  <span className="font-label text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                    {c.status}
                  </span>
                </div>

                <p className="font-sans text-xs text-on-surface-variant line-clamp-2">
                  {c.description || "No description provided."}
                </p>

                {c.summary && (
                  <div className="p-3 rounded-2xl bg-surface-container-low text-xs text-on-surface-variant space-y-1">
                    <span className="font-label text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-secondary">psychology</span>
                      Working Memory
                    </span>
                    <p className="italic line-clamp-2 text-[11px] leading-relaxed">
                      "{c.summary}"
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs font-label text-on-surface-variant">
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">group</span>
                    {c.memberIds?.length || 1} assigned
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {user?.role === "admin" && (
                    <button
                      onClick={() => setShowAssignModal(c)}
                      title="Assign member to case"
                      className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">person_add</span>
                    </button>
                  )}

                  <Link
                    href={`/cases/${c.id}`}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-primary hover:bg-primary-container text-on-primary text-xs font-bold transition-all shadow-xs"
                  >
                    <span>Inspect</span>
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-float animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-base text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">create_new_folder</span>
                Open New Case File
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Case Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. The Waterfront Warehouse Incident"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Synopsis of incident facts and initial jurisdiction..."
                  rows={3}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm"
                >
                  {creating ? "Opening..." : "Create Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-float animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-base text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">person_add</span>
                Assign Member
              </h3>
              <button
                onClick={() => setShowAssignModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="font-sans text-xs text-on-surface-variant">
              Grant investigation access to <span className="font-bold text-primary">"{showAssignModal.title}"</span>.
            </p>

            <form onSubmit={handleAssignUser} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Select User</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-label"
                >
                  <option value="">-- Choose User --</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) — {u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(null)}
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedUserId}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm"
                >
                  {assigning ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
