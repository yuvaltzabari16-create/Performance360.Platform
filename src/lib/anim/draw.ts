// Turns a solved skeleton (+ props) into SVG shapes, and a sequence of frames into one looping SVG (SMIL).
import { add, L, lerpV, limbDir, norm, sub, trunkDir, type Skeleton, type V } from "./rig";

export type Layer = "back" | "mid" | "front";
export interface Shape {
  id: string;
  tag: "path" | "circle";
  cls: string;
  a: Record<string, number | string>;
  layer?: Layer;
  /** body group: shapes in one group share a single outline (drawn behind all of them) */
  grp?: string;
}

const f = (n: number) => (Math.round(n * 10) / 10).toString();
/** world → screen (y down) */
export const P = (p: V) => `${f(p[0])} ${f(-p[1])}`;

// ---------- primitive geometry (world coords in, path strings out) ----------
const perpL = (d: V): V => [-d[1], d[0]]; // CCW (y up)
const perpR = (d: V): V => [d[1], -d[0]]; // CW

/** Tapered capsule from p1 (radius r1) to p2 (radius r2), sides bulging by b1 / b2. */
export function capsule(p1: V, p2: V, r1: number, r2: number, b1 = 0, b2 = 0): string {
  const d = norm(sub(p2, p1));
  const n = perpL(d);
  const m = lerpV(p1, p2, 0.5);
  const rm = (r1 + r2) / 2;
  const a1 = add(p1, n, r1), a2 = add(p2, n, r2), c1 = add(m, n, rm + b1 * 2);
  const b2p = add(p2, n, -r2), b1p = add(p1, n, -r1), c2 = add(m, n, -(rm + b2 * 2));
  // arcs: world y is flipped on screen, so CCW-in-world becomes sweep 1 on screen
  return `M${P(a1)}Q${P(c1)} ${P(a2)}A${f(r2)} ${f(r2)} 0 0 1 ${P(b2p)}Q${P(c2)} ${P(b1p)}A${f(r1)} ${f(r1)} 0 0 1 ${P(a1)}Z`;
}

/** Ellipse as 4 cubic arcs (constant command structure so it can be animated). */
export function ellipse(c: V, u: V, a: number, b: number): string {
  const k = 0.5523;
  const v = perpL(u);
  const pt = (x: number, y: number): V => [c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y];
  const p0 = pt(a, 0), p1 = pt(0, b), p2 = pt(-a, 0), p3 = pt(0, -b);
  return `M${P(p0)}C${P(pt(a, k * b))} ${P(pt(k * a, b))} ${P(p1)}C${P(pt(-k * a, b))} ${P(pt(-a, k * b))} ${P(p2)}C${P(pt(-a, -k * b))} ${P(pt(-k * a, -b))} ${P(p3)}C${P(pt(k * a, -b))} ${P(pt(a, -k * b))} ${P(p0)}Z`;
}

/** Closed Catmull-Rom spline through points. */
export function blob(pts: V[]): string {
  const n = pts.length;
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: V = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: V = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d + "Z";
}

export const poly = (pts: V[], close = true) => "M" + pts.map(P).join("L") + (close ? "Z" : "");
export const line = (a: V, b: V) => `M${P(a)}L${P(b)}`;
export const circ = (id: string, c: V, r: number, cls: string, layer?: Layer): Shape => ({ id, tag: "circle", cls, layer, a: { cx: f(c[0]), cy: f(-c[1]), r: f(r) } });
export const path = (id: string, d: string, cls: string, layer?: Layer): Shape => ({ id, tag: "path", cls, layer, a: { d } });

// ---------- muscles ----------
export type Muscle =
  | "quads" | "hams" | "glutes" | "abductors" | "adductors" | "hipflex" | "calves" | "tibialis"
  | "abs" | "obliques" | "lowback" | "lats" | "upperback" | "traps" | "chest"
  | "delts" | "reardelt" | "rotcuff" | "biceps" | "triceps" | "forearms" | "neck";

