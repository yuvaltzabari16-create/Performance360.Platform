"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOutIdle } from "@/app/actions";
import { IDLE_WARNING_SECONDS } from "@/lib/security/idle";

/**
 * Signs the user out after a period of inactivity, with a warning dialog first.
 * Activity is shared between browser tabs through localStorage, so working in one tab
 * keeps the others alive. Renders nothing when `minutes` is 0.
 */

const STORAGE_KEY = "p360:lastActivity";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;

const readLast = (): number => {
  try {
    return Number(localStorage.getItem(STORAGE_KEY)) || Date.now();
  } catch {
    return Date.now();
  }
};
const writeLast = (t: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(t));
  } catch {
    /* storage unavailable (private mode): fall back to this tab's own timer */
  }
};

interface Labels {
  title: string;
  /** Contains the token {s} for the remaining seconds. */
  body: string;
  stay: string;
}

export function IdleLogout({ minutes, labels }: { minutes: number; labels: Labels }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const limitMs = minutes * 60_000;

  /** Records activity (throttled so scrolling does not hammer storage). */
  const touch = useCallback(() => {
    const now = Date.now();
    if (now - lastWrite.current < 5_000) return;
    lastWrite.current = now;
    writeLast(now);
  }, []);

  useEffect(() => {
    if (!minutes) return;
    writeLast(Date.now());
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = window.setInterval(() => {
      const idle = Date.now() - readLast();
      if (idle >= limitMs) {
        window.clearInterval(timer);
        void signOutIdle();
      } else if (idle >= limitMs - IDLE_WARNING_SECONDS * 1000) {
        setRemaining(Math.ceil((limitMs - idle) / 1000));
      } else {
        setRemaining(null);
      }
    }, 1_000);
    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [minutes, limitMs, touch]);

  if (!minutes || remaining == null) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-body">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-xl">
        <h2 id="idle-title" className="text-lg font-semibold text-ink">{labels.title}</h2>
        <p id="idle-body" className="mt-2 text-sm text-ink-soft" aria-live="polite">{labels.body.replace("{s}", String(remaining))}</p>
        <button
          type="button"
          autoFocus
          onClick={() => { writeLast(Date.now()); lastWrite.current = Date.now(); setRemaining(null); }}
          className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {labels.stay}
        </button>
      </div>
    </div>
  );
}
