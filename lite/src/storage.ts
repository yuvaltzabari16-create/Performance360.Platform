import { emptyState, sanitizeState, type LiteState } from "./model";

/**
 * Saves the state in this browser: IndexedDB first, localStorage as a fallback. When neither works (some private
 * windows), the app keeps working in memory and tells the person to export their data.
 */

const DB = "performance360-lite";
const STORE = "kv";
const KEY = "state";
const LS_KEY = "performance360-lite-state";

export type StorageKind = "indexeddb" | "localstorage" | "memory";
let kind: StorageKind = "memory";
export const storageKind = () => kind;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
  });
}

async function idbGet(): Promise<unknown> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally { db.close(); }
}

async function idbPut(value: unknown): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function loadState(defaultLang: "en" | "he"): Promise<LiteState> {
  try {
    const v = await idbGet();
    kind = "indexeddb";
    if (v) return sanitizeState(v);
  } catch { /* try localStorage */ }
  try {
    const t = localStorage.getItem(LS_KEY);
    if (kind === "memory") kind = "localstorage";
    if (t) return sanitizeState(JSON.parse(t));
  } catch { kind = "memory"; }
  return emptyState(defaultLang);
}

/** Resolves true when the data was stored. */
export async function saveState(s: LiteState): Promise<boolean> {
  if (kind === "indexeddb") {
    try { await idbPut(s); return true; } catch (err) { console.warn("Lite: IndexedDB save failed, using local storage", err); kind = "localstorage"; }
  }
  if (kind === "localstorage") {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); return true; } catch (err) { console.warn("Lite: local storage save failed", err); kind = "memory"; }
  }
  return false;
}

/** Asks the browser not to evict the data when space runs low. Best effort. */
export async function requestPersistence(): Promise<void> {
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}

/** Erases everything this page stored in the browser (used when the passcode is forgotten). */
export async function wipeStorage(): Promise<void> {
  try {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  } catch { /* no IndexedDB: nothing stored there */ }
  try { localStorage.removeItem(LS_KEY); } catch { /* nothing to remove */ }
}
