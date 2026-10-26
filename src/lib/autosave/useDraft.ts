"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Keeps unsent text in this browser (localStorage) so a refresh, crash or accidental navigation
 * does not lose it. Drafts are device-local and removed once the text is submitted.
 */
export function useDraft(key: string): { value: string; setValue: (v: string) => void; restored: boolean; clear: () => void } {
  const storageKey = `p360:draft:${key}`;
  const [value, setValueState] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { setValueState(saved); setRestored(true); }
    } catch {
      /* storage unavailable: drafts are simply off */
    }
  }, [storageKey]);

  const setValue = useCallback((v: string) => {
    setValueState(v);
    try {
      if (v) localStorage.setItem(storageKey, v);
      else localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const clear = useCallback(() => {
    setValueState("");
    setRestored(false);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  return { value, setValue, restored, clear };
}
