"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askAssistant } from "@/app/assistant/actions";
import { RichText } from "./RichText";

interface Labels {
  open: string; close: string; title: string; intro: string; privacy: string; placeholder: string; send: string; thinking: string; you: string; assistant: string; clear: string; copy: string; copied: string;
  errors: Record<string, string>;
}
interface Msg { role: "user" | "assistant"; content: string }

/**
 * Floating chat for every signed-in role. Messages stay in this component's memory only (closing the tab
 * clears them). Answers are rendered from a small Markdown subset as React elements, never as HTML.
 */
export function AssistantWidget({ labels, starters, roleKey }: { labels: Labels; starters: string[]; roleKey: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, pending]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setError(null);
    startTransition(async () => {
      const res = await askAssistant(next);
      if (res.ok) setMessages([...next, { role: "assistant", content: res.text }]);
      else setError(labels.errors[res.error] ?? labels.errors.failed);
    });
  }

  return (
    <div className="no-print fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] end-4 z-40 flex flex-col items-end gap-3 lg:bottom-4" data-testid="assistant" data-role={roleKey}>
      {open && (
        <section role="dialog" aria-label={labels.title} className="flex h-[min(40rem,calc(100dvh-6rem))] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border ring-line/60 bg-surface/95 shadow-[var(--shadow-lift)] backdrop-blur-md">
          <header className="flex items-center justify-between gap-2 bg-brand-600 px-5 py-3.5 text-white">
            <h2 className="text-sm font-semibold">{labels.title}</h2>
            <span className="flex items-center gap-1">
              {messages.length > 0 && <button type="button" onClick={() => { setMessages([]); setError(null); }} className="rounded-md px-2 py-1 text-xs text-white/70 hover:text-white">{labels.clear}</button>}
              <button type="button" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} aria-label={labels.close} className="rounded-md px-2 py-1 text-lg leading-none text-white/80 hover:text-white">×</button>
            </span>
          </header>
          <div ref={logRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm" aria-live="polite" data-testid="assistant-log">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-ink-soft">{labels.intro}</p>
                <ul className="flex flex-col gap-2">
                  {starters.map((s) => (
                    <li key={s}><button type="button" onClick={() => send(s)} className="w-full rounded-xl border border-line px-3.5 py-2.5 text-start text-ink hover:border-brand-400 hover:bg-brand-50/50">{s}</button></li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[92%] break-words rounded-2xl px-4 py-2.5 leading-6 ${m.role === "user" ? "whitespace-pre-wrap bg-gradient-to-b from-brand-500 to-brand-600 text-white" : "bg-brand-50/70 text-ink"}`} data-from={m.role}>
                  <span className="sr-only">{m.role === "user" ? labels.you : labels.assistant}: </span>
                  {m.role === "user" ? m.content : <RichText text={m.content} />}
                  {m.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard?.writeText(m.content).then(() => { setCopiedAt(i); setTimeout(() => setCopiedAt((v) => (v === i ? null : v)), 1500); }).catch(() => undefined); }}
                      className="mt-2 block text-[11px] font-medium text-brand-700 hover:underline"
                    >{copiedAt === i ? labels.copied : labels.copy}</button>
                  )}
                </div>
              </div>
            ))}
            {pending && <p className="text-xs text-muted" role="status">{labels.thinking}</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">{error}</p>}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(draft); }} className="border-t border-line p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} maxLength={3000} aria-label={labels.placeholder} placeholder={labels.placeholder}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(draft); } }}
                className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              />
              <button type="submit" disabled={pending || !draft.trim()} className="rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:from-brand-600 hover:to-brand-700 disabled:opacity-50">{labels.send}</button>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-muted">{labels.privacy}</p>
          </form>
        </section>
      )}
      <button
        ref={buttonRef} type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? labels.close : labels.open}
        className="press flex size-13 items-center justify-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-lift)] hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M9 11h6M9 14h4" /></svg>
      </button>
    </div>
  );
}
