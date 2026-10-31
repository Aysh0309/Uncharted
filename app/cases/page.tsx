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

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "admin" | "investigator" | "viewer" | string;
  assignedCases?: Array<{ id: string; title: string }>;
}

function CasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") === "personnel" ? "users" : searchParams.get("tab") || "cases";

  const [activeTab, setActiveTab] = useState<"cases" | "users">(tabParam === "users" ? "users" : "cases");
  const [user, setUser] = useState<UserSession | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [caseSearch, setCaseSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  // Modals
  const [showCreateCase, setShowCreateCase] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseDesc, setNewCaseDesc] = useState("");
  const [savingCase, setSavingCase] = useState(false);

  // Admin Add User Modal
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"investigator" | "viewer" | "admin">("investigator");
  const [savingUser, setSavingUser] = useState(false);

  // Assign user from Case card
  const [assignTargetCase, setAssignTargetCase] = useState<CaseItem | null>(null);
  const [assignSelectedUser, setAssignSelectedUser] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Selected User Modal for Admin click
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<string>("");
  const [assignCaseToUser, setAssignCaseToUser] = useState<string>("");
  const [userActionLoading, setUserActionLoading] = useState(false);

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

          // Keep selectedUser fresh if open
          if (selectedUser) {
            const updated = usersData.users.find((u: UserItem) => u.id === selectedUser.id);
            if (updated) setSelectedUser(updated);
          }
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

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "personnel" || t === "users") {
      setActiveTab("users");
    } else {
      setActiveTab("cases");
    }
  }, [searchParams]);

  // Open user modal and initialize edit state
  const handleOpenUserModal = (target: UserItem) => {
    setSelectedUser(target);
    setEditRole(target.role);
    setAssignCaseToUser("");
  };

  // Filter cases directly by search query
  const filteredCases = useMemo(() => {
    if (!caseSearch.trim()) return cases;
    const q = caseSearch.toLowerCase().trim();
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [cases, caseSearch]);

  // Filter users directly by search query
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase().trim();
    return allUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [allUsers, userSearch]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseTitle.trim()) return;

    setSavingCase(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newCaseTitle.trim(),
          description: newCaseDesc.trim(),
          memberIds: [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create case");

      setShowCreateCase(false);
      setNewCaseTitle("");
      setNewCaseDesc("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCase(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) return;

    setSavingUser(true);
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

      setShowCreateUser(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("investigator");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleAssignMemberToCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetCase || !assignSelectedUser) return;

    setAssigning(true);
    try {
      const res = await fetch(`/api/cases/${assignTargetCase.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assignSelectedUser }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign user");

      setAssignTargetCase(null);
      setAssignSelectedUser("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAssigning(false);
    }
  };

  // Assign user to a case from inside User Modal
  const handleAssignSelectedUserToCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !assignCaseToUser) return;

    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/cases/${assignCaseToUser}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign case");

      setAssignCaseToUser("");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  // Unassign user from case
  const handleUnassignUser = async (caseId: string, userId: string) => {
    if (!confirm("Remove user from this case?")) return;

    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/assign?userId=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to unassign user");

      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  // Change user role
  const handleSaveRole = async () => {
    if (!selectedUser || editRole === selectedUser.role) return;

    setUserActionLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, role: editRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update role");

      await fetchData();
      alert(`Role updated to ${editRole}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  // Delete user
  const handleDeleteUser = async (u: UserItem) => {
    if (u.id === user?.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!confirm(`Permanently delete account for ${u.name}?`)) return;

    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users?id=${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user");

      setSelectedUser(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUserActionLoading(false);
    }
  };

  const handleDeleteCase = async (c: CaseItem) => {
    if (!confirm(`Delete case "${c.title}"?`)) return;
    try {
      const res = await fetch(`/api/cases/${c.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete case");
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") return "bg-red-100 text-red-800 border-red-200";
    if (role === "investigator") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/30">
        <div>
          <h1 className="font-headline font-bold text-2xl text-primary">
            {activeTab === "cases" ? "Case Directory" : "Users & Investigators"}
          </h1>
          <p className="font-sans text-xs text-on-surface-variant">
            {user?.role === "admin"
              ? "Administrator Access: Oversee cases and manage investigators."
              : "Investigative Terminal: View and manage your cases."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <div className="flex items-center bg-surface-container rounded-xl p-1 border border-outline-variant/30">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("cases");
                  router.push("/cases");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "cases"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Cases ({cases.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("users");
                  router.push("/cases?tab=users");
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "users"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                Users ({allUsers.length})
              </button>
            </div>
          )}

          {activeTab === "cases" && user?.role !== "viewer" && (
            <button
              onClick={() => setShowCreateCase(true)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>New Case</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-xs text-on-surface-variant">
          Loading...
        </div>
      ) : activeTab === "cases" ? (
        /* ================= 1. CASES VIEW WITH SEARCH BAR ================= */
        <div className="space-y-4">
          {/* Direct Search Bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
              search
            </span>
            <input
              type="text"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Search cases directly by title, description, or ID..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
            />
            {caseSearch && (
              <button
                onClick={() => setCaseSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Search Result Count */}
          {caseSearch && (
            <div className="text-[11px] text-on-surface-variant">
              Found {filteredCases.length} matching case(s) for "{caseSearch}"
            </div>
          )}

          {/* Cases List */}
          {filteredCases.length === 0 ? (
            <div className="text-center py-16 p-8 border border-dashed border-outline-variant/30 rounded-2xl bg-surface-container-low text-xs text-on-surface-variant">
              {caseSearch ? `No cases found matching "${caseSearch}".` : "No cases available."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-primary">{c.title}</h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant line-clamp-2">
                      {c.description || "No description."}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-on-surface-variant">
                    <span>{c.memberIds?.length || 1} assigned</span>

                    <div className="flex items-center gap-1.5">
                      {user?.role === "admin" && (
                        <>
                          <button
                            onClick={() => {
                              setAssignTargetCase(c);
                              setAssignSelectedUser("");
                            }}
                            title="Assign Investigator"
                            className="p-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">person_add</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCase(c)}
                            title="Delete Case"
                            className="p-1 rounded-lg bg-error-container/40 hover:bg-error-container text-on-error-container cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                          </button>
                        </>
                      )}

                      <Link
                        href={`/cases/${c.id}`}
                        className="px-3 py-1 rounded-lg bg-primary hover:bg-primary-container text-on-primary text-xs font-bold"
                      >
                        Inspect
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ================= 2. ADMIN USERS & INVESTIGATORS VIEW ================= */
        <div className="space-y-4">
          {/* User Search Bar & Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search users by name, email, or role..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface text-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowCreateUser(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold font-label flex items-center justify-center gap-1.5 shadow-xs hover:bg-primary-container transition-all cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[17px]">person_add</span>
              <span>Add Personnel</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant font-medium">
            <span className="material-symbols-outlined text-[14px]">info</span>
            <span>Click any user row to modify permissions, clearance level, or assigned cases</span>
          </div>

          {/* Users Table / List */}
          <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-surface-container-low border-b border-outline-variant/30 font-label font-bold text-on-surface-variant">
                <tr>
                  <th className="p-3">User (Click to Open)</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Assigned Cases</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => handleOpenUserModal(u)}
                    className="hover:bg-surface-container cursor-pointer transition-colors group"
                  >
                    <td className="p-3 font-bold text-primary flex items-center gap-2 group-hover:text-secondary">
                      <div className="w-7 h-7 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold text-on-secondary-container">
                        {u.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span>{u.name}</span>
                        {u.id === user?.id && (
                          <span className="text-[9px] text-on-surface-variant font-normal">(You)</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-on-surface-variant font-mono text-[11px]">{u.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-on-surface-variant">
                      {u.role === "admin" ? (
                        <span className="text-[11px] italic">All Cases (Root Access)</span>
                      ) : u.assignedCases && u.assignedCases.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.assignedCases.map((ac) => (
                            <span
                              key={ac.id}
                              className="px-2 py-0.5 rounded bg-surface-container text-[10px] text-primary"
                            >
                              {ac.title}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-on-surface-variant/60">No cases assigned</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenUserModal(u);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container group-hover:bg-primary group-hover:text-on-primary text-primary text-xs font-bold transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[15px]">manage_accounts</span>
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: USER DETAILS & MANAGEMENT ================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-float">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-secondary-container flex items-center justify-center text-base font-bold text-on-secondary-container">
                  {selectedUser.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-base text-primary">{selectedUser.name}</h3>
                  <p className="text-xs text-on-surface-variant font-mono">{selectedUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Role Modifier */}
            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 space-y-2">
              <label className="text-xs font-bold text-on-surface block">User Role &amp; Permissions</label>
              <div className="flex items-center gap-2">
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs font-sans cursor-pointer"
                >
                  <option value="investigator">Investigator (Read &amp; Write cases)</option>
                  <option value="viewer">Viewer (Read-only case queries)</option>
                  <option value="admin">Administrator (Full root access)</option>
                </select>

                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={userActionLoading || editRole === selectedUser.role}
                  className="px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-40 cursor-pointer"
                >
                  Save Role
                </button>
              </div>
            </div>

            {/* Assigned Cases Section */}
            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/20 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-on-surface block">
                  Assigned Case Files ({selectedUser.assignedCases?.length || 0})
                </label>
                {selectedUser.role === "admin" && (
                  <span className="text-[10px] text-secondary font-bold">Admin has access to all cases</span>
                )}
              </div>

              {selectedUser.assignedCases && selectedUser.assignedCases.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedUser.assignedCases.map((ac) => (
                    <div
                      key={ac.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low text-xs"
                    >
                      <Link
                        href={`/cases/${ac.id}`}
                        className="font-bold text-primary hover:underline truncate max-w-xs"
                      >
                        {ac.title}
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleUnassignUser(ac.id, selectedUser.id)}
                        disabled={userActionLoading}
                        title="Remove from this case"
                        className="text-error hover:bg-error-container/30 px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-on-surface-variant italic">
                  Not currently assigned to any cases.
                </div>
              )}

              {/* Assign to Case Dropdown */}
              {selectedUser.role !== "admin" && (
                <form onSubmit={handleAssignSelectedUserToCase} className="pt-2 border-t border-outline-variant/20 flex gap-2">
                  <select
                    value={assignCaseToUser}
                    onChange={(e) => setAssignCaseToUser(e.target.value)}
                    required
                    className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl px-3 py-2 text-xs cursor-pointer"
                  >
                    <option value="">-- Assign to another case --</option>
                    {cases
                      .filter((c) => !selectedUser.assignedCases?.some((ac) => ac.id === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>

                  <button
                    type="submit"
                    disabled={userActionLoading || !assignCaseToUser}
                    className="px-3 py-2 rounded-xl bg-secondary text-white text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Assign
                  </button>
                </form>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              {selectedUser.id !== user?.id ? (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(selectedUser)}
                  disabled={userActionLoading}
                  className="px-3 py-1.5 rounded-xl text-error hover:bg-error-container/40 text-xs font-bold cursor-pointer"
                >
                  Delete Account
                </button>
              ) : (
                <span className="text-[11px] text-on-surface-variant italic">Current logged in account</span>
              )}

              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Case */}
      {showCreateCase && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-float">
            <h3 className="font-bold text-base text-primary">Open New Case</h3>
            <form onSubmit={handleCreateCase} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Title</label>
                <input
                  type="text"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="Case title"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Description</label>
                <textarea
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  placeholder="Case details..."
                  rows={3}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCase(false)}
                  className="px-3 py-1.5 text-xs text-on-surface-variant font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCase}
                  className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
                >
                  {savingCase ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Personnel (Admin Only) */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-float">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <span>Add Personnel</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateUser(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Full Name</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Det. Alex Cross"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Official Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="alex.cross@casememory.local"
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Temporary Password</label>
                <input
                  type="password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Assigned Clearance Role</label>
                <select
                  value={newUserRole}
                  onChange={(e: any) => setNewUserRole(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs text-on-surface font-sans cursor-pointer"
                >
                  <option value="investigator">Investigator (Read &amp; Write cases)</option>
                  <option value="viewer">Viewer (Read-only case queries)</option>
                  <option value="admin">Administrator (Full case &amp; user access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {savingUser ? "Adding..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Member from Case Card */}
      {assignTargetCase && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-float">
            <h3 className="font-bold text-base text-primary">
              Assign Investigator to "{assignTargetCase.title}"
            </h3>
            <form onSubmit={handleAssignMemberToCase} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">Choose Investigator or Viewer</label>
                <select
                  value={assignSelectedUser}
                  onChange={(e) => setAssignSelectedUser(e.target.value)}
                  required
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-3 py-2 text-xs cursor-pointer"
                >
                  <option value="">-- Select user --</option>
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
                  onClick={() => setAssignTargetCase(null)}
                  className="px-3 py-1.5 text-xs text-on-surface-variant font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !assignSelectedUser}
                  className="px-4 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
                >
                  {assigning ? "Assigning..." : "Assign"}
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
    <Suspense fallback={<div className="p-8 text-center text-xs">Loading...</div>}>
      <CasesContent />
    </Suspense>
  );
}