type Seg = "thigh" | "shin" | "upper" | "fore" | "lo" | "up" | "neck";
/** [segment, t0, t1, side-view offset (+front / −back, × radius), front-view offset (+out / −in, × radius; null = hidden), width × radius] */
type Part = [Seg, number, number, number, number | null, number];
const MUSCLES: Record<Muscle, Part[]> = {
  quads: [["thigh", 0.14, 0.9, 0.38, 0, 0.62]],
  hams: [["thigh", 0.12, 0.86, -0.42, null, 0.58]],
  glutes: [["lo", -0.42, 0.2, -0.78, 0.85, 0.66]],
  abductors: [["lo", -0.2, 0.2, -0.15, 0.95, 0.4], ["thigh", -0.05, 0.25, -0.1, 0.55, 0.45]],
  adductors: [["thigh", 0.08, 0.58, 0.02, -0.5, 0.45]],
  hipflex: [["thigh", -0.08, 0.32, 0.5, -0.15, 0.42], ["lo", -0.15, 0.25, 0.55, 0.45, 0.3]],
  calves: [["shin", 0.06, 0.55, -0.48, 0.32, 0.58]],
  tibialis: [["shin", 0.1, 0.62, 0.45, -0.1, 0.36]],
  abs: [["lo", 0.05, 1.02, 0.66, 0, 0.36], ["up", 0, 0.5, 0.72, 0, 0.36]],
  obliques: [["lo", 0.12, 0.98, 0.12, 0.72, 0.42], ["up", 0, 0.35, 0.2, 0.75, 0.35]],
  lowback: [["lo", 0.02, 0.85, -0.66, null, 0.34]],
  lats: [["up", -0.05, 0.62, -0.38, 0.86, 0.48]],
  upperback: [["up", 0.35, 0.98, -0.72, null, 0.36]],
  traps: [["up", 0.72, 1.08, -0.5, 0.42, 0.34], ["neck", 0, 0.5, -0.4, null, 0.6]],
  chest: [["up", 0.42, 0.96, 0.72, 0.42, 0.42]],
  delts: [["upper", -0.06, 0.34, 0.05, 0.25, 0.95]],
  reardelt: [["upper", -0.04, 0.3, -0.5, 0.3, 0.65]],
  rotcuff: [["up", 0.58, 0.98, -0.55, null, 0.42], ["upper", -0.05, 0.22, -0.2, 0.2, 0.7]],
  biceps: [["upper", 0.3, 0.86, 0.45, -0.1, 0.62]],
  triceps: [["upper", 0.28, 0.86, -0.45, 0.3, 0.58]],
  forearms: [["fore", 0.04, 0.58, 0, 0, 0.72]],
  neck: [["neck", -0.1, 0.75, 0, 0, 0.75]],
};
export const MUSCLE_NAMES = Object.keys(MUSCLES) as Muscle[];

// segment radii (proximal, distal)
const R = { thigh: [9.2, 6.2], shin: [6.3, 4.1], upper: [5.6, 4.1], fore: [4.3, 3.1], neck: [4.6, 4.6] } as const;
const TR = { side: 9.5, front: 13 };

