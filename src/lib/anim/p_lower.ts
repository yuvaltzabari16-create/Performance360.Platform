// Lower-body movement patterns.
import type { Shape } from "./draw";
import type { Pattern } from "./engine";
import { box, bench, dumbbell, kettlebell, plate, rail, wall, wedge, pad, frame, lineP, band, slider, hand as manualHand, inclineBench, softBlob, physioBall, medball } from "./props";
import { chest, E, grip, hipFront, hold, nape, onTrunk, P, pat, rep, seq, STAND, STAND_F, ankle, knee } from "./kit";
import { add, type Pose, type Skeleton, type V } from "./rig";

export type Load = "none" | "goblet" | "db" | "kb" | "back" | "front" | "zercher" | "smith" | "trap" | "plate";

const holdArms = (load: Load): Pick<Pose, "an" | "af"> => {
  switch (load) {
    case "goblet": return { an: { tr: [-12, 13] }, af: { tr: [-12, 13] } };
    case "back": case "smith": return { an: { tr: [0, -9], bend: 1 }, af: { tr: [0, -10], bend: 1 } };
    case "front": return { an: { tr: [1, 9], bend: 1 }, af: { tr: [1, 9], bend: 1 } };
    case "zercher": return { an: { tr: [-26, 18], bend: -1 }, af: { tr: [-26, 18], bend: -1 } };
    case "db": case "kb": case "trap": return { an: { a: [2, 2] }, af: { a: [-2, -2] } };
    case "plate": return { an: { tr: [-18, 12] }, af: { tr: [-18, 12] } };
    default: return { an: { a: [4, 6] }, af: { a: [-4, 0] } };
  }
};
export function loadProps(load: Load, sk: Skeleton): Shape[] {
  switch (load) {
    case "goblet": return dumbbell(add(grip(sk), [0, 1]), "front", 6.5);
    case "db": return [...dumbbell(grip(sk, "F"), "back"), ...dumbbell(grip(sk), "front")];
    case "trap": return plate(add(grip(sk), [0, 2]));
    case "kb": return kettlebell(grip(sk), "front");
    case "back": return plate(nape(sk));
    case "smith": return plate(nape(sk), "front", 5);
    case "front": return plate(onTrunk(sk, 24, 9));
    case "zercher": return plate(add(sk.armN.mid, [3, 3]));
    case "plate": return plate(grip(sk), "front", 11);
    default: return [];
  }
}

// ---------------- squat family ----------------
export interface SquatOpt { load?: Load; box?: boolean; heels?: boolean; machine?: "hack" | "pendulum"; depth?: number }
export function squat(o: SquatOpt = {}): Pattern {
  const load = o.load ?? "none";
  const d = o.depth ?? 1;
  const heel = o.heels ? 6 : 0;
  const feet = { ln: { to: [3, 7 + heel] as V, end: o.heels ? 72 : 90 }, lf: { to: [-3, 7 + heel] as V, end: o.heels ? 72 : 90 } };
  const upright = load === "front" || load === "goblet" || load === "zercher" || o.heels || o.machine;
  const top = P(STAND, { ...feet, root: [0, 94 + heel], t: 4, ...holdArms(load) });
  const lean = upright ? 18 : 36;
  const hipX = upright ? -18 : -27;
  const bot = P(top, { root: [hipX * d, (94 + heel) - 44 * d], t: lean * d + 3, h: -6,
    ...(load === "none" ? { an: { a: [86, 88] }, af: { a: [82, 86] } } : holdArms(load)) });
  const props = (sk: Skeleton) => [
    ...(o.box ? box(-52, -18, 42) : []),
    ...(o.heels ? wedge(-8, 24, heel, "left") : []),
    ...(load === "smith" ? rail(-6) : []),
    ...(o.machine ? [...pad(add(nape(sk), [-4, -18]), add(nape(sk), [-10, 14]), 4.2, "back"), ...frame([[-40, 0], [-34, 120], [-20, 200]], 3)] : []),
    ...loadProps(load, sk),
  ];
  return pat("side", 3, rep(top, bot), props);
}

export function legPress(o: { single?: boolean; horizontal?: boolean; calf?: boolean } = {}): Pattern {
  // reclined on the sled seat, pushing the foot plate
  const seatH = 32;
  const base: Pose = {
    root: [0, seatH + 9], t: o.horizontal ? -78 : -62, h: 25,
    ln: { to: [52, 90] }, lf: { to: [48, 88] },
    an: { rel: true, a: [40, 60] }, af: { rel: true, a: [40, 60] },
  };
  const plateAt = (k: number): V => (o.horizontal ? [40 + 44 * k, 44] : [32 + 38 * k, 50 + 42 * k]);
  if (o.calf) {
    const top = P(base, { ln: { to: plateAt(1), end: 150 }, lf: { a: [70, 90] } });
    const bot = P(base, { ln: { to: plateAt(1), end: 175 }, lf: { a: [70, 90] } });
    return pat("side", 2.4, rep(top, bot), (sk) => press(sk, plateAt(1)));
  }
  const ext = P(base, { ln: { to: plateAt(1) }, lf: o.single ? { a: [62, 100] } : { to: add(plateAt(1), [-3, -2]) } });
  const flex = P(base, { ln: { to: plateAt(0.18) }, lf: o.single ? { a: [62, 100] } : { to: add(plateAt(0.18), [-3, -2]) } });
  function press(sk: Skeleton, p: V): Shape[] {
    const ang = o.horizontal ? 0 : -45;
    const r = (ang * Math.PI) / 180;
    const u: V = [-Math.sin(r), Math.cos(r)];
    return [
      ...frame(o.horizontal ? [[-36, 30], [-30, 30], [-26, 0]] : [[-34, 28], [-20, 0]], 3),
      ...pad([-30, seatH], [10, seatH], 4.5, "back"),
      ...pad([-30, seatH + 2], o.horizontal ? [-40, seatH + 60] : [-58, seatH + 50], 4.5, "back"),
      ...lineP(add(p, [8, 0]), o.horizontal ? [150, 44] : [130, 140], 3),
      ...pad(add(add(sk.legN.end, [8, 0]), u, -14), add(add(sk.legN.end, [8, 0]), u, 14), 3, "back"),
    ];
  }
  return pat("side", 3, rep(ext, flex), (sk) => press(sk, sk.legN.end));
}

