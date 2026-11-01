/* ---------- language (English / Hebrew) ---------- */
let LANG = (() => { const l = localPref("lang"); if (l === "he" || l === "en") return l; return /^(he|iw)/i.test(navigator.language || "") ? "he" : "en"; })();
const LOC = () => (LANG === "he" ? "he-IL" : undefined);
const RTL = () => LANG === "he";
const HE = {}; const HE_PATTERNS = [];
function applyLang() { const r = document.documentElement; r.lang = LANG === "he" ? "he" : "en"; r.dir = RTL() ? "rtl" : "ltr"; }
function tr(s) {
  if (LANG !== "he" || s == null) return s;
  const str = String(s); const k = str.trim();
  if (!k || !/[A-Za-z]/.test(k)) return str;
  let v = HE[k];
  if (v == null) for (const [re, fn] of HE_PATTERNS) { const m = k.match(re); if (m) { v = fn(m); break; } }
  if (v == null && k.includes(" · ")) { const parts = k.split(" · "); const tp = parts.map((p) => tr(p)); if (tp.some((p, i) => p !== parts[i])) v = tp.join(" · "); }
  return v == null ? str : str.replace(k, v);
}
function translateDom(root) {
  if (LANG !== "he") return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(n) { if (n.nodeType === 1) return n.getAttribute("translate") === "no" || n.tagName === "STYLE" || n.tagName === "SCRIPT" || n.tagName === "TEXTAREA" ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP; return NodeFilter.FILTER_ACCEPT; },
  });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const t = tr(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; }
  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => {
    if (el.closest('[translate="no"]')) return;
    for (const a of ["placeholder", "aria-label", "title"]) { const v = el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
  });
}
function setLang(l) { LANG = l === "he" ? "he" : "en"; setLocalPref("lang", LANG); applyLang(); }
