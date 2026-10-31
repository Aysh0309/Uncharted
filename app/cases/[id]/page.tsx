"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Clock,
  Users,
  Send,
  Sparkles,
  Brain,
  FileText,
  AlertTriangle,
  UserCheck,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Car,
  Phone,
  MapPin,
  Package,
  Layers,
  Lock,
} from "lucide-react";
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
  const caseId = params.id as string;

  // Global state
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  // Case Data
  const [caseMeta, setCaseMeta] = useState<any>(null);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [entities, setEntities] = useState<CaseEntity[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [openQuestions, setOpenQuestions] = useState<any[]>([]);
  const [suspects, setSuspects] = useState<SuspectScore[]>([]);
  const [gaps, setGaps] = useState<EvidentiaryGap[]>([]);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Note Drawer State
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // Right panel active tab
  const [rightTab, setRightTab] = useState<"suspects" | "entities" | "gaps">("suspects");

  // Mobile navigation active tab
  const [activePanel, setActivePanel] = useState<"chat" | "timeline" | "entities">("chat");

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: "success" | "error" | "info", message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
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
      setOpenQuestions(data.openQuestions || []);
      setSuspects(data.suspects || []);
      setGaps(data.gaps || []);

      // If messages not initialized, populate past queries
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || submitting) return;

    const userMsgId = `msg-usr-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
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
          text: `Extracted ${data.eventsSaved} event(s) and merged ${
            data.entitiesCreated + data.entitiesUpdated
          } entity record(s) into case memory.`,
          type: "fact",
          noteId: data.noteId,
          extractedStats: {
            eventsSaved: data.eventsSaved,
            entitiesCount: data.entitiesCreated + data.entitiesUpdated,
            openQuestionsSaved: data.openQuestionsSaved,
          },
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addToast("success", `Fact successfully saved as Note #${data.noteId}`);
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
        addToast("info", "Answered from grounded case memory");
      } else if (data.type === "both") {
        const assistantMsg: ChatMessage = {
          id: `msg-ast-${Date.now()}`,
          sender: "assistant",
          text: data.answer,
          type: "both",
          noteId: data.ingested?.noteId,
          citations: data.citations,
          extractedStats: {
            eventsSaved: data.ingested?.eventsSaved,
            entitiesCount:
              (data.ingested?.entitiesCreated || 0) + (data.ingested?.entitiesUpdated || 0),
          },
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        addToast("success", "Fact ingested & question answered from memory");
      }

      // Refresh case collections to update timeline and suspects live
      await loadCaseData();
    } catch (err: any) {
      addToast("error", err.message || "Error submitting message");
    } finally {
      setSubmitting(false);
    }
  };

  const getAlibiBadge = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "broken":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "claimed":
        return "bg-yellow-500/10 text-yellow-300 border-yellow-500/30";
      default:
        return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "vehicle":
        return <Car className="w-3.5 h-3.5 text-blue-400" />;
      case "phone":
        return <Phone className="w-3.5 h-3.5 text-emerald-400" />;
      case "place":
        return <MapPin className="w-3.5 h-3.5 text-rose-400" />;
      case "object":
        return <Package className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <UserCheck className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500 text-xs space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
        <span>Loading Case Terminal & Evidentiary Memory...</span>
      </div>
    );
  }

  if (error || !caseMeta) {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-12">
        <Link
          href="/cases"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Cases
        </Link>
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error || "Case file not found or unauthorized"}
        </div>
      </div>
    );
  }

  const isViewer = user?.role === "viewer";

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3">
      {/* 1. Header Bar */}
      <div className="flex flex-col gap-2 pb-2 border-b border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/cases"
              title="Return to case list"
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {caseMeta.title}
                </h1>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  {caseMeta.status}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 font-mono">
                Case ID: {caseMeta.id} • {events.length} Events • {entities.length} Entities • {notes.length} Notes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSummary(!showSummary)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition"
            >
              <Brain className="w-3.5 h-3.5 text-amber-400" />
              <span>Working Memory</span>
              {showSummary ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Working Memory Summary */}
        {showSummary && (
          <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1.5 text-xs text-zinc-300 animate-slideDown">
            <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Executive Working Memory (Continuously Synthesized from Case Notes)
            </div>
            <p className="leading-relaxed italic text-zinc-300">
              {caseMeta.summary || "No synthesized summary yet. Ingest facts to build memory."}
            </p>
          </div>
        )}

        {/* Responsive Mobile / Tablet Panel Switcher */}
        <div className="flex lg:hidden gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActivePanel("chat")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
              activePanel === "chat"
                ? "bg-amber-500 text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Chat Console
          </button>
          <button
            onClick={() => setActivePanel("timeline")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
              activePanel === "timeline"
                ? "bg-amber-500 text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Timeline ({events.length})
          </button>
          <button
            onClick={() => setActivePanel("entities")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${
              activePanel === "entities"
                ? "bg-amber-500 text-zinc-950 font-semibold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Suspects & Entities
          </button>
        </div>
      </div>

      {/* 2. Three-Panel Grid Workspace */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* PANEL 1 (LEFT): Chat & Investigation Stream */}
        <div
          className={`col-span-12 lg:col-span-4 flex flex-col h-full rounded-xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden ${
            activePanel === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Chat Header */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              Unified Investigation Stream
            </span>
            <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              Router: Dual Pipeline
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-zinc-500">
                <Brain className="w-8 h-8 text-zinc-600 mb-1" />
                <p className="font-medium text-zinc-400">Agentic Memory Ready</p>
                <p className="text-[11px] max-w-xs leading-normal">
                  {isViewer
                    ? "Ask questions about the suspects, timeline, or missing leads."
                    : "Type unstructured case facts to extract & store, or ask evidentiary questions."}
                </p>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Sender label */}
                  <span className="text-[10px] font-mono text-zinc-400 mb-1 px-1">
                    {m.sender === "user" ? "Investigator Prompt" : "CaseMemory Response"}
                  </span>

                  {/* Bubble */}
                  <div
                    className={`p-3 rounded-2xl max-w-[92%] space-y-2 ${
                      m.sender === "user"
                        ? "bg-amber-500/10 text-amber-100 border border-amber-500/30 rounded-tr-none"
                        : "bg-zinc-950/90 text-zinc-200 border border-zinc-800 rounded-tl-none shadow-md"
                    }`}
                  >
                    {/* Mode Hint Tag */}
                    {m.sender === "assistant" && m.type && (
                      <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-800/80">
                        {m.type === "fact" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ✓ Saved as fact
                          </span>
                        )}
                        {m.type === "question" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            🔍 Answered from memory
                          </span>
                        )}
                        {m.type === "both" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            ⚡ Fact saved & answered
                          </span>
                        )}
                        {m.noteId && (
                          <button
                            type="button"
                            onClick={() => setSelectedNoteId(m.noteId!)}
                            className="text-[10px] font-mono text-amber-400 hover:underline ml-auto"
                          >
                            [note #{m.noteId.slice(-6)}]
                          </button>
                        )}
                      </div>
                    )}

                    {/* Formatted Text with Interactive Citations */}
                    <div className="leading-relaxed">
                      <FormattedEvidentiaryText
                        text={m.text}
                        onSelectNote={(noteId) => setSelectedNoteId(noteId)}
                      />
                    </div>

                    {/* Citations footer for answers */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="pt-2 border-t border-zinc-800/60 space-y-1">
                        <span className="text-[10px] font-mono uppercase text-zinc-400 block font-semibold">
                          Verified Note Citations:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {m.citations.map((c) => (
                            <button
                              key={c.noteId}
                              onClick={() => setSelectedNoteId(c.noteId)}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-amber-400 flex items-center gap-1 transition"
                            >
                              <FileText className="w-3 h-3 text-amber-400" />
                              <span>[note #{c.noteId.slice(-6)}]</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {submitting && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>Classifying & executing agentic memory pipeline...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-950/80">
            {isViewer && (
              <div className="mb-2 px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-1.5 font-mono">
                <Lock className="w-3 h-3 text-blue-400" />
                <span>Ask-only mode: Viewers cannot ingest facts into memory.</span>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isViewer
                    ? "Ask a question about suspects, timeline, or next leads..."
                    : "Type a case fact or question (e.g. 'Who is the top suspect?')..."
                }
                disabled={submitting}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 transition"
              />
              <button
                type="submit"
                disabled={submitting || !inputText.trim()}
                className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs disabled:opacity-50 flex items-center justify-center transition shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* PANEL 2 (CENTER): Chronological Case Timeline */}
        <div
          className={`col-span-12 lg:col-span-4 flex flex-col h-full rounded-xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden ${
            activePanel === "timeline" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Timeline Header */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              Chronological Timeline
            </span>
            <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {events.length} Events Logged
            </span>
          </div>

          {/* Events Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-2 text-xs">
                <Clock className="w-8 h-8 text-zinc-600 mb-1" />
                <p className="font-medium text-zinc-400">No Events Extracted Yet</p>
                <p className="text-[11px] max-w-xs">
                  Ingest notes containing times and locations to populate the timeline.
                </p>
              </div>
            ) : (
              <div className="relative border-l border-zinc-800 ml-3.5 pl-4 space-y-4 my-2">
                {events.map((ev, idx) => (
                  <div key={ev.id} className="relative group">
                    {/* Glowing timeline node dot */}
                    <div className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-zinc-950 border-2 border-amber-500 group-hover:scale-125 transition" />

                    <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-semibold text-amber-300">
                          {ev.whenText || (ev.whenISO ? new Date(ev.whenISO).toLocaleTimeString() : "Unspecified time")}
                        </span>
                        {ev.where && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-400" />
                            {ev.where}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-200 leading-snug">{ev.what}</p>

                      {ev.who && ev.who.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {ev.who.map((w) => (
                            <span
                              key={w}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 font-mono"
                            >
                              @{w}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Source Citation Pill */}
                      <div className="pt-2 border-t border-zinc-900 flex justify-end">
                        <button
                          onClick={() => setSelectedNoteId(ev.noteId)}
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Source [note #{ev.noteId.slice(-6)}]</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PANEL 3 (RIGHT): Entities, Ranked Suspects & Gaps */}
        <div
          className={`col-span-12 lg:col-span-4 flex flex-col h-full rounded-xl bg-zinc-900/40 border border-zinc-800/80 overflow-hidden ${
            activePanel === "entities" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Tabs Header */}
          <div className="p-2 border-b border-zinc-800 bg-zinc-950/60 flex items-center gap-1">
            <button
              onClick={() => setRightTab("suspects")}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition ${
                rightTab === "suspects"
                  ? "bg-zinc-800 text-amber-300 border border-zinc-700"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Suspects ({suspects.length})
            </button>
            <button
              onClick={() => setRightTab("entities")}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition ${
                rightTab === "entities"
                  ? "bg-zinc-800 text-amber-300 border border-zinc-700"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Entities ({entities.length})
            </button>
            <button
              onClick={() => setRightTab("gaps")}
              className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-lg transition ${
                rightTab === "gaps"
                  ? "bg-zinc-800 text-amber-300 border border-zinc-700"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Gaps ({gaps.length})
            </button>
          </div>

          {/* Tab 1: Ranked Suspects with Score Breakdown */}
          {rightTab === "suspects" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {suspects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 text-xs">
                  <UserCheck className="w-8 h-8 text-zinc-600 mb-2" />
                  <p className="text-zinc-400 font-medium">No Suspects Evaluated</p>
                  <p className="text-[11px] max-w-xs">
                    Deterministic scores will rank individuals once case facts are added.
                  </p>
                </div>
              ) : (
                suspects.map((s, idx) => (
                  <div
                    key={s.name}
                    className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-zinc-400">
                          #{idx + 1}
                        </span>
                        <h4 className="text-xs font-bold text-white">{s.name}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {s.role}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-extrabold text-amber-400">
                          Score: {s.totalScore}
                        </span>
                      </div>
                    </div>

                    {/* Alibi badge */}
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-zinc-400">Alibi Status:</span>
                      <span
                        className={`px-1.5 py-0.5 rounded border uppercase text-[9px] ${getAlibiBadge(
                          s.breakdown.alibi.status
                        )}`}
                      >
                        {s.breakdown.alibi.status}
                      </span>
                    </div>

                    {/* Explainable Score Breakdown */}
                    <div className="p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1 text-[10px] font-mono text-zinc-400">
                      <div className="text-zinc-400 font-semibold uppercase text-[9px]">
                        Deterministic Score Formula:
                      </div>
                      <div className="flex justify-between">
                        <span>• Events Linked (+2/ea):</span>
                        <span className="text-zinc-200">
                          {s.breakdown.linkedEvents.description}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Incident Proximity (+3):</span>
                        <span className="text-zinc-200">
                          {s.breakdown.proximity.description}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Motive / Suspicion (+2):</span>
                        <span className="text-zinc-200">
                          {s.breakdown.motiveOrIncrimination.description}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Alibi Verified/Broken:</span>
                        <span className="text-zinc-200">{s.breakdown.alibi.description}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Tracked Entities */}
          {rightTab === "entities" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {entities.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No entities extracted yet.
                </div>
              ) : (
                entities.map((ent) => (
                  <div
                    key={ent.id}
                    className="p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {getEntityIcon(ent.type)}
                        <span className="font-semibold text-white">{ent.name}</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                        {ent.type}
                      </span>
                    </div>

                    {ent.aliases && ent.aliases.length > 0 && (
                      <p className="text-[11px] text-zinc-400">
                        <span className="font-mono text-zinc-400">Aliases:</span>{" "}
                        {ent.aliases.join(", ")}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1 border-t border-zinc-900">
                      <span>Role: {ent.role}</span>
                      <span>{ent.noteIds?.length || 1} note(s) linked</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Active Gaps & Open Questions */}
          {rightTab === "gaps" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {gaps.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  No active evidentiary gaps or contradictions detected.
                </div>
              ) : (
                gaps.map((g, idx) => (
                  <div
                    key={`gap-${idx}`}
                    className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1 text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] uppercase font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{g.type.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-zinc-300 leading-snug">{g.description}</p>
                    {g.noteId && (
                      <button
                        onClick={() => setSelectedNoteId(g.noteId!)}
                        className="text-[10px] font-mono text-amber-400 hover:underline pt-0.5 block"
                      >
                        [view note #{g.noteId.slice(-6)}]
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Slide-Over Note Drawer */}
      <NoteDrawer
        noteId={selectedNoteId}
        notes={notes}
        events={events}
        onClose={() => setSelectedNoteId(null)}
      />

      {/* 4. Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
