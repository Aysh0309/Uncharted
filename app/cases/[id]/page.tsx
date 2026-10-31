"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { UserSession } from "@/lib/auth";
import { NoteDrawer } from "@/components/note-drawer";
import { FormattedEvidentiaryText } from "@/components/formatted-evidentiary-text";
import { ToastContainer, ToastMessage } from "@/components/toast";

interface CaseEvent {
  id: string;
  noteId: string;
  what: string;
  who: string[];
  whenText: string;
  whenISO: string | null;
  where: string | null;
  confidence: number;
}

interface CaseEntity {
  id: string;
  name: string;
  aliases: string[];
  type: "person" | "vehicle" | "place" | "phone" | "object";
  role: string;
  alibiStatus: "unknown" | "claimed" | "verified" | "broken";
  alibiDetails?: string;
  eventIds: string[];
  noteIds: string[];
}

interface SuspectScore {
  name: string;
  type: string;
  role: string;
  totalScore: number;
  breakdown: {
    linkedEvents: { points: number; count: number; description: string };
    proximity: { points: number; matched: boolean; description: string };
    motiveOrIncrimination: { points: number; matched: boolean; description: string };
    alibi: { points: number; status: string; description: string };
  };
}

interface EvidentiaryGap {
  type: string;
  description: string;
  noteId?: string;
}

interface DiscrepancyItem {
  entityType: string;
  field: string;
  existingValue: string;
  newValue: string;
  entityName: string;
  description: string;
  resolutionOptions: string[];
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  type?: "fact" | "question" | "both";
  noteId?: string;
  citations?: Array<{ noteId: string; snippet?: string }>;
  timestamp: string;
  extractedStats?: {
    eventsSaved?: number;
    entitiesCount?: number;
    openQuestionsSaved?: number;
  };
  discrepancies?: DiscrepancyItem[];
  confirmationPrompt?: string;
}

