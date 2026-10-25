"use client";

import { useState } from "react";
import type { QuickAction } from "@/lib/quick-actions";
import { QuickSheet } from "./QuickSheet";

/** Desktop entry to the quick actions: a "+" button at the top of the sidebar. */
export function QuickButton({ actions, title, closeLabel }: { actions: QuickAction[]; title: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="press mx-3 mb-3 flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-[15px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(21,122,74,0.75)] hover:bg-brand-700">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
        {title}
      </button>
      <QuickSheet open={open} onClose={() => setOpen(false)} actions={actions} title={title} closeLabel={closeLabel} />
    </>
  );
}
