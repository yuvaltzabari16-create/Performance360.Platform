// Upper-body movement patterns: presses, rows, pulls, arms, forearms, shoulders.
import type { Shape } from "./draw";
import type { Pattern } from "./engine";
import { band, barLong, bench, box, cable, dumbbell, dumbbellLong, frame, inclineBench, kettlebell, lineP, pad, plate, pullBar, rail, stick, tower, wall } from "./props";
import { E, grip, hold, midHands, P, pat, rep, seq, STAND, STAND_F, ankle, knee, onTrunk, chest } from "./kit";
import { add, limbDir, trunkDir, type Limb, type Pose, type Skeleton, type V } from "./rig";

export type Imp = "db" | "bb" | "smith" | "machine" | "cable" | "band" | "kb" | "bw" | "plate" | "dowel" | "trx" | "landmine";

/** Root position for a body held straight from the ankle (planks, push-ups, inverted rows). */
export function alignedRoot(ankleP: V, t: number): V {
  const d = limbDir(-t);
  return [ankleP[0] - d[0] * 87, ankleP[1] - d[1] * 87];
}
const STRAIGHT_LEGS = (end: number): Pick<Pose, "ln" | "lf"> => ({ ln: { rel: true, a: [0, 0], end }, lf: { rel: true, a: [0, 0], end } });
/** trunk-frame target for an arm hanging vertically `len` below the shoulder */
export function hangTr(t: number, len = 53): V {
  const u = trunkDir(t);
  const f: V = [u[1], -u[0]];
  return [-len * u[1], -len * f[1]];
}

function implAt(imp: Imp, sk: Skeleton, both = true, layer: "front" | "back" = "front"): Shape[] {
  switch (imp) {
    case "db": return both ? [...dumbbell(grip(sk, "F"), "back"), ...dumbbell(grip(sk), layer)] : dumbbell(grip(sk), layer);
    case "kb": return kettlebell(grip(sk), layer);
    case "bb": return plate(add(midHands(sk), [0, 0]));
    case "smith": return [...plate(grip(sk), "front", 5)];
    case "plate": return plate(grip(sk), "front", 11);
    default: return [];
  }
}

// ---------------- horizontal press ----------------
/** Supine press on a flat bench / floor. */
export function benchPress(o: { imp?: Imp; floor?: boolean; fly?: boolean; skull?: boolean } = {}): Pattern {
  const imp = o.imp ?? "db";
  const h = o.floor ? 10 : 53;
  const base: Pose = { root: [0, h], t: -90, h: 0, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { tr: [0, 52] }, af: { tr: [0, 52] } };
  if (o.fly) {
    const open = P(base, { an: { tr: [1, -2], s: [0.32, 0.32] }, af: { tr: [1, -2], s: [0.32, 0.32] } });
    return pat("side", 3, rep(base, open, { eA: 0.3 }), (sk) => [...(o.floor ? [] : bench(-82, 16, 44)), ...dumbbell(grip(sk), "front"), ...dumbbell(grip(sk, "F"), "back")]);
  }
  if (o.skull) {
    const top = P(base, { an: { a: [194, 192] }, af: { a: [192, 190] } });
    const low = P(base, { an: { a: [194, 292] }, af: { a: [192, 290] } });
    return pat("side", 2.8, rep(top, low, { eA: 0.3 }), (sk) => [...bench(-82, 16, 44), ...dumbbell(grip(sk), "front"), ...dumbbell(grip(sk, "F"), "back")]);
  }
  const low = P(base, { an: { tr: [-3, o.floor ? 22 : 14] }, af: { tr: [-3, o.floor ? 22 : 14] } });
  const props = (sk: Skeleton): Shape[] => [
    ...(o.floor ? [] : bench(-82, 16, 44)),
    ...(imp === "smith" ? rail(-48, 120) : []),
    ...(imp === "bb" ? plate(grip(sk)) : imp === "smith" ? plate(grip(sk), "front", 5) : imp === "db" ? [...dumbbell(grip(sk, "F"), "back"), ...dumbbell(grip(sk), "front")] : []),
  ];
  return pat("side", 2.8, rep(base, low, { eA: 0.3 }), props);
}