interface SegGeo { p1: V; p2: V; r1: number; r2: number; out: V } // out = +offset direction
function segGeo(sk: Skeleton, seg: Seg, side: "N" | "F"): SegGeo {
  const fr = sk.view === "front";
  const leg = side === "N" ? sk.legN : sk.legF;
  const arm = side === "N" ? sk.armN : sk.armF;
  // In front view "out" points away from the midline; in side view "front" (toward +x when standing).
  const lat: V = side === "N" ? [-1, 0] : [1, 0];
  const limbOut = (p1: V, p2: V): V => {
    const n = perpL(norm(sub(p2, p1)));
    if (!fr) return n;
    const mid = sk.pelvis[0] + (sk.neckBase[0] - sk.pelvis[0]) * 0.5;
    const c = lerpV(p1, p2, 0.5);
    const away: V = norm([c[0] - mid + lat[0] * 0.01, 0.0001]);
    return n[0] * away[0] >= 0 ? n : [-n[0], -n[1]];
  };
  switch (seg) {
    case "thigh": return { p1: leg.root, p2: leg.mid, r1: R.thigh[0], r2: R.thigh[1], out: limbOut(leg.root, leg.mid) };
    case "shin": return { p1: leg.mid, p2: leg.end, r1: R.shin[0], r2: R.shin[1], out: limbOut(leg.mid, leg.end) };
    case "upper": return { p1: arm.root, p2: arm.mid, r1: R.upper[0], r2: R.upper[1], out: limbOut(arm.root, arm.mid) };
    case "fore": return { p1: arm.mid, p2: arm.end, r1: R.fore[0], r2: R.fore[1], out: limbOut(arm.mid, arm.end) };
    case "neck": return { p1: sk.neckBase, p2: sk.headC, r1: 4.6, r2: 4.6, out: perpR(sk.headDir) };
    case "lo": case "up": {
      const p1 = seg === "lo" ? sk.pelvis : sk.waist, p2 = seg === "lo" ? sk.waist : sk.neckBase;
      const d = norm(sub(p2, p1));
      const r = fr ? TR.front : TR.side;
      const out = fr ? (side === "N" ? perpL(d) : perpR(d)) : perpR(d);
      return { p1, p2, r1: r, r2: r, out };
    }
  }
}

function muscleShapes(sk: Skeleton, list: Muscle[], where: "far" | "near" | "trunk", op: number): Shape[] {
  const out: Shape[] = [];
  const fr = sk.view === "front";
  for (const m of list) {
    MUSCLES[m].forEach((part, i) => {
      const [seg, t0, t1, so, fo, w] = part;
      const trunk = seg === "lo" || seg === "up" || seg === "neck";
      if (where === "trunk" ? !trunk : trunk) return;
      const off = fr ? fo : so;
      const sides: ("N" | "F")[] = where === "trunk" ? (fr && fo ? ["N", "F"] : ["N"]) : [where === "far" ? "F" : "N"];
      for (const s of sides) {
        const id = `m-${m}-${i}-${where}-${s}`;
        if (off === null) { out.push(path(id, "M0 0Z", "an-m")); continue; } // keeps shape set stable
        const g = segGeo(sk, seg, s);
        const u = norm(sub(g.p2, g.p1));
        const L0 = Math.hypot(g.p2[0] - g.p1[0], g.p2[1] - g.p1[1]);
        const tm = (t0 + t1) / 2;
        const r = g.r1 + (g.r2 - g.r1) * Math.max(0, Math.min(1, tm));
        const c = add(add(g.p1, u, L0 * tm), g.out, off * r);
        const a = Math.max(2, ((t1 - t0) / 2) * L0);
        const sh = path(id, ellipse(c, u, a, Math.max(1.6, w * r)), where === "far" ? "an-m an-far" : "an-m");
        sh.a.opacity = f(op);
        out.push(sh);
      }
    });
  }
  return out;
}

// ---------- body ----------
function torsoSide(sk: Skeleton): string {
  const u1 = trunkDir(sk.t), u2 = trunkDir(sk.t2);
  const f1 = perpR(u1), f2 = perpR(u2);
  const fm = norm(add(f1, f2));
  const P0 = sk.pelvis, W = sk.waist, N = sk.neckBase;
  const C = add(W, u2, 15);
  return blob([
    add(add(P0, f1, 6.5), u1, -5),   // groin / lower belly
    add(add(P0, f1, 8.6), u1, 6),
    add(W, fm, 8.6),                 // belly
    add(C, f2, 10.8),                // chest
    add(add(N, f2, 6), u2, -2),      // collarbone
    add(add(N, f2, -6.5), u2, -2.5), // upper back
    add(C, f2, -9.6),
    add(W, fm, -7.6),                // lumbar
    add(add(P0, f1, -10.6), u1, 1),  // glutes
    add(add(P0, f1, -4), u1, -8.5),  // under glutes
  ]);
}

