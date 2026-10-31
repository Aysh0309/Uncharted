"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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

interface AssignedCaseInfo {
  id: string;
  title: string;
  status: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "admin" | "investigator" | "viewer" | string;
  createdAt?: string;
  assignedCases?: AssignedCaseInfo[];
  assignedCount?: number;
}

function CasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "personnel" ? "personnel" : "cases";

  const [activeTab, setActiveTab] = useState<"cases" | "personnel">(initialTab);
  const [user, setUser] = useState<UserSession | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state for Cases
  const [caseSearchQuery, setCaseSearchQuery] = useState("");
  const [caseStatusFilter, setCaseStatusFilter] = useState<"all" | "active" | "cold" | "closed">("all");
  const [caseSortBy, setCaseSortBy] = useState<"newest" | "oldest" | "title">("newest");

  // Search & Filter state for Personnel (Admin view)
  const [personnelSearchQuery, setPersonnelSearchQuery] = useState("");
  const [personnelRoleFilter, setPersonnelRoleFilter] = useState<"all" | "investigator" | "viewer" | "admin">("all");

  // New Case Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // Assign Modal State (From Case)
  const [showAssignModal, setShowAssignModal] = useState<CaseItem | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);

  // Assign User to Case Modal State (From User card)
  const [targetUserForAssign, setTargetUserForAssign] = useState<UserItem | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState("");

  // Create User Modal State (Admin)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"investigator" | "viewer" | "admin">("investigator");
  const [creatingUser, setCreatingUser] = useState(false);

  // Sync tab from query params if URL changes
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "personnel") {
      setActiveTab("personnel");
    } else if (tabParam === "cases") {
      setActiveTab("cases");
    }
  }, [searchParams]);

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

  // Filtered & Sorted Cases
  const filteredCases = useMemo(() => {
    return cases
      .filter((c) => {
        // Status filter
        if (caseStatusFilter !== "all" && c.status !== caseStatusFilter) {
          return false;
        }

        // Search query filter
        if (!caseSearchQuery.trim()) return true;
        const q = caseSearchQuery.toLowerCase().trim();
        return (
          c.title.toLowerCase().includes(q) ||
          (c.description && c.description.toLowerCase().includes(q)) ||
          (c.summary && c.summary.toLowerCase().includes(q)) ||
          c.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (caseSortBy === "title") {
          return a.title.localeCompare(b.title);
        }
        if (caseSortBy === "oldest") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [cases, caseSearchQuery, caseStatusFilter, caseSortBy]);

  // Filtered Personnel
  const filteredPersonnel = useMemo(() => {
    return allUsers.filter((u) => {
      // Role filter
      if (personnelRoleFilter !== "all" && u.role !== personnelRoleFilter) {
        return false;
      }

      // Search query filter
      if (!personnelSearchQuery.trim()) return true;
      const q = personnelSearchQuery.toLowerCase().trim();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [allUsers, personnelSearchQuery, personnelRoleFilter]);

  // Personnel Metrics
  const metrics = useMemo(() => {
    const total = allUsers.length;
    const investigators = allUsers.filter((u) => u.role === "investigator").length;
    const viewers = allUsers.filter((u) => u.role === "viewer").length;
    const admins = allUsers.filter((u) => u.role === "admin").length;
    return { total, investigators, viewers, admins };
  }, [allUsers]);

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

  const handleAssignUserToCase = async (e: React.FormEvent) => {
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

  const handleAssignCaseToUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserForAssign || !selectedCaseId) return;

    setAssigning(true);
    try {
      const res = await fetch(`/api/cases/${selectedCaseId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserForAssign.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign case");

      setTargetUserForAssign(null);
      setSelectedCaseId("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignUser = async (caseId: string, userId: string, userName: string) => {
    const confirmed = window.confirm(`Remove ${userName} from this case?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/assign?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to unassign user");

      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to unassign user");
    }
  };

  const handleDeleteCase = async (caseItem: CaseItem) => {
    const confirmed = window.confirm(
      `Permanently delete case "${caseItem.title}"?\n\nThis will irreversibly delete this case file along with all of its notes, timeline events, tracked entities, and open questions.`
    );
    if (!confirmed) return;

    setDeletingCaseId(caseItem.id);
    try {
      const res = await fetch(`/api/cases/${caseItem.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete case");

      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete case");
    } finally {
      setDeletingCaseId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) return;

    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create user");

      setShowCreateUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("investigator");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (u: UserItem) => {
    if (u.id === user?.id) {
      alert("You cannot delete your own active administrator account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete account for ${u.name} (${u.email})?\n\nThey will lose access to all assigned cases.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/users?id=${u.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user");

      await fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete user");
    }
  };

  const getRoleBadgeClasses = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-error-container text-on-error-container border-error/20";
      case "investigator":
        return "bg-secondary-container text-on-secondary-container border-secondary/20";
      case "viewer":
        return "bg-surface-container-high text-on-surface-variant border-outline-variant/30";
      default:
        return "bg-surface-container text-on-surface border-outline-variant/20";
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-6">
      {/* Top Header & Admin Navigation Tabs */}
      <div className="space-y-4 pb-4 border-b border-outline-variant/30">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-label text-xs uppercase tracking-widest text-secondary font-semibold">
                CaseMemory Terminal • {cases.length} Files
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span className="font-label text-xs text-on-surface-variant font-medium">
                Multi-Tenant RBAC Active
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-2xl text-primary tracking-tight">
              {activeTab === "cases" ? "Active Case Directory" : "Personnel & Investigator Directory"}
            </h1>
            <p className="font-sans text-xs text-on-surface-variant max-w-xl">
              {user?.role === "admin"
                ? activeTab === "cases"
                  ? "Administrator root directory: Full visibility across all forensic case threads."
                  : "Supervisory console: Visible detectives, intelligence analysts, and case assignment controls."
                : user?.role === "investigator"
                ? "Investigator terminal: Access to assigned active threads with write privileges."
                : "Viewer terminal: Read-only access to assigned active threads."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeTab === "cases" && user && user.role !== "viewer" && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">add</span>
                <span>Open New Case</span>
              </button>
            )}

            {activeTab === "personnel" && user?.role === "admin" && (
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <span className="material-symbols-outlined text-[17px]">person_add</span>
                <span>Add Personnel</span>
              </button>
            )}
          </div>
        </div>

        {/* View Switcher Tabs (Only for Administrators) */}
        {user?.role === "admin" && (
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => {
                setActiveTab("cases");
                router.push("/cases?tab=cases");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-label text-xs font-bold transition-all cursor-pointer ${
                activeTab === "cases"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">folder_open</span>
              <span>Case Files</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === "cases" ? "bg-on-primary/20 text-on-primary" : "bg-outline-variant/30 text-on-surface"
                }`}
              >
                {cases.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab("personnel");
                router.push("/cases?tab=personnel");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-label text-xs font-bold transition-all cursor-pointer ${
                activeTab === "personnel"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">badge</span>
              <span>Personnel &amp; Users</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === "personnel" ? "bg-on-primary/20 text-on-primary" : "bg-outline-variant/30 text-on-surface"
                }`}
              >
                {allUsers.length}
              </span>
              <span className="text-[9px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.2 rounded bg-secondary-fixed text-on-secondary-fixed">
                Admin
              </span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-24 text-on-surface-variant text-xs font-label space-y-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading forensic directory...</p>
        </div>
      ) : activeTab === "cases" ? (
        /* ========================================================================= */
        /* TAB 1: CASES DIRECTORY WITH SEARCH BAR                                    */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Direct Search Bar & Filter Controls */}
          <div className="p-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Primary Search Input */}
              <div className="relative flex-1 w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[19px]">
                  search
                </span>
                <input
                  type="text"
                  value={caseSearchQuery}
                  onChange={(e) => setCaseSearchQuery(e.target.value)}
                  placeholder="Search case files directly by title, synopsis, working memory, or ID..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans transition-colors"
                />
                {caseSearchQuery && (
                  <button
                    onClick={() => setCaseSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                {(
                  [
                    { key: "all", label: "All Cases" },
                    { key: "active", label: "Active" },
                    { key: "cold", label: "Cold" },
                    { key: "closed", label: "Closed" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setCaseStatusFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-full font-label text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      caseStatusFilter === tab.key
                        ? "bg-secondary text-white shadow-xs"
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-1 shrink-0 w-full md:w-auto justify-end">
                <span className="font-label text-[11px] text-on-surface-variant">Sort:</span>
                <select
                  value={caseSortBy}
                  onChange={(e: any) => setCaseSortBy(e.target.value)}
                  className="bg-surface-container border border-outline-variant/30 rounded-xl px-2.5 py-1.5 text-xs text-on-surface font-label focus:outline-none cursor-pointer"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Alphabetical</option>
                </select>
              </div>
            </div>

            {/* Match Counter & Query Tag */}
            <div className="flex items-center justify-between text-[11px] font-label text-on-surface-variant pt-1">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-primary">{filteredCases.length}</strong> of {cases.length} case files
                </span>
                {caseSearchQuery && (
                  <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full flex items-center gap-1">
                    Query: "{caseSearchQuery}"
                    <button onClick={() => setCaseSearchQuery("")} className="hover:opacity-75 cursor-pointer">
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </span>
                )}
              </div>
              {caseStatusFilter !== "all" && (
                <span className="uppercase tracking-wider font-semibold text-secondary">
                  Filtered by: {caseStatusFilter}
                </span>
              )}
            </div>
          </div>

          {/* Cases List */}
          {filteredCases.length === 0 ? (
            <div className="text-center py-16 p-8 border border-dashed border-outline-variant/40 rounded-3xl bg-surface-container-low space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">folder_off</span>
              </div>
              <h3 className="font-headline font-bold text-sm text-primary">
                {caseSearchQuery || caseStatusFilter !== "all"
                  ? "No Cases Match Your Search Criteria"
                  : "No Assigned Cases Found"}
              </h3>
              <p className="font-sans text-xs text-on-surface-variant max-w-sm mx-auto">
                {caseSearchQuery || caseStatusFilter !== "all"
                  ? "Try adjusting your search terms or clearing status filters to find matching cases."
                  : user?.role === "admin"
                  ? "No cases exist yet. Click 'Open New Case' above to initialize the first case."
                  : "You are not assigned to any cases. Contact an administrator to be assigned."}
              </p>
              {(caseSearchQuery || caseStatusFilter !== "all") && (
                <button
                  onClick={() => {
                    setCaseSearchQuery("");
                    setCaseStatusFilter("all");
                  }}
                  className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label text-xs font-bold transition-colors cursor-pointer"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono font-bold text-secondary uppercase">
                          Case #{c.id.slice(-6)}
                        </span>
                        <h3 className="font-headline font-bold text-base text-primary group-hover:text-secondary transition-colors">
                          {c.title}
                        </h3>
                      </div>
                      <span
                        className={`font-label text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                          c.status === "active"
                            ? "bg-secondary-container text-on-secondary-container"
                            : c.status === "cold"
                            ? "bg-surface-container-high text-on-surface-variant"
                            : "bg-surface-container text-outline"
                        }`}
                      >
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
                          Working Memory Synopsis
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
                        {c.memberIds?.length || 1} personnel
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {user?.role === "admin" && (
                        <>
                          <button
                            onClick={() => setShowAssignModal(c)}
                            title="Assign member to case"
                            className="p-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">person_add</span>
                          </button>

                          <button
                            onClick={() => handleDeleteCase(c)}
                            disabled={deletingCaseId === c.id}
                            title="Delete case file"
                            className="p-1.5 rounded-xl bg-error-container/30 hover:bg-error-container text-on-error-container transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {deletingCaseId === c.id ? "sync" : "delete"}
                            </span>
                          </button>
                        </>
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
        </div>
      ) : (
        /* ========================================================================= */
        /* TAB 2: PERSONNEL & VISIBLE USERS (ADMIN VIEW)                             */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 space-y-1 shadow-subtle">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                Total Personnel
              </span>
              <div className="font-headline font-extrabold text-2xl text-primary">{metrics.total}</div>
              <span className="font-sans text-[10px] text-on-surface-variant">Registered in database</span>
            </div>

            <div className="p-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 space-y-1 shadow-subtle">
              <span className="font-label text-[10px] uppercase tracking-wider text-secondary font-bold">
                Investigators
              </span>
              <div className="font-headline font-extrabold text-2xl text-secondary">{metrics.investigators}</div>
              <span className="font-sans text-[10px] text-on-surface-variant">Read/write incident privileges</span>
            </div>

            <div className="p-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 space-y-1 shadow-subtle">
              <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">
                Intelligence Analysts
              </span>
              <div className="font-headline font-extrabold text-2xl text-on-surface">{metrics.viewers}</div>
              <span className="font-sans text-[10px] text-on-surface-variant">Read &amp; query privileges</span>
            </div>

            <div className="p-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 space-y-1 shadow-subtle">
              <span className="font-label text-[10px] uppercase tracking-wider text-error font-bold">
                Administrators
              </span>
              <div className="font-headline font-extrabold text-2xl text-error">{metrics.admins}</div>
              <span className="font-sans text-[10px] text-on-surface-variant">Full supervisory access</span>
            </div>
          </div>

          {/* Personnel Search & Role Filter Bar */}
          <div className="p-4 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[19px]">
                  search
                </span>
                <input
                  type="text"
                  value={personnelSearchQuery}
                  onChange={(e) => setPersonnelSearchQuery(e.target.value)}
                  placeholder="Search personnel by name, email, or role..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans transition-colors"
                />
                {personnelSearchQuery && (
                  <button
                    onClick={() => setPersonnelSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5 rounded cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                {(
                  [
                    { key: "all", label: "All Personnel" },
                    { key: "investigator", label: "Investigators" },
                    { key: "viewer", label: "Analysts" },
                    { key: "admin", label: "Admins" },
                  ] as const
                ).map((rf) => (
                  <button
                    key={rf.key}
                    onClick={() => setPersonnelRoleFilter(rf.key)}
                    className={`px-3 py-1.5 rounded-full font-label text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      personnelRoleFilter === rf.key
                        ? "bg-secondary text-white shadow-xs"
                        : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {rf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[11px] font-label text-on-surface-variant">
              Showing <strong className="text-primary">{filteredPersonnel.length}</strong> of {allUsers.length} users
            </div>
          </div>

          {/* Personnel Cards Grid */}
          {filteredPersonnel.length === 0 ? (
            <div className="text-center py-16 p-8 border border-dashed border-outline-variant/40 rounded-3xl bg-surface-container-low space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">person_off</span>
              </div>
              <h3 className="font-headline font-bold text-sm text-primary">No Personnel Match Your Filter</h3>
              <p className="font-sans text-xs text-on-surface-variant max-w-sm mx-auto">
                No users found with the current search query or role filter.
              </p>
              <button
                onClick={() => {
                  setPersonnelSearchQuery("");
                  setPersonnelRoleFilter("all");
                }}
                className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label text-xs font-bold transition-colors cursor-pointer"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPersonnel.map((u) => {
                const isCurrentUser = u.id === user?.id;

                return (
                  <div
                    key={u.id}
                    className="p-5 rounded-3xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle hover:shadow-card transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* User Identity Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-secondary-container text-on-secondary-container font-headline font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-headline font-bold text-sm text-primary truncate">{u.name}</h4>
                              {isCurrentUser && (
                                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant">
                                  YOU
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[11px] text-on-surface-variant truncate">{u.email}</p>
                          </div>
                        </div>

                        <span
                          className={`font-label text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border shrink-0 ${getRoleBadgeClasses(
                            u.role
                          )}`}
                        >
                          {u.role}
                        </span>
                      </div>

                      {/* Registration Date */}
                      {u.createdAt && (
                        <div className="text-[10px] font-label text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                          <span>Registered: {new Date(u.createdAt).toLocaleDateString()}</span>
                        </div>
                      )}

                      {/* Assigned Cases Section */}
                      <div className="pt-2 border-t border-outline-variant/20 space-y-1.5">
                        <div className="flex items-center justify-between font-label text-[11px] font-bold text-primary">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px] text-secondary">folder_special</span>
                            Assigned Case Files
                          </span>
                          <span className="text-secondary font-mono text-[10px]">
                            {u.role === "admin" ? "All Cases (Root)" : `${u.assignedCases?.length || 0} assigned`}
                          </span>
                        </div>

                        {u.role === "admin" ? (
                          <div className="p-2.5 rounded-2xl bg-surface-container-low text-[11px] font-sans text-on-surface-variant">
                            🛡️ Full administrative root access to all past and future cases.
                          </div>
                        ) : u.assignedCases && u.assignedCases.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                            {u.assignedCases.map((ac) => (
                              <div
                                key={ac.id}
                                className="group/pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-surface-container text-[11px] font-label text-on-surface border border-outline-variant/20"
                              >
                                <Link
                                  href={`/cases/${ac.id}`}
                                  className="hover:underline truncate max-w-[150px]"
                                  title={ac.title}
                                >
                                  {ac.title}
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => handleUnassignUser(ac.id, u.id, u.name)}
                                  title="Unassign from case"
                                  className="text-on-surface-variant hover:text-error opacity-60 hover:opacity-100 cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[13px]">close</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2 rounded-2xl bg-surface-container-low text-[10px] font-sans text-on-surface-variant italic">
                            No active cases assigned yet.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Admin Actions */}
                    <div className="pt-3 border-t border-outline-variant/20 flex items-center justify-between">
                      {u.role !== "admin" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetUserForAssign(u);
                            setSelectedCaseId("");
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-primary font-label text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[15px]">add_link</span>
                          <span>Assign Case</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-label text-secondary font-medium italic">
                          Supervisor Account
                        </span>
                      )}

                      {!isCurrentUser && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u)}
                          title="Remove user account"
                          className="p-1.5 rounded-xl bg-error-container/30 hover:bg-error-container text-on-error-container transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[16px]">person_remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEW CASE                                                  */}
      {/* ========================================================================= */}
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
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
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
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Description &amp; Synopsis</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Synopsis of incident facts and initial jurisdiction..."
                  rows={3}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {creating ? "Opening..." : "Create Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ASSIGN MEMBER TO CASE (From Case Card)                          */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-float animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-base text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">person_add</span>
                Assign Member to Case
              </h3>
              <button
                onClick={() => setShowAssignModal(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="font-sans text-xs text-on-surface-variant">
              Grant investigation access to <strong className="text-primary">"{showAssignModal.title}"</strong>.
            </p>

            <form onSubmit={handleAssignUserToCase} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Select Personnel</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-label cursor-pointer"
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
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedUserId}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {assigning ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ASSIGN CASE TO USER (From User Card)                            */}
      {/* ========================================================================= */}
      {targetUserForAssign && (
        <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-float animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-base text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">add_link</span>
                Assign Case to Personnel
              </h3>
              <button
                onClick={() => setTargetUserForAssign(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <p className="font-sans text-xs text-on-surface-variant">
              Select a case to assign to <strong className="text-primary">{targetUserForAssign.name}</strong> ({targetUserForAssign.role}).
            </p>

            <form onSubmit={handleAssignCaseToUser} className="space-y-4">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Select Case File</label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-label cursor-pointer"
                >
                  <option value="">-- Choose Case --</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetUserForAssign(null)}
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedCaseId}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {assigning ? "Assigning..." : "Assign Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CREATE NEW USER (ADMIN)                                         */}
      {/* ========================================================================= */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-float animate-slideUp">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-base text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">person_add</span>
                Onboard New Personnel
              </h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Full Name &amp; Title</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Det. Marcus Vance"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Official Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="mvance@casememory.local"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Initial Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Operational Role</label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-xl px-3.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-label cursor-pointer"
                >
                  <option value="investigator">Investigator (Read/Write assigned cases)</option>
                  <option value="viewer">Viewer / Analyst (Read-only questions)</option>
                  <option value="admin">Administrator (Supervisory root access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-16 text-center text-xs font-label text-on-surface-variant">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading forensic terminal workspace...
        </div>
      }
    >
      <CasesContent />
    </Suspense>
  );
}