/** Seated machine press (chest press / incline machine / overhead machine). */
export function machinePress(o: { dir?: "chest" | "incline" | "overhead" } = {}): Pattern {
  const dir = o.dir ?? "chest";
  const seat = 46;
  const base: Pose = { root: [0, seat + 8], t: dir === "incline" ? -24 : -6, h: 4, ln: { to: [36, 7] }, lf: { to: [32, 7] }, an: { tr: [-4, 12] }, af: { tr: [-4, 12] } };
  const outTr: V = dir === "overhead" ? [50, 4] : dir === "incline" ? [22, 46] : [0, 52];
  const inTr: V = dir === "overhead" ? [4, 6] : [-4, 12];
  const a = P(base, { an: { tr: inTr }, af: { tr: inTr } });
  const b = P(base, { an: { tr: outTr }, af: { tr: outTr } });
  return pat("side", 2.8, rep(a, b, { eA: 0.3 }), (sk) => [
    ...pad([-16, seat], [24, seat], 5), ...pad([-16, seat + 4], [-24 + (dir === "incline" ? -22 : 0), seat + 66], 5),
    ...frame([[-10, 0], [-10, seat - 6], [20, seat - 6], [20, 0]], 3),
    ...pad(add(grip(sk), [0, -6]), add(grip(sk), [0, 6]), 2.6, "front", "an-pad"),
    ...lineP(grip(sk), dir === "overhead" ? [-30, 200] : [-40, 150], 2.4),
  ]);
}

/** Push-up family: hands on floor / bench / bar / plates; optional plate on the back. */
export function pushUp(o: { hands?: "floor" | "bench" | "smith" | "deficit"; weighted?: boolean } = {}): Pattern {
  const hand = o.hands ?? "floor";
  const hy = hand === "bench" ? 47 : hand === "smith" ? 66 : hand === "deficit" ? 15 : 7;
  const toe: V = [-84, 0];
  const make = (lowness: number, e: number): Pose => {
    // pick trunk angle so the shoulders sit above the hands at the right height
    const top = hand === "bench" ? 56 : hand === "smith" ? 46 : 72;
    const low = hand === "bench" ? 70 : hand === "smith" ? 62 : 84;
    const t = top + (low - top) * lowness;
    const anklePos: V = [toe[0] + 2, 13];
    const root = alignedRoot(anklePos, t);
    return { root, t, h: -4, ...STRAIGHT_LEGS(t + 5), an: { to: [handX, hy] }, af: { to: [handX - 3, hy] }, e };
  };
  // hand x from the top position
  const t0 = hand === "bench" ? 56 : hand === "smith" ? 46 : 72;
  const r0 = alignedRoot([toe[0] + 2, 13], t0);
  const sh = add(add(r0, trunkDir(t0), 47.5), [0, 0]);
  const handX = sh[0] + 3;
  const props = (sk: Skeleton): Shape[] => [
    ...(hand === "bench" ? bench(handX - 30, handX + 30, 44) : []),
    ...(hand === "smith" ? [...rail(handX + 6), ...plate([handX, hy - 4], "front", 4)] : []),
    ...(hand === "deficit" ? [...box(handX - 8, handX + 8, 8), ...box(handX - 11, handX + 5, 8)] : []),
    ...(o.weighted ? plate(onTrunk(sk, 8, -10), "front", 12) : []),
  ];
  return pat("side", 2.6, rep(make(0, 0.3), make(1, 1)), props);
}

