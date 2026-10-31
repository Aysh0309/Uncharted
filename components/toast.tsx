"use client";

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
    <div className="fixed bottom-24 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto p-3.5 rounded-2xl border shadow-card flex items-start gap-2.5 text-xs animate-slideUp backdrop-blur-md transition-all ${
            t.type === "success"
              ? "bg-surface-container-lowest border-outline-variant text-on-surface"
              : t.type === "error"
              ? "bg-error-container text-on-error-container border-error/20"
              : "bg-surface-container-lowest border-outline-variant text-on-surface"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[18px] shrink-0 ${
              t.type === "success"
                ? "text-secondary"
                : t.type === "error"
                ? "text-error"
                : "text-primary"
            }`}
          >
            {t.type === "success"
              ? "check_circle"
              : t.type === "error"
              ? "error"
              : "info"}
          </span>

          <div className="flex-1 font-medium leading-snug">{t.message}</div>

          <button
            onClick={() => onDismiss(t.id)}
            className="text-on-surface-variant hover:text-on-surface transition-colors -mr-1"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
