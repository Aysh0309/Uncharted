"use client";

import { useEffect } from "react";
import { X, FileText, User, Calendar, Tag, ShieldCheck, Link2 } from "lucide-react";

export interface NoteDetail {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
}

export interface LinkedEvent {
  id: string;
  noteId: string;
  what: string;
  whenText?: string;
  where?: string | null;
}

interface NoteDrawerProps {
  noteId: string | null;
  notes: NoteDetail[];
  events?: LinkedEvent[];
  onClose: () => void;
}

export function NoteDrawer({ noteId, notes, events = [], onClose }: NoteDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (noteId) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [noteId, onClose]);

  if (!noteId) return null;

  const note = notes.find((n) => n.id === noteId);
  const linkedEvents = events.filter((e) => e.noteId === noteId);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col shadow-2xl animate-slideLeft">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                Note #{noteId}
              </h2>
              <span className="text-[10px] text-zinc-400">Verbatim Case Evidence Record</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {!note ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              Note #{noteId} was not found or is still synchronizing.
            </div>
          ) : (
            <>
              {/* Meta information */}
              <div className="grid grid-cols-2 gap-2 text-[11px] p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 font-mono">
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Author: {note.authorId}</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Raw verbatim note */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Raw Ingested Note
                </span>
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap font-sans selection:bg-amber-500/30">
                  "{note.text}"
                </div>
              </div>

              {/* Extracted events linked to this note */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-blue-400" />
                  Derived Timeline Events ({linkedEvents.length})
                </span>

                {linkedEvents.length === 0 ? (
                  <div className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/60 text-xs text-zinc-500 italic">
                    No derived timeline events linked to this note.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/70 text-xs space-y-1"
                      >
                        <p className="text-zinc-200 font-medium">{ev.what}</p>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-mono">
                          {ev.whenText && <span>Time: {ev.whenText}</span>}
                          {ev.where && <span>Loc: {ev.where}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition"
          >
            Close Drawer
          </button>
        </div>
      </div>
    </div>
  );
}