// ---------------- rows ----------------
export function row(o: { kind: "bent" | "3pt" | "seatedCable" | "machine" | "inclineDB" | "inverted" | "trx" | "halfKneelCable" | "gorilla"; imp?: Imp }): Pattern {
  const k = o.kind;
  if (k === "bent" || k === "gorilla") {
    const t = k === "gorilla" ? 74 : 58;
    const legs = k === "gorilla" ? { ln: { to: [18, 7] as V }, lf: { to: [-22, 7] as V } } : { ln: { to: [4, 7] as V }, lf: { to: [-2, 7] as V } };
    const base: Pose = { root: [-22, 80], t, h: -24, ...legs, an: { tr: hangTr(t, 52) }, af: { tr: hangTr(t, 52) } };
    const pull = P(base, { an: { tr: [-14, 10] }, af: k === "gorilla" ? { tr: hangTr(t, 58) } : { tr: [-14, 10] } });
    const props = (sk: Skeleton) => (k === "gorilla" ? [...kettlebell(grip(sk), "front"), ...kettlebell(grip(sk, "F"), "back")] : o.imp === "bb" ? plate(grip(sk)) : implAt("db", sk));
    return pat("side", 2.6, rep(base, pull), props);
  }
  if (k === "3pt") {
    const t = 70;
    const base: Pose = { root: [-18, 84], t, h: -24, ln: { to: [6, 7] }, lf: { to: [-34, 7] }, an: { tr: hangTr(t, 52) }, af: { to: [40, 47] } };
    const pull = P(base, { an: { tr: [-14, 8] } });
    return pat("side", 2.6, rep(base, pull), (sk) => [...bench(22, 70, 44), ...dumbbell(grip(sk), "front")]);
  }
  if (k === "seatedCable" || k === "machine") {
    const seat = k === "machine" ? 46 : 20;
    const base: Pose = { root: [0, seat + 8], t: k === "machine" ? 14 : 4, h: 0,
      ln: k === "machine" ? { to: [34, 7] } : { to: [70, 22], end: 170 }, lf: k === "machine" ? { to: [30, 7] } : { to: [68, 22], end: 170 },
      an: { tr: [-2, 52] }, af: { tr: [-2, 52] } };
    const pull = P(base, { t: k === "machine" ? 10 : -6, an: { tr: [-20, 6] }, af: { tr: [-20, 6] } });
    const props = (sk: Skeleton): Shape[] => k === "machine"
      ? [...pad([-14, seat], [22, seat], 5), ...pad([30, seat + 30], [34, seat + 62], 5), ...frame([[-8, 0], [-8, seat - 6], [60, 0]], 3), ...lineP(grip(sk), [90, 150], 2.4)]
      : [...box(-20, 20, 20), ...tower(98, 34), ...box(78, 92, 28), ...cable([98, 34], grip(sk)), ...pad(add(grip(sk), [0, -4]), add(grip(sk), [0, 4]), 2.4, "front")];
    return pat("side", 2.8, rep(base, pull), props);
  }
  if (k === "inclineDB") {
    const t = 44;
    const base: Pose = { root: [-14, 52], t, h: -10, ln: { to: [-46, 7] }, lf: { to: [-40, 7] }, an: { tr: hangTr(t, 53) }, af: { tr: hangTr(t, 53) } };
    const pull = P(base, { an: { tr: [-12, 6] }, af: { tr: [-12, 6] } });
    return pat("side", 2.6, rep(base, pull), (sk) => [...inclineBench(-40, -6, 40, 46, 70, 1), ...implAt("db", sk)]);
  }
  if (k === "inverted" || k === "trx") {
    const inv = k === "inverted";
    const ank: V = inv ? [82, 47] : [8, 7];
    const tLow = inv ? -96 : -42, tTop = inv ? -104 : -14;
    const barP: V = inv ? [-50, 92] : [62, 190];
    const mk = (t: number, e: number): Pose => {
      const r = alignedRoot(ank, t);
      const arms: Limb = inv ? { to: barP } : { tr: [0, e > 0.5 ? 18 : 53] };
      return { root: r, t, h: inv ? 10 : 0, ...STRAIGHT_LEGS((inv ? 168 : 118) + t), an: { ...arms, ...(inv || e > 0.5 ? {} : {}) }, af: { ...arms }, e };
    };
    const lo = mk(tLow, 0.3), hi = mk(tTop, 1);
    if (!inv) { lo.an = { tr: [-2, 53] }; lo.af = { tr: [-2, 53] }; hi.an = { tr: [-16, 12] }; hi.af = { tr: [-16, 12] }; }
    const props = (sk: Skeleton): Shape[] => inv
      ? [...box(64, 100, 40), ...pullBar(barP), ...rail(barP[0] - 6, 100)]
      : [...lineP(grip(sk), [barP[0] + 10, 210], 2), ...pad(add(grip(sk), [0, -4]), add(grip(sk), [0, 4]), 2.4, "front")];
    return pat("side", 2.8, rep(lo, hi), props);
  }
  // half-kneeling single-arm cable row
  const base: Pose = { root: [0, 52], t: 4, h: 0, ln: { to: [40, 7] }, lf: { to: [-34, 7], end: 180 }, an: { tr: [-6, 50] }, af: { rel: true, a: [0, 10] } };
  const pull = P(base, { tw: 0, an: { tr: [-22, 4] } });
  return pat("side", 2.8, rep(base, pull), (sk) => [...tower(104, 70), ...cable([104, 70], grip(sk))]);
}

