"use client";

import React from "react";
import { FileText } from "lucide-react";

interface FormattedEvidentiaryTextProps {
  text: string;
  onSelectNote: (noteId: string) => void;
}

/**
 * Parses evidentiary text and replaces citations like [note #12] or [note #6723...]
 * with clickable interactive badge buttons that open the NoteDrawer.
 */
export function FormattedEvidentiaryText({
  text,
  onSelectNote,
}: FormattedEvidentiaryTextProps) {
  // Regex to match citations: [note #12] or [note #6723abc...]
  const regex = /\[note #([a-zA-Z0-9_-]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const fullMatch = match[0];
    const noteId = match[1];
    const matchIndex = match.index;

    // Push preceding plain text
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }

    // Push interactive citation badge
    parts.push(
      <button
        key={`cit-${matchIndex}-${noteId}`}
        type="button"
        onClick={() => onSelectNote(noteId)}
        title={`View Source Note #${noteId}`}
        className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-mono text-[11px] font-semibold transition group align-baseline"
      >
        <FileText className="w-3 h-3 text-amber-400 group-hover:scale-110 transition" />
        <span>[note #{noteId.length > 8 ? noteId.slice(-6) : noteId}]</span>
      </button>
    );

    lastIndex = matchIndex + fullMatch.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span className="leading-relaxed whitespace-pre-wrap">{parts}</span>;
}

