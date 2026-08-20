"use client";

import Link from "next/link";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  body?: string;
  tone?: Tone;
  /** Optional escape hatch, e.g. "enter today's data manually" on a sync failure. */
  action?: { label: string; href: string };
  /** Errors stay until dismissed; successes auto-clear. */
  durationMs?: number;
};

type ToastRecord = ToastInput & { id: number; tone: Tone };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function useToast() {
  const push = useContext(ToastContext);
  if (push === null) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return push;
}

const TONE_STYLES: Record<Tone, { border: string; icon: ReactNode }> = {
  success: {
    border: "border-apex-green/50",
    icon: <CheckCircle2 className="text-apex-green h-4 w-4 shrink-0" />,
  },
  error: {
    border: "border-apex-red/50",
    icon: <AlertTriangle className="text-apex-red h-4 w-4 shrink-0" />,
  },
  info: {
    border: "border-apex-cyan/50",
    icon: <Info className="text-apex-cyan h-4 w-4 shrink-0" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const tone = input.tone ?? "info";
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { ...input, tone, id }]);

      const duration = input.durationMs ?? (tone === "error" ? 0 : 5000);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`bg-apex-card pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-4 shadow-lg shadow-black/40 ${TONE_STYLES[toast.tone].border}`}
          >
            {TONE_STYLES[toast.tone].icon}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">
                {toast.title}
              </p>
              {toast.body !== undefined && (
                <p className="mt-1 text-sm break-words text-slate-400">
                  {toast.body}
                </p>
              )}
              {toast.action !== undefined && (
                <Link
                  href={toast.action.href}
                  onClick={() => dismiss(toast.id)}
                  className="text-apex-cyan mt-2 inline-block text-sm font-medium underline"
                >
                  {toast.action.label}
                </Link>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="shrink-0 text-slate-500 hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