// ---------------- vertical press ----------------
export function overheadPress(o: { imp?: Imp; seated?: boolean; halfKneel?: boolean; incline?: boolean; landmine?: boolean } = {}): Pattern {
  const imp = o.imp ?? "db";
  const seated = o.seated || o.incline;
  const t = o.incline ? -44 : o.seated ? -4 : 2;
  const base: Pose = seated
    ? { root: [0, 54], t, h: o.incline ? 30 : 0, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { tr: [0, 10] }, af: { tr: [0, 10] } }
    : o.halfKneel
      ? { root: [0, 52], t, h: 0, ln: { to: [40, 7] }, lf: { to: [-34, 7], end: 180 }, an: { tr: [0, 10] }, af: { tr: [-4, 10] } }
      : { ...STAND, t, an: { tr: [0, 10] }, af: { tr: [0, 10] } };
  if (o.landmine) {
    const lm = { ...base, ln: { to: [22, 7] as V }, lf: { to: [-26, 7] as V, end: 130 }, t: 8, an: { tr: [-2, 12] as V }, af: { rel: true, a: [-6, 0] as [number, number] } };
    const up = P(lm, { t: 12, an: { tr: [30, 44] } });
    return pat("side", 2.8, rep(lm, up), (sk) => [...lineP([-80, 3], add(grip(sk), [3, 2]), 3.4, "front"), ...plate(add(grip(sk), [-8, -4]), "front", 11)]);
  }
  const outTr: V = o.incline ? [8, 50] : [52, 3];
  const up = P(base, { an: { tr: outTr }, af: o.halfKneel ? base.af : { tr: outTr } });
  const props = (sk: Skeleton): Shape[] => [
    ...(o.incline ? inclineBench(-24, 14, 44, 46, 68) : seated ? [...bench(-24, 18, 44), ...(o.seated ? pad([-18, 50], [-20, 110], 4.5) : [])] : []),
    ...(imp === "smith" ? rail(-10) : []),
    ...(imp === "bb" ? plate(grip(sk)) : imp === "smith" ? plate(grip(sk), "front", 5) : imp === "db" ? (o.halfKneel ? dumbbell(grip(sk), "front") : implAt("db", sk)) : []),
    ...(imp === "machine" ? [...pad(add(grip(sk), [0, -6]), add(grip(sk), [0, 6]), 2.6, "front", "an-pad"), ...lineP(grip(sk), [-36, 200], 2.4)] : []),
  ];
  return pat("side", 2.8, rep(base, up, { eA: 0.3 }), props);
}

// ---------------- vertical pull ----------------
export function pullUp(o: { chin?: boolean; assisted?: boolean } = {}): Pattern {
  const bar: V = [6, 218];
  const mk = (shY: number, e: number): Pose => {
    const root: V = [-2, shY - 47.5];
    return { root, t: -2, h: shY > 190 ? -6 : 4,
      ln: o.assisted ? { a: [94, -4] } : { a: [6, -40] }, lf: o.assisted ? { a: [94, -4] } : { a: [10, -36] },
      an: { to: bar, bend: -1 }, af: { to: add(bar, [-2, 0]), bend: -1 }, e };
  };
  const lo = mk(bar[1] - 54, 0.3), hi = mk(bar[1] - 16, 1);
  return pat("side", 3, rep(lo, hi), (sk) => [...pullBar(bar), ...(o.assisted ? [...pad(add(knee(sk), [-6, -8]), add(knee(sk), [26, -8]), 4.5, "back"), ...frame([[20, 0], [20, 60], [10, 0]], 3)] : [])]);
}

