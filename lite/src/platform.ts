import type { Lang } from "./model";

/**
 * Differences between the three ways the same screens are served:
 *  - the single file opened from disk (Lite),
 *  - the shared page published as an Artifact (build flag __ARTIFACT__, data in the artifact's own store).
 * The artifact viewer blocks alert/confirm and downloads started by the page, so those go through small helpers.
 */
declare const __ARTIFACT__: boolean | undefined;
declare const __LOCK__: boolean | undefined;
/** True in the build served from a website: a passcode screen stands in front of the app. */
export const LOCK: boolean = typeof __LOCK__ !== "undefined" && __LOCK__ === true;
export const ARTIFACT: boolean = typeof __ARTIFACT__ !== "undefined" && __ARTIFACT__ === true;

interface ClaudeNs { use(name: string): Promise<unknown> }
export const claudeNs = (): ClaudeNs | undefined => (globalThis as { claude?: ClaudeNs }).claude;

/** Saves text as a file. In the artifact the viewer is asked to confirm the save (the page may not download by itself). */
export async function saveFile(name: string, text: string, mime = "text/plain"): Promise<void> {
  if (ARTIFACT) {
    const dl = (await claudeNs()?.use("downloads").catch(() => null)) as { save(r: { filename: string; data: string }): Promise<unknown> } | null | undefined;
    if (dl) { try { await dl.save({ filename: name, data: text }); } catch { /* the viewer declined or saving is unavailable */ } }
    return;
  }
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Asker = (message: string) => Promise<boolean>;
let asker: Asker | null = null;
export const registerAsker = (fn: Asker | null) => { asker = fn; };
/** Yes/no question. The single file uses the browser's own dialog; the artifact shows an inline one. */
export const ask = (message: string): Promise<boolean> => (ARTIFACT && asker ? asker(message) : Promise.resolve(window.confirm(message)));

export const guessLang = (): Lang => (typeof navigator !== "undefined" && /^he/i.test(navigator.language) ? "he" : "en");
