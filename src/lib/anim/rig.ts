// Exercise animation rig: a jointed 2D figure posed in world units (y up, ground at y = 0, figure faces +x).
// Side view = sagittal profile (near + far limbs share the hip / shoulder); front view = facing the camera
// (near = figure's right, drawn on screen left).
//
// Angle conventions (degrees):
//   limb segment angles  — measured from straight DOWN, positive rotates toward +x (forward / outward)
//   trunk angles (t, t2) — measured from straight UP, positive leans toward +x
// Limbs are posed either with absolute angles (FK) or with a target for the end joint (2-bone IK).

export type V = [number, number];
export type View = "side" | "front";

export interface Limb {
  /** FK: absolute angles [upper, lower] */
  a?: [number, number];
  /** IK: world position of ankle / wrist */
  to?: V;
  /** IK bend side: +1 joint goes CCW of the root→target line (knees forward), −1 CW (elbows back) */
  bend?: number;
  /** foot / hand absolute angle (from down) */
  end?: number;
  /** foreshortening scales for [upper, lower] (limb pointing at / away from the camera) */
  s?: [number, number];
  /** FK angles are relative to the trunk (arms: upper trunk, legs: lower trunk) */
  rel?: boolean;
  /** IK target in the trunk frame relative to the limb root: [along trunk, toward front] (side) / [along, outward] (front) */
  tr?: V;
}

export interface Pose {
  root: V;           // pelvis
  t: number;         // lower trunk angle
  t2?: number;       // upper trunk angle (default t)
  ts?: number;       // trunk length scale (front view: torso bent toward camera)
  tw?: number;       // shoulder twist (front view), degrees
  pw?: number;       // pelvis twist (front view), degrees
  h?: number;        // head nod relative to upper trunk (+ forward / chin down; front view: side tilt)
  hr?: number;       // head turn (front view: nose shifts sideways; side view: ignored)
  ln: Limb; lf: Limb; an: Limb; af: Limb;
  e?: number;        // effort 0..1 → muscle highlight intensity
  x?: number;        // auxiliary channel for props (ball flight, implement rotation…)
  o?: number;        // figure opacity (fade out / in to reset travelling drills)
}

export const L = {
  thigh: 44, shin: 43, foot: 17, heel: 5, ankleH: 7,
  trunkLo: 24, trunkUp: 27, neck: 7, head: 10.5,
  upper: 29, fore: 26, hand: 8,
  hipW: 8.5, shW: 15.5,
};

const rad = (d: number) => (d * Math.PI) / 180;
/** unit vector for a limb angle (from down, + toward +x) */
export const limbDir = (a: number): V => [Math.sin(rad(a)), -Math.cos(rad(a))];
/** unit vector for a trunk angle (from up, + toward +x) */
export const trunkDir = (a: number): V => [Math.sin(rad(a)), Math.cos(rad(a))];
export const add = (p: V, q: V, k = 1): V => [p[0] + q[0] * k, p[1] + q[1] * k];
export const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]];
export const len = (p: V) => Math.hypot(p[0], p[1]);
export const norm = (p: V): V => { const l = len(p) || 1; return [p[0] / l, p[1] / l]; };
export const lerpV = (p: V, q: V, k: number): V => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
const rot = (v: V, a: number): V => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };
const angOf = (v: V) => (Math.atan2(v[0], -v[1]) * 180) / Math.PI; // inverse of limbDir

export interface Chain { root: V; mid: V; end: V; tip: V; endAng: number; s: [number, number] }

export interface Skeleton {
  view: View;
  pelvis: V; waist: V; neckBase: V; headC: V; headDir: V; nose: number;
  t: number; t2: number; ts: number; tw: number;
  hipN: V; hipF: V; shN: V; shF: V;
  legN: Chain; legF: Chain; armN: Chain; armF: Chain;
  e: number; x: number;
}

function solveLimb(root: V, l1: number, l2: number, lim0: Limb, defEnd: number, endLen: number, defBend: number, ikEnd: number | undefined, ta: number, out: number): Chain {
  let lim = lim0;
  if (lim.tr) {
    const u = trunkDir(ta), f: V = [u[1] * out, -u[0] * out];
    lim = { ...lim, to: [root[0] + u[0] * lim.tr[0] + f[0] * lim.tr[1], root[1] + u[1] * lim.tr[0] + f[1] * lim.tr[1]] };
  } else if (lim.rel && lim.a) {
    // in line with the trunk = −t (a forward lean rotates the limb's lower end backward)
    lim = { ...lim, a: [lim.a[0] - ta, lim.a[1] - ta], end: lim.end !== undefined ? lim.end - ta : undefined };
  }
  const s = lim.s ?? [1, 1];
  const a1 = l1 * s[0], a2 = l2 * s[1];
  let mid: V, end: V;
  if (lim.to) {
    const d = sub(lim.to, root);
    let dist = len(d);
    const u = norm(d);
    const max = a1 + a2 - 0.01;
    if (dist > max) dist = max;
    const min = Math.abs(a1 - a2) + 0.01;
    if (dist < min) dist = min;
    const cosA = (a1 * a1 + dist * dist - a2 * a2) / (2 * a1 * dist);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA))) * (lim.bend ?? defBend);
    mid = add(root, rot(u, A), a1);
    end = add(root, u, dist);
  } else {
    const [u, w] = lim.a ?? [0, 0];
    mid = add(root, limbDir(u), a1);
    end = add(mid, limbDir(w), a2);
  }
  const endAng = lim.end ?? (lim.to ? (ikEnd ?? angOf(sub(end, mid)) + defEnd) : (lim.a?.[1] ?? 0) + defEnd);
  const tip = add(end, limbDir(endAng), endLen);
  return { root, mid, end, tip, endAng, s };
}