/** Single-leg squat to box / kickstand squat. */
export function singleLegSquat(o: { kickstand?: boolean } = {}): Pattern {
  const top = P(STAND, { root: [0, 94], t: 6, lf: o.kickstand ? { to: [-14, 7], end: 120 } : { a: [28, 20] }, an: { a: [70, 72] }, af: { a: [66, 70] } });
  const bot = P(top, { root: [-24, 54], t: 34, h: -6, lf: o.kickstand ? { to: [-14, 7], end: 120 } : { a: [76, 86] } });
  return pat("side", 3.2, rep(top, bot), () => box(-56, -22, 44));
}

/** Wall sit / wall squat. */
export function wallSit(o: { single?: boolean; weighted?: boolean; dynamic?: boolean; heels?: boolean } = {}): Pattern {
  const heel = o.heels ? 6 : 0;
  const sit: Pose = {
    root: [-20, 50 + heel], t: 0, ln: { to: [24, 7 + heel], end: o.heels ? 74 : 90 }, lf: o.single ? { a: [88, 92] } : { to: [20, 7 + heel], end: o.heels ? 74 : 90 },
    an: { rel: true, a: [8, 30] }, af: { rel: true, a: [6, 24] },
  };
  const props = (sk: Skeleton) => [...wall(-31, 190, -1), ...(o.heels ? wedge(14, 40, heel, "left") : []),
    ...(o.weighted ? plate(add(knee(sk), [-14, 9]), "front", 11) : [])];
  if (o.dynamic) {
    const up = P(sit, { root: [-20, 86 + heel], t: 0 });
    return pat("side", 3, rep(up, sit), props);
  }
  return pat("side", 3, hold(sit), props);
}

// ---------------- split squat / lunge family ----------------
export interface SplitOpt { load?: Load; reduced?: boolean; support?: boolean; wallFront?: boolean; rfe?: boolean; smith?: boolean }
export function splitSquat(o: SplitOpt = {}): Pattern {
  const load = o.smith ? "smith" : o.load ?? "none";
  const front: V = [30, 7], back: V = o.rfe ? [-46, 46] : [-38, 7];
  const arms = o.support ? { an: { to: [60, 92] as V }, af: { rel: true, a: [-4, 0] as [number, number] } } : holdArms(load);
  const top = P(STAND, { root: [-4, o.rfe ? 90 : 88], t: 3, ln: { to: front }, lf: { to: back, end: o.rfe ? 160 : 130 }, ...arms });
  const depth = o.reduced ? 18 : o.rfe ? 40 : 36;
  const bot = P(top, { root: [-6, top.root[1] - depth], t: o.rfe ? 12 : 4, lf: { to: back, end: o.rfe ? 160 : 128 } });
  const props = (sk: Skeleton) => [
    ...(o.rfe ? bench(-80, -36, 40) : []),
    ...(o.support ? lineP([64, 0], [64, 130], 3.2) : []),
    ...(o.wallFront ? wall(52, 190, 1) : []),
    ...(load === "smith" ? rail(-8) : []),
    ...loadProps(load, sk),
  ];
  return pat("side", 3, rep(top, bot), props);
}

export function reverseLunge(o: { load?: Load; smith?: boolean; walking?: boolean } = {}): Pattern {
  const load = o.smith ? "smith" : o.load ?? "none";
  const arms = holdArms(load);
  if (o.walking) {
    const stand = P(STAND, { root: [-2, 94], ln: { to: [0, 7] }, lf: { to: [-4, 7] }, ...arms });
    const step = P(stand, { root: [14, 58], t: 4, ln: { to: [46, 7] }, lf: { to: [-22, 7], end: 128 } });
    const mid = P(stand, { root: [6, 92], ln: { a: [40, -10] }, lf: { to: [-6, 7] } });
    return pat("side", 2.6, [{ t: 0, p: E(stand, 0.1) }, { t: 0.22, p: E(mid, 0.3) }, { t: 0.45, p: E(step, 1) }, { t: 0.55, p: E(step, 1) }, { t: 1, p: E(stand, 0.1) }],
      (sk) => [...loadProps(load, sk)]);
  }
  const stand = P(STAND, { ln: { to: [3, 7] }, lf: { to: [-3, 7] }, ...arms });
  const mid = P(stand, { root: [0, 90], lf: { to: [-22, 22], end: 120 } });
  const low = P(stand, { root: [-6, 56], t: 6, ln: { to: [26, 7] }, lf: { to: [-42, 7], end: 128 } });
  return pat("side", 3, [{ t: 0, p: E(stand, 0.1) }, { t: 0.2, p: E(mid, 0.4) }, { t: 0.45, p: E(low, 1) }, { t: 0.55, p: E(low, 1) }, { t: 0.8, p: E(mid, 0.4) }, { t: 1, p: E(stand, 0.1) }],
    (sk) => [...(load === "smith" ? rail(-8) : []), ...loadProps(load, sk)]);
}

