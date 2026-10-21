import { useEffect, useState } from "react";

/**
 * Minimal hash router: works on any static host with no rewrite rules.
 * Routes look like #/players/123. Plain <a href="#/players"> links work.
 */
function current(): string {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/" + h;
}

export function useRoute(): string {
  const [path, setPath] = useState(current);
  useEffect(() => {
    const on = () => { setPath(current()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}

export function navigate(to: string) {
  if (current() !== to) window.location.hash = to;
}

/** Match "/players/:id" against a path; returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = path.split("?")[0].split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}
