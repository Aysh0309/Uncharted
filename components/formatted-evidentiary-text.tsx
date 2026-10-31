"use client";

import React from "react";

interface FormattedEvidentiaryTextProps {
  text: string;
  onSelectNote: (noteId: string) => void;
}

/**
 * Parses evidentiary text and replaces citations like [note #12] or [note #6723...]
 * with clickable interactive badge buttons matching snitch.html aesthetic.
 */
export function FormattedEvidentiaryText({
  text,
  onSelectNote,
}: FormattedEvidentiaryTextProps) {
  const regex = /\[note #([a-zA-Z0-9_-]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const noteId = match[1];
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    parts.push(
      <button
        key={`cit-${matchIndex}-${noteId}`}
        type="button"
        onClick={() => onSelectNote(noteId)}
        title={`Inspect Source Note #${noteId}`}
        className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container font-label text-[11px] font-bold transition border border-outline-variant/40 shadow-xs cursor-pointer align-baseline"
      >
        <span className="material-symbols-outlined text-[13px]">description</span>
        <span>note #{noteId.length > 8 ? noteId.slice(-6) : noteId}</span>
      </button>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className="leading-relaxed whitespace-pre-wrap">{parts}</span>;
}