/** Lateral lunge (front view). */
export function lateralLunge(o: { goblet?: boolean; box?: boolean } = {}): Pattern {
  const arms = o.goblet ? { an: { tr: [-12, -10] as V, bend: 1 }, af: { tr: [-12, -10] as V, bend: -1 } } : { an: { a: [-10, 30] as [number, number] }, af: { a: [10, -30] as [number, number] } };
  const st = P(STAND_F, { ln: { to: [-14, 7] }, lf: { to: [14, 7] }, ...arms });
  const lo = P(st, { root: [-26, 56], t: -16, t2: -10, ln: { to: [-52, 7] }, lf: { to: [24, 7] } });
  return pat("front", 3.2, [{ t: 0, p: E(st, 0.1) }, { t: 0.42, p: E(lo, 1) }, { t: 0.55, p: E(lo, 1) }, { t: 1, p: E(st, 0.1) }],
    (sk) => [...(o.box ? box(-70, -40, 26, 0) : []), ...(o.goblet ? dumbbell(add(sk.armN.end, [(sk.armF.end[0] - sk.armN.end[0]) / 2, 2]), "front", 6.5) : [])]);
}

export function stepUp(o: { support?: boolean; load?: Load } = {}): Pattern {
  const load = o.load ?? "none";
  const arms = o.support ? { an: { to: [62, 104] as V }, af: { rel: true, a: [-4, 0] as [number, number] } } : holdArms(load);
  const bottom = P(STAND, { root: [-10, 94], t: 4, ln: { to: [24, 47] }, lf: { to: [-12, 7] }, ...arms });
  const topP = P(STAND, { root: [22, 134], t: 2, ln: { to: [26, 47] }, lf: { to: [18, 64], end: 110 }, ...arms });
  const mid = P(bottom, { root: [6, 104], t: 18, lf: { to: [-8, 14], end: 125 } });
  return pat("side", 3, [{ t: 0, p: E(bottom, 0.2) }, { t: 0.25, p: E(mid, 0.8) }, { t: 0.45, p: E(topP, 1) }, { t: 0.6, p: E(topP, 1) }, { t: 0.8, p: E(mid, 0.6) }, { t: 1, p: E(bottom, 0.2) }],
    (sk) => [...box(8, 58, 40), ...(o.support ? lineP([66, 0], [66, 140], 3.2) : []), ...loadProps(load, sk)]);
}

/** Lateral step down from a box (front view): stance leg bends, free leg lowers to tap the floor. */
export function lateralStepDown(o: { wall?: boolean } = {}): Pattern {
  const st = P(STAND_F, { root: [8, 134], ln: { a: [-12, -8] }, lf: { to: [16, 47] }, an: { a: [-24, -8], s: [0.7, 0.7] }, af: { a: [24, 8], s: [0.7, 0.7] } });
  const lo = P(st, { root: [10, 110], t: -6, ln: { to: [-14, 9] }, lf: { to: [16, 47] } });
  return pat("front", 3, rep(st, lo), () => [...box(4, 44, 40), ...(o.wall ? wall(52, 190, 1) : [])]);
}

// ---------------- hinge family ----------------
export function rdl(o: { load?: Load; deadlift?: boolean; trap?: boolean } = {}): Pattern {
  const load = o.trap ? "trap" : o.load ?? "back";
  const isBar = load === "back";
  const arms = { an: { rel: true, a: [-2, -2] as [number, number] }, af: { rel: true, a: [-4, -4] as [number, number] } };
  const top = P(STAND, { root: [0, 94], t: 2, ...arms, an: { a: [4, 4] }, af: { a: [2, 2] } });
  const bot = o.deadlift || o.trap
    ? P(top, { root: [-22, o.trap ? 58 : 54], t: o.trap ? 40 : 52, h: -18, ln: { to: [3, 7] }, lf: { to: [-3, 7] }, an: { a: [4, 4] }, af: { a: [2, 2] } })
    : P(top, { root: [-24, 86], t: 80, h: -30, ln: { to: [3, 7] }, lf: { to: [-3, 7] }, an: { a: [2, 2] }, af: { a: [0, 0] } });
  const props = (sk: Skeleton) => {
    if (isBar) return plate(add(grip(sk), [2, 0]));
    return loadProps(load, sk);
  };
  return pat("side", 3, o.deadlift || o.trap ? rep(bot, top, { down: 0.4 }) : rep(top, bot), props);
}

export function slRdl(o: { load?: Load; support?: boolean; kickstand?: boolean; smith?: boolean; landmine?: boolean } = {}): Pattern {
  const load: Load = o.smith ? "smith" : o.load ?? "none";
  const top = P(STAND, { root: [0, 94], t: 2, ln: { to: [3, 7] }, lf: o.kickstand ? { to: [-16, 7], end: 120 } : { a: [-6, -10], end: 120 },
    an: o.support ? { to: [44, 104] } : { a: [4, 4] }, af: { a: [2, 2] } });
  const bot = P(top, { root: [-12, 90], t: o.kickstand ? 66 : 84, h: -30, ln: { to: [6, 7] },
    lf: o.kickstand ? { to: [-16, 7], end: 120 } : { a: [-84, -86], end: 0 },
    an: o.support ? { to: [44, 84] } : { a: [0, 0] }, af: { a: [-2, -2] } });
  const props = (sk: Skeleton): Shape[] => [
    ...(o.support ? lineP([48, 0], [48, 130], 3.2) : []),
    ...(o.smith ? [...rail(14), ...plate(grip(sk), "front", 5)] : []),
    ...(o.landmine ? [...lineP([-60, 2], add(grip(sk), [2, 0]), 3.4, "front"), ...plate(add(grip(sk), [-6, -2]), "front", 11)] : []),
    ...(!o.smith && !o.landmine && load !== "none" ? loadProps(load, sk) : []),
  ];
  return pat("side", 3.2, rep(top, bot), props);
}

