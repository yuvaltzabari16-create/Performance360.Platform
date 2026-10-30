"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { QuickAction, QuickIcon } from "@/lib/quick-actions";

const PATHS: Record<QuickIcon, string> = {
  userPlus: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M22 11h-6",
  test: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  program: "M5 4h14v16H5zM9 9h6M9 13h6M9 17h3",
  injury: "M2 12h4l3-8 4 16 3-8h6",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  checkin: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9",
  key: "M15 7a4 4 0 1 0-3.9 5L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 0 15 7z",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  squad: "M4 6h16M4 12h16M4 18h10",
  invite: "M3 7l9 6 9-6M3 7v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1",
  assistant: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  meal: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 21V3c-2.2 0-4 2.7-4 6v4h4",
  payment: "M3 6h18v12H3zM3 10h18M7 15h4",
  wearable: "M8 3h8l1 4H7zM8 21h8l1-4H7zM7 7h10v10H7zM12 10v4l2 1",
};

export function QuickIconSvg({ icon, className = "size-6" }: { icon: QuickIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[icon]} />
    </svg>
  );
}

/** The sheet itself: a grid of large one-tap actions. A bottom sheet on phones, a centred card on larger screens. */
export function QuickSheet({ open, onClose, actions, title, closeLabel }: { open: boolean; onClose: () => void; actions: QuickAction[]; title: string; closeLabel: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title} data-testid="quick-sheet">
      <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="glass relative m-2 w-full max-w-md rounded-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] ring-1 ring-line/60 sm:m-4">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted/40 sm:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[20px] font-bold tracking-tight text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="press rounded-full bg-canvas px-3 py-1 text-sm font-medium text-ink-soft">{closeLabel}</button>
        </div>
        <ul className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <li key={a.id}>
              <Link href={a.href} onClick={onClose} className="press flex h-full flex-col items-start gap-3 rounded-2xl bg-brand-50 p-4 text-[15px] font-semibold text-brand-800 hover:bg-brand-100">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-white"><QuickIconSvg icon={a.icon} className="size-5" /></span>
                <span className="leading-snug">{a.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