function torsoFront(sk: Skeleton): string {
  const u1 = trunkDir(sk.t), u2 = trunkDir(sk.t2);
  const l1 = perpL(u1), l2 = perpL(u2); // screen-left = near side
  const ts = sk.ts;
  const P0 = sk.pelvis, W = sk.waist, N = sk.neckBase;
  const sw = L.shW * Math.cos((sk.tw * Math.PI) / 180);
  const hw = Math.abs(sk.hipN[0] - sk.pelvis[0]) > 0.01 || Math.abs(sk.hipN[1] - sk.pelvis[1]) > 0.01
    ? Math.hypot(sk.hipN[0] - sk.pelvis[0], sk.hipN[1] - sk.pelvis[1]) : L.hipW;
  const sh = add(N, u2, -3.5 * ts);
  const pts: V[] = [
    add(N, l2, 5.5),
    add(add(sh, l2, sw + 2.5), u2, 1.5),
    add(add(sh, l2, sw - 0.5), u2, -12 * ts),
    add(W, l1, 11.5),
    add(add(P0, l1, hw + 5), u1, 1),
    add(add(P0, l1, 4), u1, -8),
    add(add(P0, l1, -4), u1, -8),
    add(add(P0, l1, -(hw + 5)), u1, 1),
    add(W, l1, -11.5),
    add(add(sh, l2, -(sw - 0.5)), u2, -12 * ts),
    add(add(sh, l2, -(sw + 2.5)), u2, 1.5),
    add(N, l2, -5.5),
  ];
  return blob(pts);
}

function footPath(sk: Skeleton, leg: Skeleton["legN"], near: boolean): string {
  if (sk.view === "front") {
    const out = near ? -1 : 1;
    const a = leg.end;
    const dir = norm(sub(leg.end, leg.mid));
    return capsule(add(a, dir, 1), add(add(a, dir, 5.5), [out, 0], 2.2), 4.4, 3.4);
  }
  const dir = limbDir(leg.endAng);
  const so = perpR(dir);
  return capsule(add(add(leg.end, so, 3.4), dir, -2.4), add(leg.tip, so, 4.4), 3.7, 2.6, 0.2, 0);
}

function handPath(arm: Skeleton["armN"]): string {
  const d = limbDir(arm.endAng);
  return capsule(add(arm.end, d, 0.5), add(arm.end, d, 6.5), 3.5, 3.1);
}