export function pulldown(o: { grip?: "wide" | "close"; halfKneel?: boolean; alternating?: boolean } = {}): Pattern {
  const seat = o.halfKneel ? 0 : 46;
  const base: Pose = o.halfKneel
    ? { root: [0, 52], t: 6, h: -6, ln: { to: [40, 7] }, lf: { to: [-34, 7], end: 180 }, an: { tr: [52, 6] }, af: { rel: true, a: [0, 10] } }
    : { root: [0, seat + 8], t: 8, h: -6, ln: { to: [34, 7] }, lf: { to: [30, 7] }, an: { tr: [52, 6] }, af: { tr: [52, 6] } };
  const down = P(base, { t: o.halfKneel ? 10 : 2, h: -8, an: { tr: o.grip === "close" ? [10, 14] : [12, 6] }, af: o.halfKneel ? base.af : o.alternating ? { tr: [52, 6] } : { tr: o.grip === "close" ? [10, 14] : [12, 6] } });
  const props = (sk: Skeleton): Shape[] => [
    ...(o.halfKneel ? [] : [...pad([-14, seat], [22, seat], 5), ...pad(add(knee(sk), [-8, 8]), add(knee(sk), [8, 8]), 4.2, "front"), ...frame([[-6, 0], [-6, seat - 6]], 3)]),
    ...tower(-36, 205),
    ...cable([0, 205], grip(sk), "back"),
    ...(o.halfKneel ? [] : stick(add(grip(sk), [-6, 0]), add(grip(sk), [6, 0]), "front", 3)),
  ];
  return pat("side", 2.8, rep(base, down), props);
}

// ---------------- arms ----------------
export function curl(o: { imp?: Imp; incline?: boolean; single?: boolean } = {}): Pattern {
  const imp = o.imp ?? "db";
  if (o.incline) {
    const base: Pose = { root: [0, 54], t: -30, h: 16, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { a: [-6, -6] }, af: { a: [-8, -8] } };
    const up = P(base, { an: { a: [-6, 134] }, af: { a: [-8, 132] } });
    return pat("side", 2.8, rep(base, up), (sk) => [...inclineBench(-28, 16, 44, 62, 70), ...implAt("db", sk)]);
  }
  const base: Pose = { ...STAND, an: { a: [-3, 4] }, af: { a: [-5, 2] } };
  const up = P(base, { an: { a: [2, 140] }, af: o.single ? base.af : { a: [0, 138] } });
  const props = (sk: Skeleton): Shape[] => [
    ...(imp === "cable" ? [...tower(46, 10), ...cable([46, 10], grip(sk))] : []),
    ...(imp === "db" ? implAt("db", sk) : imp === "bb" ? plate(grip(sk)) : []),
  ];
  return pat("side", 2.6, rep(base, up), props);
}

export function triceps(o: { kind: "pushdown" | "overheadCable" | "overheadDB" }): Pattern {
  if (o.kind === "pushdown") {
    const base: Pose = { ...STAND, t: 10, h: -6, an: { a: [-4, 128] }, af: { a: [-6, 126] } };
    const down = P(base, { an: { a: [-4, 4] }, af: { a: [-6, 2] } });
    return pat("side", 2.6, rep(base, down), (sk) => [...tower(42, 200), ...cable([42, 200], grip(sk))]);
  }
  if (o.kind === "overheadDB") {
    const base: Pose = { root: [0, 54], t: 0, h: 0, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { a: [172, 312] }, af: { a: [170, 310] } };
    const up = P(base, { an: { a: [174, 178] }, af: { a: [172, 176] } });
    return pat("side", 2.8, rep(base, up), (sk) => [...bench(-24, 18, 44), ...dumbbell(midHands(sk), "front", 7)]);
  }
  const base: Pose = { ...STAND, root: [0, 92], t: 24, h: -6, ln: { to: [26, 7] }, lf: { to: [-26, 7], end: 120 }, an: { a: [150, 310] }, af: { a: [148, 308] } };
  const ext = P(base, { an: { a: [152, 150] }, af: { a: [150, 148] } });
  return pat("side", 2.8, rep(base, ext), (sk) => [...tower(-70, 120), ...cable([-70, 120], grip(sk))]);
}

