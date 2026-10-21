import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { readinessTone } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import type { PlayerStatus } from "../lib/types";

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ name }: { name: string | null | undefined }) {
  return <span className="av" aria-hidden="true">{initials(name)}</span>;
}

export function ReadyPill({ value }: { value: number | null | undefined }) {
  const { t } = useI18n();
  const tone = readinessTone(value);
  return <span className={"pill " + tone}>{value == null ? t.none : value}</span>;
}

export function StatusPill({ status }: { status: PlayerStatus }) {
  const { t } = useI18n();
  const tone = status === "available" ? "good" : status === "rehab" ? "warn" : "bad";
  return <span className={"pill " + tone}>{t.status[status]}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Loading() {
  const { t } = useI18n();
  return <div className="center">{t.loading}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="err row">
      <span>{t.error}: {message}</span>
      {onRetry && <button className="btn sm ghost" onClick={onRetry}>{t.retry}</button>}
    </div>
  );
}

/** Two-tap confirm for destructive actions, no modal needed. */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = "btn sm danger" }: {
  label: string; confirmLabel: string; onConfirm: () => void; className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  return (
    <button
      className={className}
      onClick={() => {
        if (armed) { window.clearTimeout(timer.current); setArmed(false); onConfirm(); return; }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

type ToastFn = (msg: string, bad?: boolean) => void;
const ToastCtx = createContext<ToastFn>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<ToastFn>((text, bad = false) => {
    setMsg({ text, bad });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), bad ? 4500 : 2200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast" role="status" aria-live="polite">
        {msg && <span className={msg.bad ? "bad" : ""}>{msg.text}</span>}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Wrap a mutation: shows the error as a toast and returns false on failure. */
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn: () => Promise<unknown>, okMsg?: string) => {
    try {
      await fn();
      if (okMsg) toast(okMsg);
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), true);
      return false;
    }
  }, [toast]);
}
