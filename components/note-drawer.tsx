"use client";

import { useEffect } from "react";

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
    <div className="fixed inset-0 z-50 flex justify-end bg-primary/20 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-surface-container-low border-l border-outline-variant/30 h-full flex flex-col shadow-float animate-slideLeft">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant/30 flex items-center justify-between bg-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-primary font-headline flex items-center gap-1.5">
                Verbatim Evidence Record
              </h2>
              <span className="font-label text-[11px] text-on-surface-variant font-mono">
                Note #{noteId}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {!note ? (
            <div className="text-center py-12 text-on-surface-variant text-xs">
              Note #{noteId} is synchronizing or not found.
            </div>
          ) : (
            <>
              {/* Meta information card */}
              <div className="grid grid-cols-2 gap-2 text-[11px] p-3 rounded-xl bg-surface-container border border-outline-variant/20 font-label">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px] text-secondary">person</span>
                  <span className="truncate">Author: {note.authorId}</span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px] text-secondary">schedule</span>
                  <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* Raw verbatim note */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary" />
                    Ingested Statement
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label text-[10px] font-semibold">
                    Original Source
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface leading-relaxed shadow-subtle selection:bg-secondary-container">
                  "{note.text}"
                </div>
              </div>

              {/* Derived timeline events linked to this note */}
              <div className="space-y-2">
                <span className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-secondary">account_tree</span>
                  Derived Events ({linkedEvents.length})
                </span>

                {linkedEvents.length === 0 ? (
                  <div className="p-3 rounded-xl bg-surface-container/60 border border-outline-variant/20 text-xs text-on-surface-variant italic">
                    No discrete timeline events derived from this note.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-subtle text-xs space-y-1"
                      >
                        <p className="text-on-surface font-semibold">{ev.what}</p>
                        <div className="flex items-center gap-3 text-[10px] text-on-surface-variant font-label">
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
        <div className="p-4 border-t border-outline-variant/30 bg-surface flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm"
          >
            Dismiss Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
