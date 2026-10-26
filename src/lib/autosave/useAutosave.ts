"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Generic autosave: when `value` changes, wait for a pause in typing (`delay`), then call `save`.
 * Pending changes are flushed immediately when the tab is hidden or the component unmounts, so
 * leaving the page does not lose work. `status` drives the "Saving… / Saved" indicator.
 */

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

export interface AutosaveOptions<T> {
  value: T;
  /** Persists the value; return { ok: false } (or throw) to show the error state. */
  save: (value: T) => Promise<{ ok: boolean }>;
  /** Milliseconds of quiet before saving. */
  delay?: number;
  /** Skip saving while false (for example while the form is invalid). */
  enabled?: boolean;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useAutosave<T>({ value, save, delay = 800, enabled = true }: AutosaveOptions<T>) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const lastSaved = useRef<T>(value); // what the server already has
  const latest = useRef<T>(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);
  saveRef.current = save;
  enabledRef.current = enabled;
  latest.current = value;

  /** Saves the latest value now if it differs from what was last saved. */
  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const v = latest.current;
    if (!enabledRef.current || same(v, lastSaved.current)) return;
    setStatus("saving");
    try {
      const r = await saveRef.current(v);
      if (r.ok) { lastSaved.current = v; setStatus("saved"); } else setStatus("error");
    } catch {
      setStatus("error");
    }
  }, []);

  // Debounce on every change.
  useEffect(() => {
    if (same(value, lastSaved.current)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value, delay, flush]);

  // Flush when the tab is hidden and on unmount.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => { document.removeEventListener("visibilitychange", onHide); void flush(); };
  }, [flush]);

  return { status, flush };
}