/** Wrist work: seated, forearm on the thigh, hand past the knee. */
export function wrist(o: { kind: "flex" | "ext" | "prosup" | "radial"; band?: boolean }): Pattern {
  const base: Pose = { root: [0, 54], t: 30, h: -10, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { to: [52, 58] }, af: { a: [10, 60] } };
  const lim = (end: number, x = 0): Pose => ({ ...base, an: { to: [52, 58], end }, x });
  const props = (sk: Skeleton): Shape[] => {
    const h = add(sk.armN.end, limbDir(sk.armN.endAng), 5);
    const seat = bench(-26, 16, 44);
    if (o.band) return [...seat, ...band(h, add(sk.legN.tip, [-6, 2]), "front")];
    if (o.kind === "prosup") return [...seat, ...dumbbellLong(h, [Math.sin(sk.x) * 0.25, Math.cos(sk.x)], "front", 0.75)];
    return [...seat, ...dumbbell(h, "front", 5)];
  };
  if (o.kind === "prosup") return pat("side", 2.6, seq([E(lim(90, -1.2), 0.6), E(lim(90, 1.2), 1)]), props);
  const a = o.kind === "flex" ? 60 : o.kind === "ext" ? 120 : 112;
  const b = o.kind === "flex" ? 140 : o.kind === "ext" ? 50 : 150;
  return pat("side", 2.4, rep(lim(a), lim(b)), props);
}

// ---------------- shoulders ----------------
export function dips(o: { machine?: boolean; weighted?: boolean } = {}): Pattern {
  if (o.machine) {
    const seat = 50;
    const base: Pose = { root: [0, seat + 8], t: 2, h: 0, ln: { to: [36, 7] }, lf: { to: [32, 7] }, an: { to: [10, 92] }, af: { to: [8, 92] } };
    const down = P(base, { an: { to: [8, 60] }, af: { to: [6, 60] } });
    return pat("side", 2.8, rep(base, down), (sk) => [...pad([-14, seat], [22, seat], 5), ...pad([-14, seat + 4], [-20, seat + 64], 5), ...frame([[-6, 0], [-6, seat - 6]], 3), ...pad(add(grip(sk), [-4, 0]), add(grip(sk), [12, 0]), 2.6, "front")]);
  }
  const barY = 120;
  const mk = (shY: number, e: number): Pose => ({ root: [-4, shY - 47.5], t: shY > 150 ? 4 : 22, h: -4, ln: { a: [-8, -86] }, lf: { a: [-4, -80] }, an: { to: [4, barY] }, af: { to: [2, barY] }, e });
  return pat("side", 2.8, rep(mk(barY + 54, 0.3), mk(barY + 22, 1)), (sk) => [...lineP([-30, barY - 3], [40, barY - 3], 3.4, "back"), ...lineP([30, 0], [30, barY - 3], 3, "back"),
    ...(o.weighted ? plate(add(sk.pelvis, [4, -40]), "front", 11) : [])]);
}