/** Roman chair / GHR back extension. */
export function backExtension(o: { iso?: boolean; weighted?: boolean; single?: boolean; ghr?: boolean } = {}): Pattern {
  // hips on the pad, feet locked behind; body rises to straight
  const padTop: V = [6, 86];
  const legs = { ln: { to: [-72, 38] as V, end: 10 }, lf: o.single ? { a: [-62, -60] as [number, number] } : { to: [-74, 36] as V, end: 10 } };
  const arms = { an: { tr: [-10, 11] as V }, af: { tr: [-10, 11] as V } };
  const up: Pose = { root: [-6, 92], t: 52, h: -6, ...legs, ...arms };
  const down = P(up, { t: 150, h: -14 });
  const props = (sk: Skeleton): Shape[] => [
    ...frame(o.ghr ? [[-80, 0], [-76, 30], [8, 74], [24, 0]] : [[-82, 0], [-76, 30], [8, 76], [26, 0]], 3.2),
    ...pad([-2, 82], [18, 74], 6, "back"),
    ...pad([-80, 30], [-70, 26], 3.6, "front"),
    ...(o.weighted ? plate(add(sk.armN.end, [0, 0]), "front", 10) : []),
  ];
  void padTop;
  return pat("side", 3, o.iso ? hold(E(P(up, { t: 70 }), 1), [0, 0]) : rep(down, up), props);
}

/** Glute bridge (supine). */
export function bridge(o: { single?: boolean; elevated?: boolean; iso?: boolean; squeeze?: boolean } = {}): Pattern {
  const feetY = o.elevated ? 38 : 7;
  const fx = o.elevated ? 50 : 38;
  const down: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [fx, feetY], end: o.elevated ? 150 : 90 }, lf: o.single ? { a: [98, 98] } : { to: [fx - 4, feetY], end: o.elevated ? 150 : 90 },
    an: { a: [86, 90] }, af: { a: [84, 90] } };
  const up = P(down, { root: [4, o.elevated ? 50 : 40], t: o.elevated ? -100 : -112, lf: o.single ? { a: [100, 110] } : { to: [fx - 4, feetY], end: o.elevated ? 150 : 90 } });
  // shoulders stay on the floor: lower trunk lifts, upper trunk anchors
  up.t2 = -128; up.h = 30;
  const props = (sk: Skeleton): Shape[] => [
    ...(o.elevated ? box(fx - 12, fx + 22, 30) : []),
    ...(o.squeeze ? medball(add(knee(sk), [0, 0]), "front", 6) : []),
  ];
  return pat("side", 3, o.iso ? hold(up, [0, 0.6]) : rep(down, up), props);
}

/** Hip thrust (upper back on a bench). */
export function hipThrust(o: { load?: Load; single?: boolean; smith?: boolean } = {}): Pattern {
  const down: Pose = { root: [-6, 22], t: -50, t2: -60, h: 40, ln: { to: [36, 7] }, lf: o.single ? { a: [70, 70] } : { to: [32, 7] },
    an: { a: [-84, -110] }, af: { a: [-84, -110] } };
  const up: Pose = { ...down, root: [6, 50], t: -96, t2: -98, h: 64, lf: o.single ? { a: [100, 108] } : { to: [32, 7] } };
  const props = (sk: Skeleton): Shape[] => [
    ...bench(-90, -40, 40),
    ...(o.smith ? rail(8, 110) : []),
    ...(o.load === "back" || o.smith ? plate(hipFront(sk, 13), o.smith ? "front" : "back", o.smith ? 5 : 20) : []),
    ...(o.load === "db" ? dumbbell(hipFront(sk, 12), "front", 7) : []),
  ];
  return pat("side", 3, rep(down, up), props);
}

// ---------------- knee isolation ----------------
/** Seated leg extension machine. */
export function legExtension(o: { single?: boolean; partial?: boolean; iso?: 60 | 90 } = {}): Pattern {
  const seat = 50;
  const base: Pose = { root: [0, seat + 8], t: -14, h: 6, ln: { a: [88, 0] }, lf: { a: [88, 0] }, an: { rel: true, a: [20, 20] }, af: { rel: true, a: [20, 20] } };
  const flex = P(base, { ln: { a: [88, o.partial ? 40 : 4] }, lf: { a: [88, o.partial ? 40 : 4] } });
  const ext = P(base, { ln: { a: [90, 88] }, lf: o.single ? { a: [88, 4] } : { a: [90, 88] } });
  const props = (sk: Skeleton): Shape[] => [
    ...pad([-14, seat], [40, seat], 5, "back"), ...pad([-14, seat + 4], [-22, seat + 60], 5, "back"), ...frame([[-10, 0], [-10, seat - 6], [30, seat - 6], [30, 0]], 3),
    ...pad(add(ankle(sk), [-4, -4]), add(ankle(sk), [4, -4]), 4.5, "front"),
  ];
  if (o.iso) {
    const angle = o.iso === 60 ? 58 : 2;
    const p = P(base, { ln: { a: [88, angle] }, lf: o.single ? { a: [88, 4] } : { a: [88, angle] } });
    return pat("side", 3, hold(p, [0, 0]), props);
  }
  return pat("side", 2.8, rep(flex, ext), props);
}