export function bodyShapes(sk: Skeleton, muscles: Muscle[], effort: number): Shape[] {
  const op = 0.42 + 0.58 * effort;
  const S: Shape[] = [];
  const fr = sk.view === "front";
  const limbSet = (side: "N" | "F", cls: string) => {
    const leg = side === "N" ? sk.legN : sk.legF;
    const arm = side === "N" ? sk.armN : sk.armF;
    return {
      leg: [
        path(`thigh${side}`, capsule(leg.root, leg.mid, R.thigh[0], R.thigh[1], 0.9, 0.5), cls),
        path(`shin${side}`, capsule(leg.mid, leg.end, R.shin[0], R.shin[1], 0.2, 0.9), cls),
        path(`foot${side}`, footPath(sk, leg, side === "N"), cls),
      ],
      arm: [
        path(`upper${side}`, capsule(arm.root, arm.mid, R.upper[0] * Math.min(1, 0.6 + 0.4 * arm.s[0]), R.upper[1], 0.5, 0.5), cls),
        path(`fore${side}`, capsule(arm.mid, arm.end, R.fore[0], R.fore[1], 0.4, 0.2), cls),
        path(`hand${side}`, handPath(arm), cls),
      ],
    };
  };
  const near = limbSet("N", "an-b");
  const far = limbSet("F", fr ? "an-b" : "an-b an-far");
  const G = (g: string, xs: Shape[]) => xs.map((x) => ({ ...x, grp: g }));
  near.leg = G("ln", near.leg); near.arm = G("an", near.arm); far.leg = G("lf", far.leg); far.arm = G("af", far.arm);
  const headParts = (): Shape[] => {
    const hs: Shape[] = G("hd", [
      path("neck", capsule(sk.neckBase, add(sk.neckBase, sk.headDir, L.neck + 3), 4.6, 4.4), "an-b"),
      circ("head", sk.headC, L.head, "an-b"),
    ]);
    if (fr) {
      hs.push(path("face", ellipse(add(add(sk.headC, [sk.nose * 6.5, 0]), sk.headDir, -1.5), norm(sk.headDir), 1.8, 3.2 * Math.cos(Math.asin(Math.max(-1, Math.min(1, sk.nose)))) + 0.8), "an-face"));
    } else {
      const fwd = perpR(sk.headDir);
      hs.push(path("face", ellipse(add(add(sk.headC, fwd, 7.2), sk.headDir, 0.5), norm(sk.headDir), 3.4, 1.6), "an-face"));
    }
    return hs;
  };
  const torso: Shape = { ...path("torso", fr ? torsoFront(sk) : torsoSide(sk), "an-b"), grp: "to" };
  if (fr) {
    S.push(...far.leg, ...G("ln2", near.leg), ...muscleShapes(sk, muscles, "far", op).filter(isLegM), ...muscleShapes(sk, muscles, "near", op).filter(isLegM));
    S.push(torso, ...muscleShapes(sk, muscles, "trunk", op));
    S.push(...headParts());
    S.push(...far.arm, ...near.arm, ...muscleShapes(sk, muscles, "far", op).filter((m) => !isLegM(m)), ...muscleShapes(sk, muscles, "near", op).filter((m) => !isLegM(m)));
  } else {
    S.push(...far.arm, ...muscleShapes(sk, muscles, "far", op * 0.8).filter((m) => !isLegM(m)));
    S.push(...far.leg, ...muscleShapes(sk, muscles, "far", op * 0.8).filter(isLegM));
    const tm = muscleShapes(sk, muscles, "trunk", op);
    S.push(torso, ...tm.filter((m) => !hipM(m)));
    S.push(...headParts());
    S.push(...near.leg, ...tm.filter(hipM), ...muscleShapes(sk, muscles, "near", op).filter(isLegM));
    S.push(...near.arm, ...muscleShapes(sk, muscles, "near", op).filter((m) => !isLegM(m)));
  }
  return S;
}
const LEG_LAYER = new Set<Muscle>(["glutes", "abductors"]);
function isLegM(s: Shape) {
  const m = s.id.split("-")[1] as Muscle;
  const idx = Number(s.id.split("-")[2]);
  const part = MUSCLES[m]?.[idx];
  return part ? part[0] === "thigh" || part[0] === "shin" : false;
}
/** trunk-anchored muscles that sit over the hip and must be drawn above the near thigh */
const hipM = (s: Shape) => LEG_LAYER.has(s.id.split("-")[1] as Muscle);

/** All points of a skeleton (for framing). */
export function skeletonPoints(sk: Skeleton): V[] {
  const c = (x: Skeleton["legN"]) => [x.root, x.mid, x.end, x.tip];
  return [sk.pelvis, sk.waist, sk.neckBase, add(sk.headC, [0, L.head]), add(sk.headC, [L.head, 0]), add(sk.headC, [-L.head, 0]),
    ...c(sk.legN), ...c(sk.legF), ...c(sk.armN), ...c(sk.armF)];
}