export function solve(p: Pose, view: View): Skeleton {
  const t2 = p.t2 ?? p.t;
  const ts = p.ts ?? 1;
  const pelvis = p.root;
  const waist = add(pelvis, trunkDir(p.t), L.trunkLo * ts);
  const neckBase = add(waist, trunkDir(t2), L.trunkUp * ts);
  const hd = p.h ?? 0;
  const headDir = trunkDir(t2 + hd);
  const headC = add(neckBase, headDir, L.neck + L.head * 0.8);
  let hipN = pelvis, hipF = pelvis, shN = neckBase, shF = neckBase;
  const tw = p.tw ?? 0;
  if (view === "front") {
    // lateral axes perpendicular to the trunk segments (pointing to screen-left = figure's right)
    const latLo: V = [-Math.cos(rad(p.t)), Math.sin(rad(p.t))];
    const latUp: V = [-Math.cos(rad(t2)), Math.sin(rad(t2))];
    const pw = Math.cos(rad(p.pw ?? 0));
    hipN = add(pelvis, latLo, L.hipW * pw); hipF = add(pelvis, latLo, -L.hipW * pw);
    const sw = L.shW * Math.cos(rad(tw));
    const sh = add(neckBase, trunkDir(t2), -3.5);
    shN = add(sh, latUp, sw); shF = add(sh, latUp, -sw);
  } else {
    shN = shF = add(neckBase, trunkDir(t2), -3.5);
  }
  const fr = view === "front";
  // trunk frame "front" direction: side view = facing direction; front view = outward (near: screen-left)
  const legN = solveLimb(hipN, L.thigh, L.shin, p.ln, 90, L.foot, fr ? -1 : 1, 90, p.t, fr ? -1 : 1);
  const legF = solveLimb(hipF, L.thigh, L.shin, p.lf, 90, L.foot, 1, 90, p.t, 1);
  const armN = solveLimb(shN, L.upper, L.fore, p.an, 0, L.hand, -1, undefined, t2, fr ? -1 : 1);
  const armF = solveLimb(shF, L.upper, L.fore, p.af, 0, L.hand, fr ? 1 : -1, undefined, t2, 1);
  return { view, pelvis, waist, neckBase, headC, headDir, nose: Math.sin(rad(p.hr ?? 0)), t: p.t, t2, ts, tw,
    hipN, hipF, shN, shF, legN, legF, armN, armF, e: p.e ?? 0, x: p.x ?? 0 };
}

// ---------- interpolation ----------
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
function lerpLimb(a: Limb, b: Limb, k: number): Limb {
  const o: Limb = {};
  if (a.tr && b.tr) o.tr = lerpV(a.tr, b.tr, k);
  else if (a.to && b.to) o.to = lerpV(a.to, b.to, k);
  else if (a.a && b.a) o.a = [lerp(a.a[0], b.a[0], k), lerp(a.a[1], b.a[1], k)];
  else return k < 0.5 ? a : b;
  o.bend = k < 0.5 ? a.bend : b.bend;
  o.rel = a.rel;
  if (a.end !== undefined || b.end !== undefined) {
    const ea = a.end ?? b.end!, eb = b.end ?? a.end!;
    o.end = lerp(ea, eb, k);
  }
  if (a.s || b.s) { const sa = a.s ?? [1, 1], sb = b.s ?? [1, 1]; o.s = [lerp(sa[0], sb[0], k), lerp(sa[1], sb[1], k)]; }
  return o;
}
export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const n = (x: number | undefined, y: number | undefined, d = 0) => lerp(x ?? d, y ?? d, k);
  return {
    root: lerpV(a.root, b.root, k), t: lerp(a.t, b.t, k), t2: lerp(a.t2 ?? a.t, b.t2 ?? b.t, k),
    ts: n(a.ts, b.ts, 1), tw: n(a.tw, b.tw), pw: n(a.pw, b.pw), h: n(a.h, b.h), hr: n(a.hr, b.hr),
    ln: lerpLimb(a.ln, b.ln, k), lf: lerpLimb(a.lf, b.lf, k), an: lerpLimb(a.an, b.an, k), af: lerpLimb(a.af, b.af, k),
    e: n(a.e, b.e), x: n(a.x, b.x), o: n(a.o, b.o, 1),
  };
}

/** Deep-ish merge for building poses from a base. Limbs are replaced field-wise. */
export function mod(base: Pose, m: Partial<Omit<Pose, "ln" | "lf" | "an" | "af">> & { ln?: Limb; lf?: Limb; an?: Limb; af?: Limb }): Pose {
  return { ...base, ...m, ln: m.ln ?? base.ln, lf: m.lf ?? base.lf, an: m.an ?? base.an, af: m.af ?? base.af } as Pose;
}

export const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