/** Slider hamstring curl (supine bridge, heels slide). */
export function sliderCurl(o: { single?: boolean; eccentric?: boolean } = {}): Pattern {
  const curled: Pose = { root: [6, 42], t: -112, t2: -128, h: 30, ln: { to: [40, 7], end: 80 }, lf: o.single ? { a: [100, 108] } : { to: [36, 7], end: 80 }, an: { a: [86, 90] }, af: { a: [84, 90] } };
  const ext = P(curled, { root: [4, 24], t: -98, t2: -110, ln: { to: [86, 7], end: 70 }, lf: o.single ? { a: [100, 108] } : { to: [82, 7], end: 70 } });
  const props = (sk: Skeleton): Shape[] => [...slider(add(ankle(sk), [-2, -7]), "back"), ...(o.single ? [] : slider(add(ankle(sk, "F"), [-2, -7]), "back"))];
  const keys = o.eccentric
    ? [{ t: 0, p: E(curled, 0.5) }, { t: 0.7, p: E(ext, 1) }, { t: 0.8, p: E(P(ext, { root: [4, 12], t: -92, t2: -92, h: 0 }), 0.2) }, { t: 1, p: E(curled, 0.5) }]
    : rep(ext, curled);
  return pat("side", 3, keys, props);
}

export function hamCurlMachine(o: { prone?: boolean; single?: boolean } = {}): Pattern {
  if (o.prone) {
    const base: Pose = { root: [0, 54], t: 94, h: 10, ln: { a: [-90, -90] }, lf: { a: [-90, -90] }, an: { a: [24, 6] }, af: { a: [20, 4] } };
    const curl = P(base, { ln: { a: [-90, 150] }, lf: o.single ? { a: [-90, -90] } : { a: [-90, 150] } });
    return pat("side", 2.8, rep(base, curl), (sk) => [
      ...pad([-64, 46], [60, 46], 5, "back"), ...frame([[-50, 0], [-50, 40], [50, 40], [50, 0]], 3),
      ...pad(add(ankle(sk), [0, 6]), add(ankle(sk), [0, 12]), 4.5, "front"),
    ]);
  }
  const seat = 50;
  const base: Pose = { root: [0, seat + 8], t: -14, h: 6, ln: { a: [92, 92] }, lf: { a: [92, 92] }, an: { rel: true, a: [20, 20] }, af: { rel: true, a: [20, 20] } };
  const curl = P(base, { ln: { a: [92, 6] }, lf: o.single ? { a: [92, 92] } : { a: [92, 6] } });
  return pat("side", 2.8, rep(base, curl), (sk) => [
    ...pad([-14, seat], [40, seat], 5, "back"), ...pad([-14, seat + 4], [-22, seat + 60], 5, "back"), ...frame([[-10, 0], [-10, seat - 6], [30, seat - 6], [30, 0]], 3),
    ...pad(add(knee(sk), [-6, 9]), add(knee(sk), [6, 9]), 4, "front"),
    ...pad(add(ankle(sk), [-2, -6]), add(ankle(sk), [5, -6]), 4.5, "front"),
  ]);
}

export function nordic(): Pattern {
  const up: Pose = { root: [0, 50], t: 2, h: 0, ln: { a: [-2, -88], end: 180 }, lf: { a: [-2, -88], end: 180 }, an: { a: [30, 120] }, af: { a: [30, 120] } };
  const down = P(up, { root: [2, 50], t: 70, h: -10, ln: { a: [72, -88], end: 180 }, lf: { a: [72, -88], end: 180 }, an: { a: [150, 150] }, af: { a: [150, 150] } });
  // whole body pivots about the knees
  const fall = (k: number): Pose => ({ ...up, root: [Math.sin(k * 1.3) * 46 * 0 , 0], t: 0 });
  void fall;
  const kneel = (ang: number, e: number): Pose => {
    const r = (ang * Math.PI) / 180;
    const kneeP: V = [0, 7];
    const hip = add(kneeP, [Math.sin(r) * 44, Math.cos(r) * 44]);
    return { root: hip, t: ang, h: -4, ln: { to: [-40, 6], end: 180 }, lf: { to: [-40, 6], end: 180 },
      an: ang > 40 ? { rel: true, a: [-60 + ang * 0.6, 40] } : { rel: true, a: [-10, 80] }, af: ang > 40 ? { rel: true, a: [-60 + ang * 0.6, 40] } : { rel: true, a: [-10, 80] }, e };
  };
  void down;
  return pat("side", 4, [{ t: 0, p: kneel(0, 0.3) }, { t: 0.72, p: kneel(62, 1), lin: false }, { t: 0.8, p: kneel(64, 0.6) }, { t: 1, p: kneel(0, 0.3) }],
    (sk) => [...pad([-46, 8], [-34, 8], 4.6, "front"), ...pad([-12, 3], [12, 3], 3, "back"), ...manualHandAt(sk)]);
  function manualHandAt(_: Skeleton): Shape[] { return []; }
}

// ---------------- adductors / abductors ----------------
export function hipMachine(o: { add?: boolean } = {}): Pattern {
  const open: Pose = { ...STAND_F, root: [0, 58], t: 0, ln: { to: [-40, 22] }, lf: { to: [40, 22] }, an: { a: [-20, 10] }, af: { a: [20, -10] } };
  const closed = P(open, { ln: { to: [-14, 12] }, lf: { to: [14, 12] } });
  return pat("front", 2.8, o.add ? rep(open, closed) : rep(closed, open), (sk) => [
    ...pad([-30, 50], [30, 50], 5, "back"), ...pad([0, 54], [0, 116], 13, "back", "an-pad2"),
    ...pad(add(knee(sk), [-9, 0]), add(knee(sk), [-9, -14]), 4, o.add ? "front" : "front"),
    ...pad(add(knee(sk, "F"), [9, 0]), add(knee(sk, "F"), [9, -14]), 4, "front"),
  ].map((s) => s));
}