export function fly(o: { kind: "flat" | "incline" | "machine" | "reverseBent" | "reverseMachine" | "reverseChest" }): Pattern {
  if (o.kind === "flat") return benchPress({ fly: true });
  if (o.kind === "incline") {
    const base: Pose = { root: [0, 54], t: -44, h: 30, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { tr: [6, 50] }, af: { tr: [6, 50] } };
    const open = P(base, { an: { tr: [1, -2], s: [0.32, 0.32] }, af: { tr: [1, -2], s: [0.32, 0.32] } });
    return pat("side", 3, rep(base, open, { eA: 0.3 }), (sk) => [...inclineBench(-24, 14, 44, 46, 68), ...implAt("db", sk)]);
  }
  if (o.kind === "machine") {
    // front view, seated: arms sweep from out wide to together in front
    const base: Pose = { ...STAND_F, root: [0, 58], t: 0, ln: { to: [-14, 7] }, lf: { to: [14, 7] }, an: { a: [-90, -100] }, af: { a: [90, 100] } };
    const close = P(base, { an: { a: [-90, -100], s: [0.35, 0.5] }, af: { a: [90, 100], s: [0.35, 0.5] } });
    return pat("front", 2.8, rep(base, close), () => [...pad([-24, 50], [24, 50], 5), ...pad([0, 54], [0, 118], 13, "back", "an-pad2")]);
  }
  // reverse flies: front view, torso bent toward the camera, arms rise out to the sides
  const seated = o.kind === "reverseMachine";
  const base: Pose = seated
    ? { ...STAND_F, root: [0, 58], t: 0, ln: { to: [-14, 7] }, lf: { to: [14, 7] }, an: { a: [-90, -96], s: [0.3, 0.4] }, af: { a: [90, 96], s: [0.3, 0.4] } }
    : { ...STAND_F, root: [0, 88], t: 0, ts: 0.42, h: 0, ln: { to: [-14, 7] }, lf: { to: [14, 7] }, an: { a: [-6, -4] }, af: { a: [6, 4] } };
  const open = seated ? P(base, { an: { a: [-90, -96] }, af: { a: [90, 96] } }) : P(base, { an: { a: [-84, -88] }, af: { a: [84, 88] } });
  return pat("front", 2.8, rep(base, open), (sk) => [
    ...(seated ? [...pad([-24, 50], [24, 50], 5), ...pad([0, 70], [0, 122], 13, "back", "an-pad2")] : [...dumbbell(grip(sk), "front"), ...dumbbell(grip(sk, "F"), "front")]),
  ]);
}

export function raise(o: { kind: "lateral" | "forward" | "scaption"; band?: boolean }): Pattern {
  if (o.kind === "forward") {
    const base: Pose = { ...STAND, an: { a: [6, 8] }, af: { a: [2, 4] } };
    const up = P(base, { an: { a: [86, 88] }, af: { a: [82, 84] } });
    return pat("side", 2.6, rep(base, up), (sk) => [...dumbbell(grip(sk), "front"), ...dumbbell(grip(sk, "F"), "back")]);
  }
  const sc = o.kind === "scaption" ? 0.88 : 1;
  const base: Pose = { ...STAND_F, an: { a: [-10, -8], s: [sc, sc] }, af: { a: [10, 8], s: [sc, sc] } };
  const up = P(base, { an: { a: [o.kind === "scaption" ? -100 : -88, o.kind === "scaption" ? -104 : -92], s: [sc, sc] }, af: { a: [o.kind === "scaption" ? 100 : 88, o.kind === "scaption" ? 104 : 92], s: [sc, sc] } });
  const props = (sk: Skeleton): Shape[] => o.band
    ? [...band(grip(sk), add(ankle(sk), [0, -3]), "front"), ...band(grip(sk, "F"), add(ankle(sk, "F"), [0, -3]), "front")]
    : [...dumbbell(grip(sk), "front"), ...dumbbell(grip(sk, "F"), "front")];
  return pat("front", 2.6, rep(base, up), props);
}

export function facePull(o: { band?: boolean } = {}): Pattern {
  const base: Pose = { ...STAND, t: -4, h: 0, ln: { to: [16, 7] }, lf: { to: [-16, 7] }, an: { tr: [16, 50] }, af: { tr: [16, 50] } };
  const pull = P(base, { an: { tr: [18, 6], bend: 1 }, af: { tr: [18, 6], bend: 1 } });
  return pat("side", 2.8, rep(base, pull), (sk) => [
    ...(o.band ? [...lineP([90, 0], [90, 190], 4), ...band(grip(sk), [90, 150])] : [...tower(92, 150), ...cable([92, 150], grip(sk))]),
  ]);
}

