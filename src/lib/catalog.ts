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

/** Converts a YouTube/Vimeo watch URL into an embeddable URL; other HTTPS links are returned as-is. */
export function embedUrl(url: string | null): { kind: "iframe" | "video" | "link"; src: string } | null {
  if (!url || !url.startsWith("https://")) return null;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/shorts/")[1]?.split("/")[0];
      if (id) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` };
    }
    if (u.hostname === "youtu.be") {
      return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(u.pathname.slice(1))}` };
    }
    if (u.hostname.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return { kind: "video", src: url };
    return { kind: "link", src: url };
  } catch {
    return null;
  }
}