export function ballSqueezeSeated(): Pattern {
  const p: Pose = { ...STAND_F, root: [0, 58], t: 0, ln: { to: [-12, 7] }, lf: { to: [12, 7] }, an: { a: [-14, 20] }, af: { a: [14, -20] } };
  return pat("front", 3, hold(p, [0, 0]), (sk) => [...box(-30, 30, 50), ...medball(add(knee(sk), [(knee(sk, "F")[0] - knee(sk)[0]) / 2, 0]), "front", 7)]);
}

/** Side plank family (front view). The figure lies on its near side (head to screen-left), propped on the near forearm.
 *  short = from the knees; thruster = hips dip and lift; cop = top leg on a bench (Copenhagen). */
export function sidePlank(o: { short?: boolean; thruster?: boolean; cop?: boolean } = {}): Pattern {
  const plank = (dy: number, e: number): Pose => {
    const top = { af: { tr: [-30, 4] as V, bend: 1 } };
    if (o.cop) {
      const root: V = o.short ? [0, 50 + dy] : [0, 50 + dy];
      return { root, t: -88, h: 4, ...top, an: { to: [-50, 6], s: [1, 0.35] },
        lf: o.short ? { to: [64, 22], bend: 1 } : { to: [86, 46] }, ln: o.short ? { to: [40, 10] } : { to: [68, 12] }, e };
    }
    if (o.short) {
      return { root: [4, 27 + dy], t: -64, h: 4, ...top, an: { to: [-45, 6], s: [1, 0.35] },
        ln: { rel: true, a: [0, 0], s: [1, 0.12] }, lf: { rel: true, a: [0, 0], s: [1, 0.12] }, e };
    }
    return { root: [3, 37 + dy], t: -72, h: 4, ...top, an: { to: [-47, 6], s: [1, 0.35] }, ln: { to: [86, 9] }, lf: { to: [87, 15] }, e };
  };
  const props = (): Shape[] => (o.cop ? (o.short ? bench(26, 60, 36) : bench(70, 110, 36)) : []);
  if (o.thruster) return pat("front", 2.8, rep(plank(-13, 0.3), plank(0, 1)), props);
  return pat("front", 3, hold(plank(0, 1), [0, 0.6]), props);
}

/** Banded stiff-leg sidestep (front view). */
export function sidestep(): Pattern {
  const a = P(STAND_F, { ln: { to: [-10, 7] }, lf: { to: [10, 7] }, an: { a: [-10, 60] }, af: { a: [10, -60] } });
  const b = P(a, { root: [-6, 95], t: -3, ln: { to: [-36, 14] }, lf: { to: [10, 7] } });
  const c = P(a, { root: [-14, 94], ln: { to: [-36, 7] }, lf: { to: [8, 7] } });
  return pat("front", 2.4, [{ t: 0, p: E(a, 0.3) }, { t: 0.4, p: E(b, 1) }, { t: 0.55, p: E(c, 0.8) }, { t: 1, p: E(a, 0.3) }], (sk) => band(add(ankle(sk), [0, 3]), add(ankle(sk, "F"), [0, 3]), "front"));
}

/** Side bend over a roman chair (front view, lying on the near side, hips on the pad). */
export function romanSideBend(o: { iso?: boolean; weighted?: boolean } = {}): Pattern {
  const at = (t2: number, e: number): Pose => ({ root: [0, 80], t: -90, t2, h: 0, ln: { to: [86, 66] }, lf: { to: [86, 74] },
    an: { tr: [-8, -12], bend: 1 }, af: { tr: [-8, -12], bend: -1 }, e });
  const props = (sk: Skeleton): Shape[] => [
    ...frame([[-14, 0], [-4, 64], [86, 58], [96, 0]], 3.2),
    ...pad([-12, 66], [14, 66], 6, "back"), ...pad([80, 56], [92, 56], 3.6, "front"),
    ...(o.weighted ? plate(onTrunk(sk, 16, 0), "front", 10) : []),
  ];
  if (o.iso) return pat("front", 3, hold(at(-90, 1), [0, 0]), props);
  return pat("front", 3, rep(at(-132, 0.2), at(-62, 1)), props);
}