export function pullApart(): Pattern {
  const base: Pose = { ...STAND_F, an: { a: [-90, -90], s: [0.3, 0.3] }, af: { a: [90, 90], s: [0.3, 0.3] } };
  const open = P(base, { an: { a: [-90, -90] }, af: { a: [90, 90] } });
  return pat("front", 2.4, rep(base, open), (sk) => band(grip(sk), grip(sk, "F"), "front"));
}

/** Shoulder rotation drills.
 *  side:   forearm rotates from forward (horizontal) to up — upper arm points at the camera (90/90) or rests on the knee.
 *  front:  standing, elbow at the side; forearm sweeps outward (ER) or inward (IR); shown as forearm length change. */
export function rotation(o: { mode: "er" | "ir"; setup: "side" | "9090" | "knee" | "sidelying" | "9090side"; imp: Imp; iso?: boolean }): Pattern {
  const { mode, setup, imp } = o;
  const er = mode === "er";
  if (setup === "side") {
    // front view, elbow tucked; forearm projects out to the side (ER) or across the belly (IR)
    const s0 = 0.25;
    const fwd: Pose = { ...STAND_F, an: { a: [-2, er ? -90 : 90], s: [1, s0] }, af: { a: [6, 4] } };
    const out = P(fwd, { an: { a: [-2, er ? -90 : 90], s: [1, er ? 0.95 : 0.7] } });
    const props = (sk: Skeleton): Shape[] => imp === "cable" ? [...tower(er ? 70 : -80, 98), ...cable([er ? 70 : -80, 98], grip(sk))] : imp === "band" ? band(grip(sk), [er ? 80 : -86, 98]) : dumbbell(grip(sk), "front");
    if (o.iso) return pat("front", 3, hold(P(fwd, { an: { a: [-2, er ? -90 : 90], s: [1, 0.45] } }), [0, 0]), props);
    return pat("front", 2.6, rep(fwd, out), props);
  }
  if (setup === "sidelying") {
    // lying on the far side (front view); top arm's forearm rotates up from the belly
    const lie: Pose = { root: [0, 18], t: -90, h: 0, ln: { to: [86, 10] }, lf: { to: [86, 17] }, an: { a: [-92, -60] }, af: { a: [90, 180], s: [1, 0.3] } };
    const up = P(lie, { af: { a: [90, 180], s: [1, 0.95] } });
    return pat("front", 2.6, rep(lie, up), (sk) => dumbbell(grip(sk, "F"), "front"));
  }
  // side view: forearm in the sagittal plane
  const knee0 = setup === "knee";
  const seated = knee0 || setup === "9090side";
  const upper: Limb = knee0 ? { a: [72, 0] } : { a: [90, 0], s: [0.15, 1] };
  const base: Pose = seated
    ? { root: [0, 54], t: knee0 ? 22 : 0, h: 0, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: upper, af: { a: [6, 20] } }
    : { ...STAND, an: upper, af: { a: [-4, 2] } };
  const lo = knee0 ? 92 : 92, hi = 178;
  const A = P(base, { an: { ...upper, a: [upper.a![0], er ? lo : hi] } }), B = P(base, { an: { ...upper, a: [upper.a![0], er ? hi : lo] } });
  const props = (sk: Skeleton): Shape[] => [
    ...(seated ? bench(-24, 18, 44) : []),
    ...(setup === "9090side" ? pad(add(sk.armN.mid, [0, -8]), add(sk.armN.mid, [0, -40]), 3, "back") : []),
    ...(imp === "cable" ? [...tower(er ? -70 : 80, sk.armN.mid[1] + 20), ...cable([er ? -70 : 80, sk.armN.mid[1] + 20], grip(sk))] : imp === "band" ? band(grip(sk), [er ? -80 : 90, sk.armN.mid[1] + 20]) : dumbbell(grip(sk), "front")),
  ];
  if (o.iso) return pat("side", 3, hold(P(base, { an: { ...upper, a: [upper.a![0], 135] } }), [0, 0]), props);
  return pat("side", 2.6, rep(A, B), props);
}

void dumbbellLong; void barLong; void wall; void chest; void stick;
