"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto p-3 rounded-xl border shadow-xl flex items-start gap-2.5 text-xs animate-slideUp ${
            t.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : t.type === "error"
              ? "bg-rose-950/90 border-rose-500/40 text-rose-200"
              : "bg-zinc-900/90 border-zinc-700 text-zinc-200"
          }`}
        >
          {t.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : t.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1 leading-snug">{t.message}</div>

          <button
            onClick={() => onDismiss(t.id)}
            className="text-zinc-400 hover:text-white transition -mr-1 -mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

