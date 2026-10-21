// Allowed values mirrored from the database CHECK constraints.
export const EXERCISE_CATEGORIES = [
  "strength", "power", "olympic", "plyometrics", "sprint", "acceleration", "max_velocity",
  "deceleration", "cod", "conditioning", "mobility", "stability", "core", "warmup", "recovery", "rehab",
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export const SESSION_SECTIONS = [
  "warmup", "mobility", "activation", "sprint", "plyometrics", "strength", "power", "cod",
  "conditioning", "core", "recovery", "cooldown",
] as const;
export type SessionSection = (typeof SESSION_SECTIONS)[number];

export const PROGRAM_TYPES = [
  "session", "weekly", "block", "monthly", "annual", "preseason", "inseason", "offseason",
  "return_to_training", "sport_specific",
] as const;

export const CYCLE_LEVELS = ["macrocycle", "mesocycle", "microcycle"] as const;

export const TEST_CATEGORIES = ["jump", "speed", "cod", "endurance", "strength", "mobility", "custom"] as const;

/** YouTube video id and optional start time (seconds) from a watch/shorts/youtu.be URL. */
export function youtubeInfo(url: string | null): { id: string; start: number | null; isShort: boolean } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    let id: string | null = null;
    if (u.hostname.endsWith("youtube.com")) id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed)\/([\w-]{11})/)?.[1] ?? null;
    else if (u.hostname === "youtu.be") id = u.pathname.slice(1, 12);
    if (!id || !/^[\w-]{11}$/.test(id)) return null;
    const t = u.searchParams.get("t") ?? u.searchParams.get("start");
    const start = t ? parseInt(t, 10) : null;
    return { id, start: Number.isFinite(start) && start! > 0 ? start : null, isShort: u.pathname.startsWith("/shorts/") };
  } catch {
    return null;
  }
}

export function youtubeThumbnail(url: string | null): string | null {
  const yt = youtubeInfo(url);
  return yt ? `https://i.ytimg.com/vi/${yt.id}/hqdefault.jpg` : null;
}

/** Converts a YouTube/Vimeo watch URL into an embeddable URL; other HTTPS links are returned as-is. */
export function embedUrl(url: string | null, opts: { autoplay?: boolean } = {}): { kind: "iframe" | "video" | "link"; src: string; vertical?: boolean } | null {
  if (!url || !url.startsWith("https://")) return null;
  const yt = youtubeInfo(url);
  if (yt) {
    const params = new URLSearchParams({ rel: "0", playsinline: "1" });
    if (yt.start) params.set("start", String(yt.start));
    if (opts.autoplay) params.set("autoplay", "1");
    return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt.id}?${params}`, vertical: yt.isShort };
  }
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}${opts.autoplay ? "?autoplay=1" : ""}` };
    }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "video", src: url };
    return { kind: "link", src: url };
  } catch {
    return null;
  }
}
