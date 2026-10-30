"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AssistantChat, type AssistantLabels } from "./AssistantChat";

/**
 * Floating chat for every signed-in role. Hidden on the AI Assistant page, which shows the same chat full size.
 * Closing the panel keeps the conversation until the page is left.
 */
export function AssistantWidget({ labels, starters, roleKey }: { labels: AssistantLabels; starters: string[]; roleKey: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/assistant") return null;

  return (
    <div className="no-print fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] end-4 z-40 flex flex-col items-end gap-3 lg:bottom-4" data-testid="assistant" data-role={roleKey}>
      <section role="dialog" aria-label={labels.title} hidden={!open} className="flex h-[min(40rem,calc(100dvh-6rem))] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border ring-line/60 bg-surface/95 shadow-[var(--shadow-lift)] backdrop-blur-md">
        <header className="flex items-center justify-between gap-2 bg-brand-600 px-5 py-3.5 text-white">
          <h2 className="text-sm font-semibold">{labels.title}</h2>
          <button type="button" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} aria-label={labels.close} className="rounded-md px-2 py-1 text-lg leading-none text-white/80 hover:text-white">×</button>
        </header>
        <AssistantChat labels={labels} starters={starters} autoFocus={open} className="flex-1" />
      </section>
      <button
        ref={buttonRef} type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? labels.close : labels.open}
        className="press flex size-13 items-center justify-center rounded-full bg-brand-600 text-white shadow-[var(--shadow-lift)] hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M9 11h6M9 14h4" /></svg>
      </button>
    </div>
  );
}