export default function CaseWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingCase, setDeletingCase] = useState(false);

  // Case Data
  const [caseMeta, setCaseMeta] = useState<any>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [entities, setEntities] = useState<CaseEntity[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [suspects, setSuspects] = useState<SuspectScore[]>([]);
  const [gaps, setGaps] = useState<EvidentiaryGap[]>([]);

  // View States
  const [showSummary, setShowSummary] = useState(false);
<<<<<<< HEAD
  const [activeRightTab, setActiveRightTab] = useState<"timeline" | "suspects" | "entities" | "gaps">("suspects");

  // Entity Quick Editor Modal State
  const [editingEntity, setEditingEntity] = useState<CaseEntity | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("other");
  const [editAlibiStatus, setEditAlibiStatus] = useState<string>("unknown");
  const [editAlibiDetails, setEditAlibiDetails] = useState("");
  const [editAliases, setEditAliases] = useState("");
  const [savingEntity, setSavingEntity] = useState(false);
=======
  const [activeRightTab, setActiveRightTab] = useState<"timeline" | "suspects" | "gaps">("timeline");
  const [mobileTab, setMobileTab] = useState<"chat" | "timeline">("chat");

  // Adjustable Split Pane State
  const [splitRatio, setSplitRatio] = useState<number>(55);
  const [isDragging, setIsDragging] = useState(false);
  const [isLgScreen, setIsLgScreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const workspaceContainerRef = useRef<HTMLDivElement>(null);
>>>>>>> refs/remotes/origin/main

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Note Drawer State
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "success" | "error" | "info", message: string | any) => {
    let cleanMsg = message;
    if (typeof message === "string" && message.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cleanMsg = parsed.map((p) => p.message || p.code || "Validation error").join("; ");
        }
      } catch {}
    } else if (typeof message === "object") {
      cleanMsg = message?.message || "Execution notice";
    }
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message: cleanMsg }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const loadCaseData = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) throw new Error("Authentication required");
      const meData = await meRes.json();
      setUser(meData.user);

      const caseRes = await fetch(`/api/cases/${caseId}`);
      const data = await caseRes.json();
      if (!caseRes.ok) throw new Error(data.message || "Failed to load case context");

      setCaseMeta(data.case);
      setEvents(data.events || []);
      setEntities(data.entities || []);
      setNotes(data.notes || []);
      setSuspects(data.suspects || []);
      setGaps(data.gaps || []);

      if (messages.length === 0 && data.queries && data.queries.length > 0) {
        const history: ChatMessage[] = [];
        for (const q of data.queries) {
          history.push({
            id: `q-usr-${q.id}`,
            sender: "user",
            text: q.question,
            timestamp: q.createdAt,
          });
          history.push({
            id: `q-ast-${q.id}`,
            sender: "assistant",
            text: q.answer,
            type: "question",
            citations: q.citations,
            timestamp: q.createdAt,
          });
        }
        setMessages(history);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting]);

  // Handle client screen sizing and restore saved split ratio
  useEffect(() => {
    setMounted(true);
    const checkScreen = () => {
      setIsLgScreen(window.innerWidth >= 1024);
    };
    checkScreen();
    window.addEventListener("resize", checkScreen);

    try {
      const saved = localStorage.getItem("casememory_split_ratio");
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 20 && parsed <= 80) {
          setSplitRatio(parsed);
        }
      }
    } catch {}

    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  // Window pointer event listener for smooth drag-to-resize
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!workspaceContainerRef.current) return;
      const rect = workspaceContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const offsetX = e.clientX - rect.left;
      const pct = (offsetX / rect.width) * 100;
      // Clamp split ratio safely between 20% and 80%
      const clamped = Math.max(20, Math.min(80, pct));
      setSplitRatio(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    // Suppress document text selection and force resize cursor
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // Persist split ratio preference
  useEffect(() => {
    if (mounted && !isDragging) {
      try {
        localStorage.setItem("casememory_split_ratio", splitRatio.toFixed(1));
      } catch {}
    }
  }, [isDragging, splitRatio, mounted]);

  const handleSplitterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSplitRatio((prev) => Math.max(20, Math.round(prev - 4)));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSplitRatio((prev) => Math.min(80, Math.round(prev + 4)));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSplitRatio(20);
    } else if (e.key === "End") {
      e.preventDefault();
      setSplitRatio(80);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSplitRatio(55);
    }
  };

  const handleDeleteCase = async () => {
    const confirmed = window.confirm(
      `Permanently delete "${caseMeta?.title || "this case"}"?\n\nThis will purge the classified case file along with all evidence notes, chronological events, and tracked POI entities.`
    );
    if (!confirmed) return;

    setDeletingCase(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete case");

      addToast("success", "Case purged from secure memory");
      router.push("/cases");
      router.refresh();
    } catch (err: any) {
      addToast("error", err.message || "Purge failed");
      setDeletingCase(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || submitting) return;

    const userMsg: ChatMessage = {
      id: `msg-usr-${Date.now()}`,
      sender: "user",
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setSubmitting(true);

    try {
      const res = await fetch(`/api/cases/${caseId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to process classified entry");
      }

      if (data.type === "fact") {
        const assistantMsg: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          sender: "assistant",
<<<<<<< HEAD
          text: data.message || `Extracted ${data.eventsSaved} event(s) and synchronized ${
=======
          text: `Evidentiary intake complete: Extracted ${data.eventsSaved} timeline event(s) and synchronized ${
>>>>>>> refs/remotes/origin/main
            data.entitiesCreated + data.entitiesUpdated
          } POI entity record(s) into case memory vault.`,
          type: "fact",
          noteId: data.noteId,
          extractedStats: {
            eventsSaved: data.eventsSaved,
            entitiesCount: data.entitiesCreated + data.entitiesUpdated,
          },
          discrepancies: data.discrepancies,
          confirmationPrompt: data.confirmationPrompt,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addToast("success", `Evidence logged as Exhibit Note #${data.noteId.slice(-6).toUpperCase()}`);
      } else if (data.type === "question") {
        const assistantMsg: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          sender: "assistant",
          text: data.answer,
          type: "question",
          citations: data.citations,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addToast("info", "Retrieved from verified case memory");
      } else if (data.type === "both") {
        const assistantMsg: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          sender: "assistant",
          text: data.answer,
          type: "both",
          noteId: data.ingested?.noteId,
          citations: data.citations,
          discrepancies: data.discrepancies,
          confirmationPrompt: data.confirmationPrompt,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addToast("success", "Evidence archived & query answered");
      }

      await loadCaseData();
    } catch (err: any) {
      addToast("error", err.message || "Execution error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEntityEditor = (ent: CaseEntity) => {
    setEditingEntity(ent);
    setEditName(ent.name);
    setEditRole(ent.role || "other");
    setEditAlibiStatus(ent.alibiStatus || "unknown");
    setEditAlibiDetails(ent.alibiDetails || "");
    setEditAliases((ent.aliases || []).join(", "));
  };

  const handleSaveEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntity) return;
    try {
      setSavingEntity(true);
      const res = await fetch(`/api/cases/${caseId}/entities`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId: editingEntity.id,
          name: editName,
          role: editRole,
          alibiStatus: editAlibiStatus,
          alibiDetails: editAlibiDetails,
          aliases: editAliases.split(",").map((a) => a.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update entity");

      addToast("success", `Updated ${editName} (Alibi: ${editAlibiStatus})`);
      setEditingEntity(null);
      await loadCaseData();
    } catch (err: any) {
      addToast("error", err.message || "Update failed");
    } finally {
      setSavingEntity(false);
    }
  };

  const handleConfirmDiscrepancy = async (d: DiscrepancyItem, chosenOption?: string) => {
    try {
      if (d.field === "alibiStatus") {
        const targetEntity = entities.find(
          (e) => e.name.toLowerCase() === d.entityName.toLowerCase()
        );
        if (targetEntity) {
          const res = await fetch(`/api/cases/${caseId}/entities`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entityId: targetEntity.id,
              alibiStatus: d.newValue,
            }),
          });
          if (!res.ok) throw new Error("Failed to update alibi");
          addToast("success", `Updated ${d.entityName}'s alibi to "${d.newValue}"`);
          await loadCaseData();
          return;
        }
      }

      const targetEntity = entities.find(
        (e) =>
          e.name.toLowerCase() === d.existingValue.toLowerCase() ||
          e.name.toLowerCase() === d.entityName.toLowerCase()
      );
      if (targetEntity) {
        const res = await fetch(`/api/cases/${caseId}/entities`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entityId: targetEntity.id,
            name: d.newValue,
            aliases: [...(targetEntity.aliases || []), d.existingValue],
          }),
        });
        if (!res.ok) throw new Error("Failed to update discrepancy record");
        addToast("success", `Confirmed: Updated "${d.existingValue}" to "${d.newValue}"`);
        await loadCaseData();
      } else {
        // Send a clarification note
        setInputText(`Clarification update: Replace "${d.existingValue}" with "${d.newValue}".`);
      }
    } catch (err: any) {
      addToast("error", err.message || "Confirmation failed");
    }
  };

  const getAlibiBadge = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 font-mono font-bold";
      case "broken":
        return "bg-error-container text-error border-error/40 font-mono font-bold animate-pulse";
      case "claimed":
        return "bg-amber-100 text-amber-900 border-amber-300 font-mono font-bold";
      default:
        return "bg-surface-container-high text-on-surface-variant border-outline-variant/40 font-mono";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 text-on-surface-variant text-xs gap-3 font-mono">
        <div className="w-9 h-9 rounded-full border-2 border-outline-variant border-t-primary animate-spin" />
        <span className="tracking-widest uppercase text-[11px] font-bold">
          [DECRYPTING CLASSIFIED CASE REPOSITORY...]
        </span>
      </div>
    );
  }

  if (error || !caseMeta) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-4">
        <Link href="/cases" className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1 font-mono">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          RETURN TO CASE REGISTRY
        </Link>
        <div className="p-4 rounded-xl bg-error-container text-error text-xs font-mono border border-error/30">
          [CLASSIFIED ERROR]: {error || "Case file restricted or unavailable"}
        </div>
      </div>
    );
  }

  const isViewer = user?.role === "viewer";
  const caseRefCode = `CM-${caseMeta.id.slice(-6).toUpperCase()}`;

  return (
    <div className="fixed inset-x-0 bottom-0 top-16 lg:left-72 flex flex-col overflow-hidden bg-surface select-none">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP CLASSIFIED COMMAND BANNER
      ────────────────────────────────────────────────────────────── */}
      <div className="shrink-0 w-full bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant/40 px-4 lg:px-6 py-2 shadow-xs z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Security Classification & Case Identifier */}
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Classified Stamp */}
            <div className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded border border-error/50 bg-error/10 text-error font-mono text-[9px] font-extrabold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping" />
              RESTRICTED // LE-SENSITIVE
            </div>

            {/* Radar status icon */}
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-on-primary shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[16px]">encrypted</span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-headline font-extrabold text-sm text-primary tracking-tight truncate">
                  {caseMeta.title}
                </span>
                <span className="font-mono text-[10px] font-bold text-secondary bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/30">
                  {caseRefCode}
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-on-surface-variant">
                <span>CLEARANCE: LEVEL-{user?.role === "admin" ? "4 (ADMIN)" : user?.role === "investigator" ? "3 (DETECTIVE)" : "1 (VIEWER)"}</span>
                <span>•</span>
                <span className="text-secondary font-semibold">STATUS: {caseMeta.status?.toUpperCase() || "ACTIVE"}</span>
                <span>•</span>
                <span>CHAIN OF CUSTODY VERIFIED</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Adjustable Split Presets (Desktop) */}
            <div
              className="hidden lg:flex items-center p-0.5 rounded-lg bg-surface-container border border-outline-variant/30 gap-0.5 font-mono text-[10px]"
              title="Adjust workspace split layout"
            >
              <button
                type="button"
                onClick={() => setSplitRatio(35)}
                title="Matrix Focus (35% Chat / 65% Matrix)"
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  Math.abs(splitRatio - 35) < 3
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                35:65
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio(50)}
                title="Balanced (50% Chat / 50% Matrix)"
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  Math.abs(splitRatio - 50) < 3
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                50:50
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio(65)}
                title="Chat Focus (65% Chat / 35% Matrix)"
                className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                  Math.abs(splitRatio - 65) < 3
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                65:35
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio(55)}
                title="Reset to Default (55:45)"
                className={`p-1 rounded transition-colors cursor-pointer ${
                  Math.abs(splitRatio - 55) < 2
                    ? "text-secondary font-bold"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[13px] block">restart_alt</span>
              </button>
            </div>

            {user?.role === "admin" && (
              <button
                onClick={handleDeleteCase}
                disabled={deletingCase}
                title="Permanently purge this classified case"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error/10 hover:bg-error/20 text-error border border-error/30 transition-all font-mono text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">
                  {deletingCase ? "sync" : "delete_forever"}
                </span>
                <span className="hidden sm:inline">PURGE CASE</span>
              </button>
            )}

            <button
              onClick={() => setShowSummary(!showSummary)}
              className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg transition-all font-mono text-[11px] font-bold border cursor-pointer ${
                showSummary
                  ? "bg-secondary-fixed text-on-secondary-fixed border-secondary"
                  : "bg-surface-container hover:bg-surface-container-high text-primary border-outline-variant/40"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">neurology</span>
              <span>WORKING MEMORY</span>
              <span className="material-symbols-outlined text-[15px]">
                {showSummary ? "expand_less" : "expand_more"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Working Memory Summary */}
      {showSummary && (
        <div className="shrink-0 px-4 lg:px-6 py-3 bg-surface-container-high/80 border-b border-outline-variant/40 animate-slideDown shadow-subtle">
          <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-extrabold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[15px] text-secondary">token</span>
                [CONFIDENTIAL INTELLIGENCE SYNTHESIS] // REAL-TIME WORKING MEMORY
              </span>
              <span className="font-mono text-[10px] text-on-surface-variant font-semibold">
                VECTOR REFRESH: CONTINUOUS
              </span>
            </div>
            <p className="text-xs text-on-surface leading-relaxed font-sans font-medium">
              {caseMeta.summary || "No synthesized intelligence brief recorded yet. Ingest field statements to initialize episodic reasoning."}
            </p>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher (Visible only on screens below lg) */}
      <div className="lg:hidden shrink-0 flex items-center border-b border-outline-variant/30 bg-surface-container-low p-1.5 gap-1.5">
        <button
          onClick={() => setMobileTab("chat")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "chat"
              ? "bg-primary text-on-primary shadow-xs"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">forum</span>
          <span>SEC-01: CHAT LOG</span>
        </button>
        <button
          onClick={() => setMobileTab("timeline")}
          className={`flex-1 py-1.5 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            mobileTab === "timeline"
              ? "bg-primary text-on-primary shadow-xs"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          <span className="material-symbols-outlined text-[15px]">timeline</span>
          <span>SEC-02: TIMELINES ({events.length})</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. DUAL-SECTION WORKSPACE (Split Panels with Independent Scrolls)
      ────────────────────────────────────────────────────────────── */}
      <div
        ref={workspaceContainerRef}
        className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden w-full relative"
      >
        {/* ═════════════════════════════════════════════════════════════
            SECTION 1: CLASSIFIED INVESTIGATION CHAT
        ══════════════════════════════════════════════════════════════ */}
        <section
          style={
            mounted && isLgScreen
              ? { width: `${splitRatio}%`, flex: `0 0 ${splitRatio}%` }
              : undefined
          }
          className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden border-b lg:border-b-0 bg-surface ${
            isDragging
              ? "pointer-events-none select-none"
              : "transition-[width,flex-basis] duration-150 ease-out"
          } ${
            mobileTab === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Section 1 Header */}
          <div className="shrink-0 px-4 py-2.5 border-b border-outline-variant/30 bg-surface-container-low/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-on-primary tracking-wider shrink-0">
                SEC-01
              </span>
              <div className="min-w-0">
                <h2 className="font-headline font-bold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">Investigation Chat &amp; Evidentiary Query</span>
                </h2>
                <span className="font-mono text-[9px] text-on-surface-variant block truncate">
                  TRANSACTIONAL CONSOLE // DUAL-PIPELINE MEMORY
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold border border-outline-variant/30 hidden sm:inline-block">
                RBAC: {user?.role?.toUpperCase()}
              </span>
              <span className="font-mono text-[9px] text-outline">
                {messages.length} ENTRIES
              </span>
            </div>
          </div>

          {/* Messages Stream (Independent Scroll) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-6 py-4 space-y-4">
            {/* Top Security Header Marker */}
            <div className="flex items-center justify-center gap-2 py-1">
              <div className="h-px bg-outline-variant/30 flex-1" />
              <span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest px-2.5 py-0.5 rounded border border-outline-variant/30 bg-surface-container-low">
                EVIDENTIARY AUDIT LOG • SESSION ENCRYPTED
              </span>
              <div className="h-px bg-outline-variant/30 flex-1" />
            </div>

            {messages.length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-center space-y-3 my-8">
                <div className="w-10 h-10 mx-auto rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-primary">
                    [EVIDENTIARY STREAM INITIALIZED]
                  </h3>
                  <p className="font-sans text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                    {isViewer
                      ? "Viewer role active: Ask evidentiary questions about timeline events, suspects, or missing leads."
                      : "Type raw case notes to extract chronological events and entities, or ask investigative questions with source citations."}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container font-mono text-[10px] text-secondary font-semibold">
                  <span className="material-symbols-outlined text-[13px]">bolt</span>
                  Dual-Pipeline Active: Auto-detects notes vs. queries
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="w-full">
                  {m.sender === "user" ? (
                    /* User Prompt: Classified Officer Log */
                    <div className="flex flex-col items-end gap-1 max-w-xl ml-auto w-full">
                      <div className="flex items-center gap-2 px-1">
                        <span className="font-mono text-[10px] font-bold text-secondary tracking-wider uppercase">
                          [INVESTIGATOR] • {user?.name || "OFFICER"}
                        </span>
                        <span className="font-mono text-[9px] text-outline">
                          {new Date(m.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="p-3.5 bg-surface-container-high rounded-2xl rounded-tr-xs text-primary shadow-xs border-l-2 border-secondary border-t border-r border-b border-outline-variant/30 w-full">
                        <p className="text-xs font-medium leading-relaxed select-text">
                          {m.text}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Agent Response: Classified Forensic Memory Core */
                    <div className="flex flex-col gap-2 max-w-2xl w-full">
                      {/* Meta Header */}
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-primary text-on-primary flex items-center justify-center shadow-xs">
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-primary uppercase tracking-wide">
                            CaseMemory Core
                          </span>
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant border border-outline-variant/30">
                            GEMINI FLASH • VECTORS
                          </span>
                        </div>

                        {/* Mode Stamp */}
                        {m.type === "fact" && (
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold uppercase">
                            ✓ FACT INGESTED
                          </span>
                        )}
                        {m.type === "question" && (
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container border border-secondary/30 font-bold uppercase">
                            🔍 MEMORY RETRIEVAL
                          </span>
                        )}
                        {m.type === "both" && (
                          <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-secondary-fixed text-on-secondary-fixed border border-secondary font-bold uppercase">
                            ⚡ INGEST + RETRIEVAL
                          </span>
                        )}
                      </div>

                      {/* Response Dossier Card */}
                      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-subtle border border-outline-variant/40 space-y-2.5">
                        {/* Exhibit intake confirmation badge */}
                        {m.noteId && (
                          <div className="p-2.5 bg-surface-container-low rounded-xl flex items-center justify-between border border-outline-variant/30">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-secondary text-[16px]">
                                policy
                              </span>
                              <span className="font-mono text-[11px] font-bold text-primary">
                                EXHIBIT RECORD ARCHIVED [NOTE #{m.noteId.slice(-6).toUpperCase()}]
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedNoteId(m.noteId!)}
                              className="font-mono text-[10px] font-bold text-secondary hover:underline cursor-pointer uppercase flex items-center gap-0.5"
                            >
                              <span>INSPECT</span>
                              <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                            </button>
                          </div>
                        )}

                        {/* Formatted Evidentiary Text with Clickable Citations */}
                        <div className="text-xs text-on-surface leading-relaxed select-text font-sans">
                          <FormattedEvidentiaryText
                            text={m.text}
                            onSelectNote={(nId) => setSelectedNoteId(nId)}
                          />
                        </div>

                        {/* Citations / Source Provenance Footer */}
                        {m.citations && m.citations.length > 0 && (
                          <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[9px] uppercase font-bold text-on-surface-variant tracking-wider mr-1">
                              [EXHIBIT PROVENANCE]:
                            </span>
                            {m.citations.map((c) => (
                              <button
                                key={c.noteId}
                                onClick={() => setSelectedNoteId(c.noteId)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container hover:bg-surface-container-high text-primary font-mono text-[10px] font-bold border border-outline-variant/40 transition-colors cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[12px] text-secondary">
                                  description
                                </span>
                                <span>EXHIBIT #{c.noteId.slice(-6).toUpperCase()}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {submitting && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant font-mono">
                <span className="material-symbols-outlined text-[16px] text-secondary animate-spin">
                  sync
                </span>
                <span className="text-[11px] tracking-wide">
                  [ROUTING INTENT // SYNCHRONIZING VECTOR STORE...]
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ─────────────────────────────────────────────────────────
              Chat Input Area (Docked strictly at bottom of Chat Section)
          ────────────────────────────────────────────────────────── */}
          <div className="shrink-0 p-3 lg:p-4 bg-surface-container-low/95 border-t border-outline-variant/30">
            <form
              onSubmit={handleSendMessage}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-xs p-2 flex flex-col gap-1.5 focus-within:border-secondary transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[18px] ml-1 shrink-0">
                  {isViewer ? "lock" : "rate_review"}
                </span>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    isViewer
                      ? "Viewer Query: 'Who has a broken alibi?' / 'Summary of 30th October'..."
                      : "Type incident notes or query memory: 'Suspect observed leaving via Gate 2'..."
                  }
                  disabled={submitting}
                  className="flex-1 bg-transparent border-0 outline-none text-on-surface placeholder:text-on-surface-variant/70 font-sans text-xs py-1"
                />

                <button
                  type="submit"
                  disabled={submitting || !inputText.trim()}
                  className="w-8 h-8 rounded-lg bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-all shadow-xs shrink-0 disabled:opacity-40 cursor-pointer"
                  title="Dispatch message to memory pipeline"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                </button>
              </div>

              {/* Sub-bar Classification Label */}
              <div className="flex items-center justify-between px-1.5 pt-1 border-t border-outline-variant/20 font-mono text-[9px] text-on-surface-variant">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  <span className="tracking-wide">
                    {isViewer
                      ? "ACCESS: READ-ONLY MEMORY RETRIEVAL"
                      : "DUAL-PIPELINE: NOTE EXTRACTION & QUERY ENGINE"}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-outline">
                  <span>DISPATCH:</span>
                  <kbd className="px-1 py-0.2 rounded bg-surface-container font-bold text-[8px]">
                    ENTER ↵
                  </kbd>
                </div>
              </div>
            </form>
          </div>
        </section>

        {/* ═════════════════════════════════════════════════════════════
            ADJUSTABLE RESIZE DIVIDER (Desktop only)
        ══════════════════════════════════════════════════════════════ */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Adjust width between Chat and Evidentiary Matrix"
          aria-valuenow={Math.round(splitRatio)}
          aria-valuemin={20}
          aria-valuemax={80}
          onPointerDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDoubleClick={() => setSplitRatio(55)}
          onKeyDown={handleSplitterKeyDown}
          className={`hidden lg:flex flex-col items-center justify-center relative w-2.5 shrink-0 cursor-col-resize select-none z-30 group outline-none transition-colors border-x border-outline-variant/30 ${
            isDragging
              ? "bg-secondary/30 border-secondary/60 ring-2 ring-secondary/30"
              : "bg-surface-container-low hover:bg-secondary/15 hover:border-secondary/40"
          }`}
          title="Drag to resize sections • Double-click to reset (55:45)"
        >
          {/* Center line */}
          <div
            className={`absolute inset-y-0 w-px transition-colors ${
              isDragging ? "bg-secondary" : "bg-outline-variant/50 group-hover:bg-secondary/70"
            }`}
          />

          {/* Tactile Grab Handle Pill with collapse/expand arrows */}
          <div
            className={`relative z-10 flex flex-col items-center justify-center py-1.5 px-0.5 rounded-full border shadow-xs transition-all ${
              isDragging
                ? "bg-secondary text-on-primary border-secondary scale-110 shadow-md ring-2 ring-secondary/30"
                : "bg-surface-container-high border-outline-variant/40 text-on-surface-variant group-hover:border-secondary/60 group-hover:bg-secondary-fixed group-hover:text-on-secondary-fixed"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSplitRatio((prev) => (prev > 30 ? 25 : 55));
              }}
              title="Minimize Chat (25%) / Restore"
              className="p-0.5 hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[12px] leading-none block">
                chevron_left
              </span>
            </button>
            <span className="material-symbols-outlined text-[13px] leading-none my-0.5 select-none pointer-events-none">
              drag_indicator
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSplitRatio((prev) => (prev < 70 ? 75 : 55));
              }}
              title="Maximize Chat (75%) / Restore"
              className="p-0.5 hover:text-primary transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[12px] leading-none block">
                chevron_right
              </span>
            </button>
          </div>

          {/* Floating live percentage pill during hover or drag */}
          <div
            className={`absolute top-4 pointer-events-none transition-all duration-150 transform -translate-x-1/2 left-1/2 whitespace-nowrap z-40 ${
              isDragging
                ? "opacity-100 scale-100"
                : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100"
            }`}
          >
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary text-on-primary font-mono text-[9px] font-bold shadow-lg border border-outline-variant/40 tracking-wider">
              <span>CHAT {Math.round(splitRatio)}%</span>
              <span className="text-secondary">•</span>
              <span>MATRIX {Math.round(100 - splitRatio)}%</span>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════
            SECTION 2: CLASSIFIED TIMELINES & INTELLIGENCE DOSSIER
        ══════════════════════════════════════════════════════════════ */}
        <section
          style={mounted && isLgScreen ? { flex: "1 1 0%", minWidth: 0 } : undefined}
          className={`w-full flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-surface-container-lowest/50 ${
            isDragging ? "pointer-events-none select-none" : ""
          } ${
            mobileTab === "timeline" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Section 2 Header & Classified Tabs */}
          <div className="shrink-0 px-4 py-2.5 border-b border-outline-variant/30 bg-surface-container-low/70 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-secondary text-on-primary tracking-wider shrink-0">
                  SEC-02
                </span>
                <div className="min-w-0">
                  <h2 className="font-headline font-bold text-xs text-primary uppercase tracking-wider truncate">
                    Evidentiary Matrix &amp; Timeline
                  </h2>
                  <span className="font-mono text-[9px] text-on-surface-variant block truncate">
                    CHRONOLOGICAL DOSSIER // SYNCHRONIZED
                  </span>
                </div>
              </div>

              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold border border-outline-variant/30 shrink-0">
                TOTAL TRACES: {events.length + suspects.length + gaps.length}
              </span>
            </div>

            {/* Classified Tab Strip */}
            <div className="flex items-center p-1 rounded-lg bg-surface-container border border-outline-variant/30 gap-1">
              <button
                onClick={() => setActiveRightTab("timeline")}
                className={`flex-1 py-1 px-2 rounded font-mono text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeRightTab === "timeline"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                <span>TIMELINE ({events.length})</span>
              </button>

              <button
                onClick={() => setActiveRightTab("suspects")}
                className={`flex-1 py-1 px-2 rounded font-mono text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeRightTab === "suspects"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">person_alert</span>
                <span>SUSPECTS ({suspects.length})</span>
              </button>

              <button
                onClick={() => setActiveRightTab("gaps")}
                className={`flex-1 py-1 px-2 rounded font-mono text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeRightTab === "gaps"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>GAPS ({gaps.length})</span>
              </button>
            </div>
          </div>

          {/* Timelines Stream (Independent Scroll) */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-5 py-4 space-y-3">
            {/* ─── TAB 1: Chronological Timeline ─── */}
            {activeRightTab === "timeline" && (
              <div className="flex flex-col gap-2.5">
                {events.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-on-surface-variant rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-2">
                    <span className="material-symbols-outlined text-[24px] text-outline block">
                      event_busy
                    </span>
                    <span>[NO CHRONOLOGICAL EVENTS RECORDED YET]</span>
                    <p className="text-[11px] font-sans text-on-surface-variant">
                      Ingest witness notes or case reports to build the chronological chain of custody.
                    </p>
                  </div>
                ) : (
                  events.map((ev, idx) => (
                    <div
                      key={ev.id}
                      className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-xs space-y-2 group hover:border-secondary transition-colors relative border-l-3 border-l-secondary"
                    >
                      {/* Top Bar: Time & Location */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded bg-surface-container text-secondary shrink-0">
                            #{String(idx + 1).padStart(2, "0")}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-primary truncate">
                            {ev.whenText || "TIME UNSPECIFIED"}
                          </span>
                        </div>

                        {ev.where && (
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-bold shrink-0 border border-outline-variant/20 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">location_on</span>
                            <span className="truncate max-w-[130px]">{ev.where}</span>
                          </span>
                        )}
                      </div>

                      {/* Event Description */}
                      <p className="text-xs text-on-surface font-medium leading-relaxed select-text font-sans">
                        {ev.what}
                      </p>

                      {/* Bottom Bar: Involved Actors & Source Exhibit */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-outline-variant/20 gap-2">
                        <div className="flex flex-wrap gap-1">
                          {ev.who && ev.who.length > 0 ? (
                            ev.who.map((w) => (
                              <span
                                key={w}
                                className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-surface-container text-secondary font-semibold"
                              >
                                @{w}
                              </span>
                            ))
                          ) : (
                            <span className="font-mono text-[9px] text-outline">NO ACTORS IDENTIFIED</span>
                          )}
                        </div>

                        <button
                          onClick={() => setSelectedNoteId(ev.noteId)}
                          className="font-mono text-[10px] text-secondary font-bold hover:underline cursor-pointer shrink-0"
                          title="Inspect original source note"
                        >
                          [EXHIBIT #{ev.noteId.slice(-6).toUpperCase()}]
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ─── TAB 2: Ranked Suspects (POI Threat Matrix) ─── */}
            {activeRightTab === "suspects" && (
              <div className="flex flex-col gap-2.5">
                {suspects.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-on-surface-variant rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-2">
                    <span className="material-symbols-outlined text-[24px] text-outline block">
                      person_search
                    </span>
                    <span>[NO PERSONS OF INTEREST EVALUATED]</span>
                    <p className="text-[11px] font-sans text-on-surface-variant">
                      Ingest incident records containing named actors to trigger the deterministic suspicion formula.
                    </p>
                  </div>
                ) : (
                  suspects.map((s, idx) => (
                    <div
                      key={s.name}
                      className="p-3.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 shadow-xs space-y-2.5 border-l-3 border-l-primary"
                    >
                      {/* Top Header: Rank, Name, Role & Score */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-on-primary shrink-0">
                            POI #{idx + 1}
                          </span>
                          <span className="font-headline font-bold text-xs text-primary truncate">
                            {s.name}
                          </span>
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant uppercase shrink-0">
                            {s.role}
                          </span>
                        </div>

                        <span className="font-mono text-xs font-black text-primary px-2 py-0.5 rounded bg-secondary-fixed border border-secondary shrink-0">
                          SCORE: {s.totalScore}
                        </span>
                      </div>

                      {/* Alibi Verification Stamp */}
                      <div className="flex items-center justify-between text-[10px] font-mono px-1">
                        <span className="text-on-surface-variant uppercase">ALIBI VERIFICATION:</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] uppercase border ${getAlibiBadge(s.breakdown.alibi.status)}`}>
                          [{s.breakdown.alibi.status.toUpperCase()}]
                        </span>
                      </div>

                      {/* Deterministic Evidentiary Breakdown Matrix */}
                      <div className="p-2.5 rounded-lg bg-surface-container-low text-[10px] font-mono text-on-surface-variant space-y-1 border border-outline-variant/20">
                        <div className="font-bold text-primary uppercase text-[9px] tracking-wider flex items-center justify-between border-b border-outline-variant/20 pb-1">
                          <span>[DETERMINISTIC FORMULA BREAKDOWN]</span>
                          <span>WEIGHT</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>• Linked Events:</span>
                          <span className="text-on-surface font-semibold">{s.breakdown.linkedEvents.description}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>• Scene Proximity:</span>
                          <span className="text-on-surface font-semibold">{s.breakdown.proximity.description}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>• Motive / Conflict:</span>
                          <span className="text-on-surface font-semibold">{s.breakdown.motiveOrIncrimination.description}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>• Alibi Verification:</span>
                          <span className="text-on-surface font-semibold">{s.breakdown.alibi.description}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ─── TAB 3: Evidentiary Gaps & Discrepancies ─── */}
            {activeRightTab === "gaps" && (
              <div className="flex flex-col gap-2.5">
                {gaps.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-on-surface-variant rounded-xl bg-surface-container-lowest border border-outline-variant/30 space-y-2">
                    <span className="material-symbols-outlined text-[24px] text-emerald-600 block">
                      verified_user
                    </span>
                    <span>[CHAIN OF CUSTODY INTACT]</span>
                    <p className="text-[11px] font-sans text-on-surface-variant">
                      No evidentiary gaps, alibi contradictions, or missing time windows detected.
                    </p>
                  </div>
                ) : (
                  gaps.map((g, idx) => (
                    <div
                      key={`gap-${idx}`}
                      className="p-3.5 rounded-xl bg-surface-container-lowest border border-error/30 shadow-xs space-y-1.5 border-l-3 border-l-error"
                    >
                      <div className="flex items-center gap-1.5 text-error font-mono text-[10px] uppercase font-bold">
                        <span className="material-symbols-outlined text-[15px]">warning</span>
                        <span>[DISCREPANCY DETECTED: {g.type.replace(/_/g, " ")}]</span>
                      </div>
                      <p className="text-xs text-on-surface font-medium leading-relaxed font-sans select-text">
                        {g.description}
                      </p>
                      {g.noteId && (
                        <div className="pt-1 border-t border-outline-variant/20 flex justify-end">
                          <button
                            onClick={() => setSelectedNoteId(g.noteId!)}
                            className="font-mono text-[10px] text-secondary font-bold hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>INSPECT NOTE #{g.noteId.slice(-6).toUpperCase()}</span>
                            <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                          </button>
                        </div>
                      )}
<<<<<<< HEAD

                      {/* Evidentiary Discrepancy & Re-Ask Confirmation Box */}
                      {m.confirmationPrompt && (
                        <div className="p-3.5 bg-secondary-container/90 rounded-2xl border border-secondary text-xs text-on-secondary-container space-y-2.5 shadow-sm animate-fadeIn">
                          <div className="flex items-center gap-2 font-bold text-primary font-label">
                            <span className="material-symbols-outlined text-error text-[18px]">
                              warning
                            </span>
                            <span>Evidentiary Discrepancy Detected — Confirmation Required</span>
                          </div>
                          <p className="font-sans leading-relaxed text-on-surface font-medium">
                            {m.confirmationPrompt}
                          </p>
                          {m.discrepancies && m.discrepancies.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-2">
                              {m.discrepancies.map((d, dIdx) => (
                                <button
                                  key={`disc-btn-${dIdx}`}
                                  type="button"
                                  onClick={() => handleConfirmDiscrepancy(d)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">check</span>
                                  <span>
                                    {d.field === "alibiStatus"
                                      ? `Confirm: Update ${d.entityName}'s alibi to "${d.newValue}"`
                                      : `Confirm: Replace "${d.existingValue}" with "${d.newValue}"`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Formatted Evidentiary Text with Clickable Citations */}
                      <div className="text-sm text-on-surface leading-relaxed">
                        <FormattedEvidentiaryText
                          text={m.text}
                          onSelectNote={(nId) => setSelectedNoteId(nId)}
                        />
                      </div>

                      {/* Citations Footer */}
                      {m.citations && m.citations.length > 0 && (
                        <div className="pt-2 border-t border-outline-variant/20 flex flex-wrap items-center gap-1.5">
                          <span className="font-label text-[10px] uppercase font-bold text-on-surface-variant tracking-wider mr-1">
                            Source Provenance:
                          </span>
                          {m.citations.map((c) => (
                            <button
                              key={c.noteId}
                              onClick={() => setSelectedNoteId(c.noteId)}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label text-[11px] font-semibold border border-outline-variant/30 transition-colors shadow-xs cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px] text-secondary">
                                description
                              </span>
                              <span>note #{c.noteId.slice(-6)}</span>
                            </button>
                          ))}
                        </div>
                      )}
=======
>>>>>>> refs/remotes/origin/main
                    </div>
                  ))
                )}
              </div>
<<<<<<< HEAD
            ))
          )}

          {submitting && (
            <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface-variant font-label">
              <span className="material-symbols-outlined text-[18px] text-secondary animate-spin">
                sync
              </span>
              <span>Routing intent and executing grounded memory pipeline...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* RIGHT LIVE CONTEXT INSPECTOR (Timeline, Suspects & Gaps) */}
        <aside className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          {/* Header & Tabs */}
          <div className="bg-surface-container-lowest rounded-2xl p-2 border border-outline-variant/30 shadow-subtle flex items-center justify-between">
            <div className="flex items-center gap-1 w-full">
              <button
                onClick={() => setActiveRightTab("timeline")}
                className={`flex-1 py-1.5 px-1.5 rounded-xl font-label text-[11px] font-bold transition-all ${
                  activeRightTab === "timeline"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Timeline ({events.length})
              </button>
              <button
                onClick={() => setActiveRightTab("suspects")}
                className={`flex-1 py-1.5 px-1.5 rounded-xl font-label text-[11px] font-bold transition-all ${
                  activeRightTab === "suspects"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Suspects ({suspects.length})
              </button>
              <button
                onClick={() => setActiveRightTab("entities")}
                className={`flex-1 py-1.5 px-1.5 rounded-xl font-label text-[11px] font-bold transition-all ${
                  activeRightTab === "entities"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Entities ({entities.length})
              </button>
              <button
                onClick={() => setActiveRightTab("gaps")}
                className={`flex-1 py-1.5 px-1.5 rounded-xl font-label text-[11px] font-bold transition-all ${
                  activeRightTab === "gaps"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Gaps ({gaps.length})
              </button>
            </div>
          </div>

          {/* TAB 1: Chronological Timeline */}
          {activeRightTab === "timeline" && (
            <div className="flex flex-col gap-3">
              {events.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                  No chronological events logged yet.
                </div>
              ) : (
                events.map((ev, idx) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle space-y-1.5 group hover:border-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-label text-[11px] font-bold text-primary">
                        {ev.whenText || "Unspecified time"}
                      </span>
                      {ev.where && (
                        <span className="font-label text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-semibold">
                          {ev.where}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface font-medium leading-snug">
                      {ev.what}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant/20">
                      <div className="flex flex-wrap gap-1">
                        {ev.who?.map((w) => (
                          <span
                            key={w}
                            className="font-label text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant"
                          >
                            @{w}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => setSelectedNoteId(ev.noteId)}
                        className="font-label text-[10px] text-secondary font-bold hover:underline cursor-pointer"
                      >
                        [note #{ev.noteId.slice(-6)}]
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: Ranked Suspects (Deterministic Formula) */}
          {activeRightTab === "suspects" && (
            <div className="flex flex-col gap-3">
              {suspects.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                  No suspects evaluated yet. Ingest case facts to trigger scoring.
                </div>
              ) : (
                suspects.map((s, idx) => (
                  <div
                    key={s.name}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-headline font-bold text-xs text-primary">
                          #{idx + 1} {s.name}
                        </span>
                        <span className="font-label text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                          {s.role}
                        </span>
                      </div>
                      <span className="font-label text-xs font-extrabold text-primary px-2 py-0.5 rounded-full bg-secondary-fixed">
                        Score: {s.totalScore}
                      </span>
                    </div>

                    {/* Alibi Status Badge & Edit Action */}
                    <div className="flex items-center justify-between font-label text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-on-surface-variant">Alibi Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${getAlibiBadge(s.breakdown.alibi.status)}`}>
                          {s.breakdown.alibi.status}
                        </span>
                      </div>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => {
                            const matchedEnt = entities.find(
                              (e) =>
                                e.name.toLowerCase() === s.name.toLowerCase() ||
                                (e.aliases || []).some((a) => a.toLowerCase() === s.name.toLowerCase())
                            );
                            if (matchedEnt) {
                              openEntityEditor(matchedEnt);
                            }
                          }}
                          className="text-[10px] text-secondary hover:text-primary font-bold flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                          <span>Update Alibi</span>
                        </button>
                      )}
                    </div>

                    {/* Explainable Formula Breakdown (Direct from Snitch Inspector) */}
                    <div className="p-2.5 rounded-xl bg-surface-container-low text-[10px] font-label text-on-surface-variant space-y-1">
                      <div className="font-bold text-primary uppercase text-[9px]">
                        Deterministic Evidentiary Breakdown:
                      </div>
                      <div className="flex justify-between">
                        <span>• Events Linked (+2/ea):</span>
                        <span className="text-on-surface font-semibold">{s.breakdown.linkedEvents.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Scene Proximity (+3):</span>
                        <span className="text-on-surface font-semibold">{s.breakdown.proximity.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Motive / Conflict (+2):</span>
                        <span className="text-on-surface font-semibold">{s.breakdown.motiveOrIncrimination.description}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Alibi Verified/Broken:</span>
                        <span className="text-on-surface font-semibold">{s.breakdown.alibi.description}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: All Tracked Entities */}
          {activeRightTab === "entities" && (
            <div className="flex flex-col gap-3">
              {entities.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                  No entities extracted or tracked yet. Ingest facts to populate.
                </div>
              ) : (
                entities.map((ent) => (
                  <div
                    key={ent.id}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle space-y-2 hover:border-secondary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-headline font-bold text-xs text-primary">
                          {ent.name}
                        </span>
                        <span className="font-label text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant uppercase font-medium">
                          {ent.type}
                        </span>
                        <span className="font-label text-[10px] px-1.5 py-0.2 rounded bg-secondary-container text-on-secondary-container font-semibold">
                          {ent.role}
                        </span>
                      </div>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => openEntityEditor(ent)}
                          className="p-1 rounded-lg hover:bg-surface-container text-secondary transition-colors cursor-pointer"
                          title="Edit entity name, role, or alibi"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      )}
                    </div>

                    {/* Alibi display for persons */}
                    {ent.type === "person" && (
                      <div className="flex items-center gap-2 font-label text-[11px] pt-0.5">
                        <span className="text-on-surface-variant">Alibi Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${getAlibiBadge(ent.alibiStatus)}`}>
                          {ent.alibiStatus}
                        </span>
                        {ent.alibiDetails && (
                          <span className="text-[10px] text-on-surface-variant truncate max-w-[160px]" title={ent.alibiDetails}>
                            {ent.alibiDetails}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Aliases display */}
                    {ent.aliases && ent.aliases.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-outline-variant/20">
                        <span className="font-label text-[9px] text-on-surface-variant">Aliases:</span>
                        {ent.aliases.map((a) => (
                          <span
                            key={a}
                            className="font-label text-[9px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface font-medium"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: Gaps & Open Questions */}
          {activeRightTab === "gaps" && (
            <div className="flex flex-col gap-3">
              {gaps.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant rounded-2xl bg-surface-container-lowest border border-outline-variant/30">
                  No evidentiary gaps or contradictions detected.
                </div>
              ) : (
                gaps.map((g, idx) => (
                  <div
                    key={`gap-${idx}`}
                    className="p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-subtle space-y-1 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-secondary font-label text-[10px] uppercase font-bold">
                      <span className="material-symbols-outlined text-[15px]">warning</span>
                      <span>{g.type.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-on-surface font-medium leading-snug">{g.description}</p>
                    {g.noteId && (
                      <button
                        onClick={() => setSelectedNoteId(g.noteId!)}
                        className="font-label text-[10px] text-secondary font-bold hover:underline cursor-pointer block pt-0.5"
                      >
                        [inspect note #{g.noteId.slice(-6)}]
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </aside>
=======
            )}
          </div>
        </section>
>>>>>>> refs/remotes/origin/main
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. VERBATIM NOTE DRAWER & TOAST NOTIFICATIONS
      ────────────────────────────────────────────────────────────── */}
      <NoteDrawer
        noteId={selectedNoteId}
        notes={notes}
        events={events}
        onClose={() => setSelectedNoteId(null)}
      />

<<<<<<< HEAD
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Quick Entity & Alibi Editor Modal */}
      {editingEntity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-6 shadow-float space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container">
                  <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-sm text-primary">
                    Update Entity & Alibi Record
                  </h3>
                  <p className="font-sans text-[11px] text-on-surface-variant">
                    Modify alibi status, fix name typos, or edit aliases
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntity(null)}
                className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveEntity} className="space-y-3.5">
              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Entity Name (Correct Typos)</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-label text-xs font-bold text-on-surface">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-label"
                  >
                    <option value="suspect">Suspect</option>
                    <option value="witness">Witness</option>
                    <option value="victim">Victim</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-label text-xs font-bold text-on-surface">Alibi Status</label>
                  <select
                    value={editAlibiStatus}
                    onChange={(e) => setEditAlibiStatus(e.target.value)}
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-2.5 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-label font-bold"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="claimed">Claimed (Unverified)</option>
                    <option value="verified">Verified (Corroborated)</option>
                    <option value="broken">Broken (Contradicted)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Alibi Details / Evidence Discrepancy</label>
                <textarea
                  rows={2}
                  value={editAlibiDetails}
                  onChange={(e) => setEditAlibiDetails(e.target.value)}
                  placeholder="e.g. CCTV footage refutes his claimed presence; toll tag records him at BKC at 11:42 PM"
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-sans resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-label text-xs font-bold text-on-surface">Aliases & Monikers (comma separated)</label>
                <input
                  type="text"
                  value={editAliases}
                  onChange={(e) => setEditAliases(e.target.value)}
                  placeholder="e.g. Vicky, Bunty, DL-10-CB-3190"
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-xl px-3 py-2 text-xs text-on-surface focus:outline-none focus:border-primary font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setEditingEntity(null)}
                  className="px-4 py-2 font-label text-xs text-on-surface-variant hover:text-on-surface font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEntity}
                  className="px-5 py-2 rounded-full bg-primary hover:bg-primary-container text-on-primary font-label text-xs font-bold disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {savingEntity ? "Saving..." : "Save to Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
=======
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
>>>>>>> refs/remotes/origin/main
    </div>
  );
}
