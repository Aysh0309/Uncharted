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
  const [activeRightTab, setActiveRightTab] = useState<"timeline" | "suspects" | "gaps">("timeline");
  const [mobileTab, setMobileTab] = useState<"chat" | "timeline">("chat");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Note Drawer State
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
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
          text: `Evidentiary intake complete: Extracted ${data.eventsSaved} timeline event(s) and synchronized ${
            data.entitiesCreated + data.entitiesUpdated
          } POI entity record(s) into case memory vault.`,
          type: "fact",
          noteId: data.noteId,
          extractedStats: {
            eventsSaved: data.eventsSaved,
            entitiesCount: data.entitiesCreated + data.entitiesUpdated,
          },
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
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden w-full">
        {/* ═════════════════════════════════════════════════════════════
            SECTION 1: CLASSIFIED INVESTIGATION CHAT
        ══════════════════════════════════════════════════════════════ */}
        <section
          className={`flex-1 lg:w-[57%] flex flex-col h-full min-h-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-outline-variant/30 bg-surface ${
            mobileTab === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Section 1 Header */}
          <div className="shrink-0 px-4 py-2.5 border-b border-outline-variant/30 bg-surface-container-low/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-primary text-on-primary tracking-wider">
                SEC-01
              </span>
              <div>
                <h2 className="font-headline font-bold text-xs text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Investigation Chat &amp; Evidentiary Query
                </h2>
                <span className="font-mono text-[9px] text-on-surface-variant block">
                  TRANSACTIONAL CONSOLE // DUAL-PIPELINE MEMORY
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
            SECTION 2: CLASSIFIED TIMELINES & INTELLIGENCE DOSSIER
        ══════════════════════════════════════════════════════════════ */}
        <section
          className={`w-full lg:w-[43%] flex flex-col h-full min-h-0 overflow-hidden bg-surface-container-lowest/50 ${
            mobileTab === "timeline" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Section 2 Header & Classified Tabs */}
          <div className="shrink-0 px-4 py-2.5 border-b border-outline-variant/30 bg-surface-container-low/70 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-secondary text-on-primary tracking-wider">
                  SEC-02
                </span>
                <div>
                  <h2 className="font-headline font-bold text-xs text-primary uppercase tracking-wider">
                    Evidentiary Matrix &amp; Timeline
                  </h2>
                  <span className="font-mono text-[9px] text-on-surface-variant block">
                    CHRONOLOGICAL DOSSIER // SYNCHRONIZED
                  </span>
                </div>
              </div>

              <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant font-bold border border-outline-variant/30">
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
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </section>
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

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