// ---------------- calf ----------------
export function heelRaise(o: { single?: boolean; iso?: boolean; deficit?: boolean; load?: "db" | "smith"; seated?: boolean; frontFoot?: boolean; legPress?: boolean } = {}): Pattern {
  if (o.legPress) return legPress({ calf: true });
  if (o.seated) {
    const down: Pose = { root: [0, 58], t: 2, h: 4, ln: { to: [40, 18], end: 110 }, lf: o.single ? { to: [36, 7], end: 90 } : { to: [36, 18], end: 110 }, an: { rel: true, a: [40, 60] }, af: { rel: true, a: [40, 60] } };
    const up = P(down, { ln: { to: [40, 30], end: 50 }, lf: o.single ? { to: [36, 7], end: 90 } : { to: [36, 30], end: 50 } });
    return pat("side", 2.4, rep(down, up), (sk) => [...pad([-14, 50], [26, 50], 5, "back"), ...box(36, 66, 10), ...pad(add(knee(sk), [-8, 9]), add(knee(sk), [10, 9]), 4.5, "front"), ...frame([[-6, 0], [-6, 44]], 3)]);
  }
  const step = o.deficit || o.frontFoot ? 14 : 0;
  const footY = 7 + step;
  const flat = o.frontFoot ? 90 : 90;
  const toeAt = (end: number): V => [3 + 17 * Math.sin((end * Math.PI) / 180) - 17, footY];
  void toeAt;
  // keep the ball of the foot fixed: ankle rises as the foot plantarflexes
  const ball: V = [18, footY - 4.5];
  const anklePos = (end: number): V => {
    const r = (end * Math.PI) / 180;
    return [ball[0] - Math.sin(r) * 15, ball[1] + Math.cos(r) * 15 + 4.5 * Math.sin(r)];
  };
  const lo = o.deficit ? 112 : flat;
  const hi = 40;
  const pose = (end: number, e: number): Pose => {
    const a = anklePos(end);
    return {
      ...STAND, root: [a[0] - 4, a[1] + 87], t: 3,
      ln: { to: a, end }, lf: o.single ? { a: [12, -40] } : { to: add(a, [-4, 0]), end },
      an: o.load === "db" ? { rel: true, a: [2, 2] } : o.load === "smith" ? { tr: [0, -9], bend: 1 } : o.single || step ? { to: [48, 112] } : { rel: true, a: [4, 6] },
      af: o.load === "smith" ? { tr: [0, -10], bend: 1 } : { rel: true, a: [-4, 0] }, e,
    };
  };
  const props = (sk: Skeleton): Shape[] => [
    ...(step ? box(-6, 40, step) : []),
    ...(o.single && !o.load && !step ? [] : []),
    ...(o.single || step) && !o.load ? lineP([52, 0], [52, 130], 3.2) : [],
    ...(o.load === "db" ? dumbbell(grip(sk), "front") : []),
    ...(o.load === "smith" ? [...rail(-8), ...plate(nape(sk), "front", 5)] : []),
  ];
  if (o.frontFoot) {
    // forefoot elevated on a wedge, heel on the floor: raise from there
    const fp = (end: number, e: number): Pose => ({ ...pose(end, e) });
    return pat("side", 2.6, rep(fp(118, 0.2), fp(60, 1)), props);
  }
  if (o.iso) return pat("side", 3, hold(pose(55, 1), [0, 0]), props);
  return pat("side", 2.4, rep(pose(lo, 0.15), pose(hi, 1), { down: 0.35, hold: 0.15 }), props);
}

// ---------------- rehab: knee / hip ----------------
export function heelSlide(o: { wall?: boolean; strap?: boolean } = {}): Pattern {
  if (o.wall) {
    const ext: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [8, 92], end: 180 }, lf: { to: [4, 92], end: 180 }, an: { a: [86, 90] }, af: { a: [84, 90] } };
    const flex = P(ext, { ln: { to: [34, 52], end: 180 } });
    return pat("side", 3.2, rep(ext, flex), () => wall(16, 140, 1));
  }
  const ext: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [86, 6], end: 150 }, lf: { to: [84, 6], end: 150 }, an: o.strap ? { to: [26, 30] } : { a: [86, 90] }, af: { a: [84, 90] } };
  const flex = P(ext, { ln: { to: [36, 6], end: 120 }, an: o.strap ? { to: [20, 36] } : { a: [86, 90] } });
  return pat("side", 3.2, rep(ext, flex), (sk) => (o.strap ? band(grip(sk), add(sk.legN.tip, [2, 0]), "front") : []));
}

export function rockBack(o: { halfKneel?: boolean } = {}): Pattern {
  if (o.halfKneel) {
    const fwd: Pose = { root: [6, 52], t: 4, h: 0, ln: { to: [46, 7] }, lf: { to: [-34, 7], end: 180 }, an: { rel: true, a: [4, 6] }, af: { rel: true, a: [-4, 0] } };
    const back = P(fwd, { root: [-22, 28], t: 26, lf: { to: [-34, 7], end: 180 } });
    return pat("side", 3.2, rep(fwd, back), () => []);
  }
  const quad: Pose = { root: [0, 56], t: 88, h: 0, ln: { to: [-42, 8], end: 180 }, lf: { to: [-44, 8], end: 180 }, an: { to: [52, 4] }, af: { to: [48, 4] } };
  const back = P(quad, { root: [-30, 28], t: 70, h: -10 });
  return pat("side", 3.2, rep(quad, back), () => []);
}

export function bike(): Pattern {
  const c: V = [8, 44];
  const ped = (a: number): V => [c[0] + Math.cos(a) * 15, c[1] + Math.sin(a) * 15];
  const pose = (a: number): Pose => ({ root: [-8, 96], t: 6, h: 0, ln: { to: ped(a) , end: 100 }, lf: { to: ped(a + Math.PI), end: 100 }, an: { to: [40, 112] }, af: { to: [38, 112] }, e: 0.8 });
  const keys = Array.from({ length: 9 }, (_, i) => ({ t: i / 8, p: pose((-i / 8) * Math.PI * 2), lin: true }));
  return pat("side", 1.6, keys, () => [
    ...frame([[-30, 0], [-10, 86], [-2, 86]], 3.4), ...pad([-18, 88], [2, 88], 4, "back"),
    ...frame([[c[0], c[1]], [-10, 86]], 3), ...frame([[c[0], c[1]], [38, 112], [44, 114]], 3), ...frame([[20, 0], [c[0], c[1]]], 3),
    ...lineP([-36, 0], [26, 0], 6),
  ]);
}

export function heelProp(): Pattern {
  const p: Pose = { root: [0, 14], t: -76, h: 10, ln: { to: [86, 18], end: 160 }, lf: { to: [60, 7], bend: 1 }, an: { to: [-12, 2] }, af: { to: [-14, 2] } };
  return pat("side", 3, hold(p, [0, -1.5]), () => towel([86, 9]));
}
import { towel } from "./props";

