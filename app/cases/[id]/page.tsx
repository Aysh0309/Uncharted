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

  // Toggle States
  const [showSummary, setShowSummary] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"timeline" | "suspects" | "gaps">("timeline");

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
      `Permanently delete "${caseMeta?.title || "this case"}"?\n\nThis will remove the case file along with all of its notes, events, and tracked entities. This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingCase(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete case");

      addToast("success", "Case deleted successfully");
      router.push("/cases");
      router.refresh();
    } catch (err: any) {
      addToast("error", err.message || "Delete failed");
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
        throw new Error(data.message || "Failed to process message");
      }

      if (data.type === "fact") {
        const assistantMsg: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          sender: "assistant",
          text: `Extracted ${data.eventsSaved} event(s) and synchronized ${
            data.entitiesCreated + data.entitiesUpdated
          } entity record(s) into case memory.`,
          type: "fact",
          noteId: data.noteId,
          extractedStats: {
            eventsSaved: data.eventsSaved,
            entitiesCount: data.entitiesCreated + data.entitiesUpdated,
          },
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addToast("success", `Evidence saved as Note #${data.noteId.slice(-6)}`);
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
        addToast("info", "Answered from verified memory");
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
        addToast("success", "Fact saved & question answered");
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
        return "bg-surface-container-highest text-secondary font-semibold";
      case "broken":
        return "bg-error-container text-on-error-container font-semibold";
      case "claimed":
        return "bg-secondary-container text-on-secondary-container font-semibold";
      default:
        return "bg-surface-container text-on-surface-variant";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-32 text-on-surface-variant text-xs gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-outline-variant border-t-primary animate-spin" />
        <span className="font-label">Calibrating case episodic memory...</span>
      </div>
    );
  }

  if (error || !caseMeta) {
    return (
      <div className="p-8 max-w-xl mx-auto space-y-4">
        <Link href="/cases" className="text-xs font-semibold text-secondary hover:underline flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Case Directory
        </Link>
        <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-xs">
          {error || "Case record unavailable"}
        </div>
      </div>
    );
  }

  const isViewer = user?.role === "viewer";

  return (
    <div className="flex flex-col w-full relative">
      {/* Sub-header: Context Health & Inspection Banner (Direct from snitch.html) */}
      <div className="sticky top-16 z-30 w-full bg-surface-container-low/95 backdrop-blur-md px-4 lg:px-8 py-2.5 border-b border-outline-variant/30 shadow-subtle">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex items-center gap-2 text-on-surface">
              <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-secondary-fixed text-on-secondary-fixed">
                <span className="material-symbols-outlined text-[15px]">psychology</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary" />
              </div>
              <span className="font-headline font-bold text-sm text-primary tracking-tight truncate">
                {caseMeta.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user?.role === "admin" && (
              <button
                onClick={handleDeleteCase}
                disabled={deletingCase}
                title="Permanently delete this case"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error-container/30 hover:bg-error-container text-on-error-container transition-all font-label text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {deletingCase ? "sync" : "delete"}
                </span>
                <span>Delete Case</span>
              </button>
            )}

            <button
              onClick={() => setShowSummary(!showSummary)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface transition-all font-label text-xs shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-[15px]">neurology</span>
              <span>Working Memory</span>
              <span className="material-symbols-outlined text-[16px]">
                {showSummary ? "expand_less" : "expand_more"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Working Memory Summary */}
      {showSummary && (
        <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 pt-4">
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/30 text-xs text-on-surface space-y-1.5 shadow-subtle animate-slideDown">
            <div className="flex items-center justify-between">
              <span className="font-label text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <span className="material-symbols-outlined text-[16px] text-secondary">token</span>
                Executive Case Summary (Dynamically Synthesized)
              </span>
              <span className="font-label text-[10px] text-on-surface-variant font-semibold">
                Updated in real-time
              </span>
            </div>
            <p className="leading-relaxed text-on-surface-variant font-sans">
              {caseMeta.summary || "No synthesized summary yet. Ingest facts to construct episodic working memory."}
            </p>
          </div>
        </div>
      )}

      {/* Primary Stage Layout: Central Dialogue Canvas + Right Inspector (snitch.html layout) */}
      <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 items-start relative pb-36">
        {/* CENTER DIALOGUE COLUMN (Chat & Answers) */}
        <div className="flex-1 flex flex-col gap-6 min-w-0 w-full">
          {/* Chat History Session Marker */}
          <div className="flex items-center justify-center gap-3">
            <div className="h-px bg-surface-container-highest flex-1" />
            <span className="font-label text-[11px] text-on-surface-variant uppercase tracking-widest px-3 py-1 rounded-full bg-surface-container-low border border-outline-variant/20">
              Active Investigation Thread • Scoped RBAC
            </span>
            <div className="h-px bg-surface-container-highest flex-1" />
          </div>

          {/* Messages Stream */}
          {messages.length === 0 ? (
            <div className="p-8 rounded-3xl bg-surface-container-low border border-outline-variant/30 text-center space-y-2">
              <div className="w-10 h-10 mx-auto rounded-2xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">all_inclusive</span>
              </div>
              <h3 className="font-headline font-bold text-base text-primary">Unified Evidentiary Console</h3>
              <p className="font-label text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                {isViewer
                  ? "Viewers may ask questions about the suspects, timeline, or missing leads. Memory retrieval is active."
                  : "Type case notes to extract events and update working memory, or ask evidentiary questions with note citations."}
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="w-full">
                {m.sender === "user" ? (
                  /* User Prompt Node (Direct from snitch.html) */
                  <div className="flex flex-col items-end gap-1.5 max-w-2xl ml-auto w-full">
                    <div className="flex items-center gap-2 px-1">
                      <span className="font-label text-[11px] text-on-surface-variant font-semibold">
                        Investigator
                      </span>
                      <span className="font-label text-[10px] text-outline">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="p-4 bg-surface-container rounded-3xl rounded-br-lg text-on-surface shadow-subtle border border-outline-variant/20 w-full">
                      <p className="text-sm font-medium text-primary leading-relaxed">
                        {m.text}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Agent Response Container (Direct from snitch.html) */
                  <div className="flex flex-col gap-3 max-w-3xl w-full">
                    {/* Meta Header */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                          <span className="material-symbols-outlined text-[16px]">token</span>
                        </div>
                        <span className="font-headline font-bold text-sm text-primary">
                          CaseMemory Thought Core
                        </span>
                        <span className="font-label text-[10px] px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-semibold">
                          Latest Gemini Flash • Deep Vector
                        </span>
                      </div>

                      {/* Mode Hint Badge */}
                      {m.type === "fact" && (
                        <span className="font-label text-[10px] px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold">
                          ✓ Saved as fact
                        </span>
                      )}
                      {m.type === "question" && (
                        <span className="font-label text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-bold">
                          🔍 Answered from memory
                        </span>
                      )}
                      {m.type === "both" && (
                        <span className="font-label text-[10px] px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold">
                          ⚡ Fact saved & answered
                        </span>
                      )}
                    </div>

                    {/* Transparent Reasoning & Response Card */}
                    <div className="bg-surface-container-low rounded-3xl p-5 shadow-subtle border border-outline-variant/30 space-y-3">
                      {/* Fact confirmation card if fact ingested */}
                      {m.noteId && (
                        <div className="p-3 bg-surface-container-lowest rounded-2xl flex items-center justify-between border border-outline-variant/20 shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-secondary text-[18px]">
                              check_circle
                            </span>
                            <span className="font-label text-xs font-semibold text-on-surface">
                              Ingested into Case Memory (Note #{m.noteId.slice(-6)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedNoteId(m.noteId!)}
                            className="font-label text-[11px] font-bold text-secondary hover:underline cursor-pointer"
                          >
                            Inspect Note
                          </button>
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
                    </div>
                  </div>
                )}
              </div>
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
                className={`flex-1 py-1.5 px-2 rounded-xl font-label text-xs font-bold transition-all ${
                  activeRightTab === "timeline"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Timeline ({events.length})
              </button>
              <button
                onClick={() => setActiveRightTab("suspects")}
                className={`flex-1 py-1.5 px-2 rounded-xl font-label text-xs font-bold transition-all ${
                  activeRightTab === "suspects"
                    ? "bg-primary text-on-primary shadow-xs"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                Suspects ({suspects.length})
              </button>
              <button
                onClick={() => setActiveRightTab("gaps")}
                className={`flex-1 py-1.5 px-2 rounded-xl font-label text-xs font-bold transition-all ${
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

                    {/* Alibi Status Badge */}
                    <div className="flex items-center gap-2 font-label text-[11px]">
                      <span className="text-on-surface-variant">Alibi Status:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${getAlibiBadge(s.breakdown.alibi.status)}`}>
                        {s.breakdown.alibi.status}
                      </span>
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

          {/* TAB 3: Gaps & Open Questions */}
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
      </div>

      {/* BOTTOM FLOATING MINIMALIST PROMPT INPUT (Exact Snitch.html Floating Capsule) */}
      <div className="fixed bottom-6 left-0 lg:left-72 right-0 z-40 px-4 flex justify-center pointer-events-none">
        <div className="w-full max-w-3xl pointer-events-auto bg-surface-container-lowest/95 backdrop-blur-xl rounded-full p-2 shadow-float border border-outline-variant/30 flex flex-col gap-1.5">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 px-2">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px] ml-1">
              {isViewer ? "lock" : "edit_note"}
            </span>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isViewer
                  ? "Ask-only mode: Ask about suspects, timeline, or next leads..."
                  : "Type case notes or ask questions: 'Witness observed blue sedan at Pier 14'..."
              }
              disabled={submitting}
              className="flex-1 bg-transparent border-0 outline-none text-on-surface placeholder:text-on-surface-variant font-sans text-xs px-1 py-1.5"
            />

            <button
              type="submit"
              disabled={submitting || !inputText.trim()}
              className="w-9 h-9 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-all shadow-sm shrink-0 disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </form>

          {/* Bottom Context Meta Bar */}
          <div className="flex items-center justify-between px-3 pb-0.5 text-on-surface-variant font-label text-[10px]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span>
                {isViewer
                  ? "Viewer Access: Read-only memory retrieval"
                  : "Dual-Pipeline: Automatic Fact Extraction & Question Answering"}
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-outline font-mono">
              <span>Return to submit</span>
              <kbd className="px-1 py-0.2 rounded bg-surface-container font-semibold">↵</kbd>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Verbatim Note Drawer */}
      <NoteDrawer
        noteId={selectedNoteId}
        notes={notes}
        events={events}
        onClose={() => setSelectedNoteId(null)}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