export function tke(): Pattern {
  const bent = P(STAND, { root: [-2, 90], ln: { to: [6, 7] }, lf: { to: [-22, 7], end: 120 }, an: { rel: true, a: [4, 6] } });
  const ext = P(bent, { root: [-6, 94], ln: { to: [6, 7] } });
  return pat("side", 2.6, rep(bent, ext), (sk) => [...lineP([60, 0], [60, 80], 4), ...band(add(knee(sk), [-4, 0]), [60, 48], "front")]);
}

export function proneKneeExt(): Pattern {
  const p: Pose = { root: [0, 54], t: 92, h: 8, ln: { a: [-88, -86], end: 0 }, lf: { a: [-88, -84], end: 0 }, an: { a: [30, 120] }, af: { a: [26, 116] } };
  return pat("side", 3, hold(p, [0, -0.8]), () => [...bench(-30, 80, 44)]);
}

export function quadSet(o: { kind: "set" | "short" | "long" | "slr" | "ball" | "machine" }): Pattern {
  if (o.kind === "long" || o.kind === "ball" || o.kind === "machine") {
    const seat = 50;
    const base: Pose = { root: [0, seat + 8], t: -6, h: 4, ln: { a: [90, 0] }, lf: { a: [90, 0] }, an: { rel: true, a: [16, 30] }, af: { rel: true, a: [16, 30] } };
    if (o.kind === "long") return pat("side", 2.8, rep(base, P(base, { ln: { a: [92, 88] } })), () => box(-26, 40, 50));
    const p = P(base, { ln: { a: [90, 40] } });
    return pat("side", 3, hold(p, [0, 0]), (sk) => [...box(-26, 40, 50), ...(o.kind === "ball" ? physioBall(add(ankle(sk), [22, 0]), 20, "front") : [...pad(add(ankle(sk), [5, -4]), add(ankle(sk), [5, 6]), 4.5, "front"), ...frame([[80, 0], [80, 40], [62, 30]], 3)])]);
  }
  const lying: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [86, 8], end: 160 }, lf: { to: [60, 7], bend: 1 }, an: { a: [86, 90] }, af: { a: [84, 90] } };
  if (o.kind === "slr") return pat("side", 3, rep(lying, P(lying, { ln: { a: [140, 140], end: 220 } })), () => []);
  if (o.kind === "short") {
    const a = P(lying, { ln: { to: [78, 9], end: 120 } });
    const bolster = P(lying, { ln: { a: [116, 60] } });
    return pat("side", 2.8, rep(bolster, P(lying, { ln: { a: [104, 92], end: 170 } })), () => towel([44, 9]).map((s) => ({ ...s, a: { d: s.a.d } })));
    void a;
  }
  return pat("side", 3, rep(P(lying, { ln: { to: [86, 9], end: 140 } }), P(lying, { ln: { to: [86, 7.5], end: 160 } })), () => towel([84, 6]));
}

export function sidelyingAbduction(): Pattern {
  const lie: Pose = { root: [0, 18], t: -90, h: -4, ln: { a: [92, 92] }, lf: { a: [92, 92] }, an: { a: [-92, -60] }, af: { a: [90, 70] } };
  return pat("front", 2.8, rep(lie, P(lie, { lf: { a: [128, 128] } })), () => []);
}

export function supineAdductionIso(): Pattern {
  const p: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [38, 7] }, lf: { to: [34, 7] }, an: { a: [86, 90] }, af: { a: [84, 90] } };
  return pat("side", 3, hold(p, [0, 0]), (sk) => medball(knee(sk), "front", 6.5));
}

export function marching(o: { crutches?: 0 | 1 | 2; walk?: boolean } = {}): Pattern {
  const cr = o.crutches ?? 0;
  const arms = cr === 2 ? { an: { to: [22, 72] as V }, af: { to: [18, 72] as V } } : cr === 1 ? { an: { rel: true, a: [4, 6] as [number, number] }, af: { to: [18, 72] as V } } : { an: { rel: true, a: [-24, 30] as [number, number] }, af: { rel: true, a: [20, 70] as [number, number] } };
  const a = P(STAND, { ...arms, ln: { a: [70, -10], end: 90 }, lf: { to: [-2, 7] } });
  const armsB = cr ? arms : { an: { rel: true, a: [20, 70] as [number, number] }, af: { rel: true, a: [-24, 30] as [number, number] } };
  const b = P(STAND, { ...armsB, lf: { a: [70, -10], end: 90 }, ln: { to: [2, 7] } });
  const mid = P(STAND, { ...arms });
  const props = (sk: Skeleton): Shape[] => cr ? [
    ...lineP(add(grip(sk, "F"), [0, 16]), [26, 0], 3, "back"), ...lineP(add(grip(sk, "F"), [0, 0]), add(grip(sk, "F"), [-6, 0]), 3, "back"),
    ...(cr === 2 ? [...lineP(add(grip(sk), [0, 16]), [30, 0], 3, "front"), ...lineP(grip(sk), add(grip(sk), [-6, 0]), 3, "front")] : lineP([0, 0], [0, 0], 0.1)),
  ] : [];
  if (o.walk) {
    // crutches forward, step through (in place)
    const s1 = P(STAND, { ...arms, root: [-8, 94], ln: { to: [-6, 7] }, lf: { a: [-10, -30], end: 120 } });
    const s2 = P(STAND, { ...arms, root: [6, 92], ln: { to: [12, 7] }, lf: { to: [-6, 7] } });
    return pat("side", 2.6, seq([E(s1, 0.4), E(s2, 0.8)]), props);
  }
  return pat("side", 2.4, seq([E(a, 0.8), E(mid, 0.3), E(b, 0.8), E(mid, 0.3)]), props);
}

void STAND_F; void inclineBench; void softBlob; void manualHand; void chest; void hipFront;
