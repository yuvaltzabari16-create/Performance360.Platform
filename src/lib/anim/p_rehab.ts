// Mobility / range-of-motion, neck work and isometrics.
import type { Shape } from "./draw";
import type { Pattern } from "./engine";
import { band, bench, cable, dumbbell, kettlebell, stick, tower, wall, hand as handProp } from "./props";
import { E, grip, hold, P, pat, rep, seq, STAND, STAND_F, midHands } from "./kit";
import { add, type Pose, type Skeleton, type V } from "./rig";

const SUPINE: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [38, 7] }, lf: { to: [34, 7] }, an: { a: [92, 90] }, af: { a: [90, 90] } };

/** Supine shoulder / elbow range of motion. */
export function supineRom(o: { kind: "elbow" | "flexion" | "er" | "er9090" | "ir9090"; imp?: "dowel" | "kb" | "db" | "none"; single?: boolean; offBench?: boolean; extra?: boolean }): Pattern {
  const k = o.kind;
  const imp = o.imp ?? "none";
  const base: Pose = o.offBench ? { ...SUPINE, root: [0, 53], ln: { to: [40, 7] }, lf: { to: [36, 7] } } : SUPINE;
  const props = (sk: Skeleton): Shape[] => [
    ...(o.offBench ? bench(-50, 20, 44) : []),
    ...(imp === "dowel" ? (k === "flexion" ? stick(add(grip(sk), [0, 0]), add(grip(sk), [0, 0.1]), "front", 0.1).concat(dumbbell(grip(sk), "front", 2.6)) : stick(grip(sk), add(grip(sk, "F"), [0, 0]), "front")) : []),
    ...(imp === "kb" ? kettlebell(add(midHands(sk), [0, 12]), "front") : []),
    ...(imp === "db" ? dumbbell(grip(sk), "front") : []),
  ];
  if (k === "elbow") return pat("side", 2.8, rep(P(base, { an: { a: [92, 90] } }), P(base, { an: { a: [92, 232] } })), props);
  if (k === "flexion") {
    const up = P(base, { an: { a: [180, 180] }, af: o.single ? base.af : { a: [180, 180] } });
    const over = P(base, { an: { a: o.offBench ? [276, 276] : [262, 262] }, af: o.single ? base.af : { a: [262, 262] } });
    return pat("side", 3.2, rep(up, over), props);
  }
  if (k === "er") {
    // elbow at the side, forearm up; rotating out toward the floor shortens it on screen
    const a = P(base, { an: { a: [92, 180] }, af: imp === "dowel" ? { a: [130, 180] } : base.af });
    const b = P(base, { an: { a: [92, 180], s: [1, 0.3] }, af: imp === "dowel" ? { a: [130, 200] } : base.af });
    return pat("side", 3, rep(a, b), props);
  }
  // 90/90: upper arm out to the side (toward the camera), forearm swings toward the head (ER) or the feet (IR)
  const u = { a: [90, 180] as [number, number], s: [0.15, 1] as [number, number] };
  const a = P(base, { an: u, af: imp === "dowel" ? { a: [140, 200] } : base.af });
  const b = P(base, { an: { ...u, a: [90, k === "er9090" ? (o.extra ? 272 : 258) : 112] }, af: imp === "dowel" ? { a: [150, 250] } : base.af });
  return pat("side", 3, rep(a, b), (sk) => [...props(sk), ...(imp === "dowel" ? stick(grip(sk), grip(sk, "F"), "front") : [])].filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i));
}

export function dowelAbduction(): Pattern {
  const base: Pose = { ...STAND_F, an: { a: [-8, -6] }, af: { a: [30, -40] } };
  const up = P(base, { an: { a: [-150, -150] }, af: { a: [10, -100] } });
  return pat("front", 3, rep(base, up), (sk) => stick(grip(sk), grip(sk, "F"), "front"));
}

export function catCow(): Pattern {
  const quad = (t: number, t2: number, h: number, e: number): Pose => ({ root: [0, 52], t, t2, h, ln: { a: [-2, -88], end: 180 }, lf: { a: [-4, -88], end: 180 }, an: { to: [50, 7] }, af: { to: [47, 7] }, e });
  return pat("side", 4, seq([quad(84, 108, 30, 1), quad(100, 74, -40, 1)], [0, 0.5]));
}

export function openBook(): Pattern {
  // lying on the far side, knees bent, top arm sweeps open (front view)
  const lie: Pose = { root: [0, 18], t: -90, h: 0, ln: { a: [90, 50], s: [0.6, 0.6] }, lf: { a: [92, 60], s: [0.6, 0.6] }, an: { a: [0, 0], s: [0.3, 0.3] }, af: { a: [0, 0], s: [0.3, 0.3] } };
  const open = P(lie, { tw: 55, hr: 40, af: { a: [180, 180] } });
  return pat("front", 4, rep(lie, open), () => []);
}

export function thoracicRotation(): Pattern {
  const kneel: Pose = { root: [0, 52], t: 0, h: 0, ln: { to: [-12, 6], s: [1, 0.3], end: 0 }, lf: { a: [6, 2], s: [0.35, 1] }, an: { tr: [16, -12], bend: -1 }, af: { tr: [16, -12], bend: 1 } };
  return pat("front", 3.6, seq([E({ ...kneel, tw: -55, hr: -55 }, 1), E({ ...kneel, tw: 55, hr: 55 }, 1)], [0, 0.5]));
}

/** Neck: seated close-up. Manually resisted = own hand gives the resistance. */
export function cervical(o: { kind: "rotation" | "sidebend" | "extension" | "flexion"; iso?: boolean }): Pattern {
  const k = o.kind;
  const front = k === "rotation" || k === "sidebend";
  const seat: Pose = front
    ? { root: [0, 54], t: 0, h: 0, ln: { to: [-12, 7] }, lf: { to: [12, 7] }, an: { a: [-6, 30] }, af: { a: [6, -30] } }
    : { root: [0, 54], t: 0, h: 0, ln: { to: [40, 7] }, lf: { to: [36, 7] }, an: { a: [20, 70] }, af: { a: [16, 66] } };
  const crop: [number, number, number, number] = [-56, 70, 56, 154];
  if (o.iso) {
    const handTo: Record<typeof k, V> = { flexion: [16, 136], extension: [-14, 136], sidebend: [-16, 132], rotation: [-14, 134] };
    const p = P(seat, { an: { to: handTo[k], bend: front ? -1 : -1 }, h: k === "flexion" ? 4 : k === "extension" ? -4 : k === "sidebend" ? -4 : 0, hr: k === "rotation" ? -8 : 0 });
    return pat(front ? "front" : "side", 3, hold(p, [0, 0]), undefined, { crop });
  }
  const amp = k === "rotation" ? 60 : k === "sidebend" ? 30 : k === "extension" ? -40 : 40;
  const A = k === "rotation" ? P(seat, { hr: -amp }) : P(seat, { h: k === "sidebend" ? -amp : amp });
  const B = k === "rotation" ? P(seat, { hr: amp }) : k === "sidebend" ? P(seat, { h: amp }) : seat;
  return pat(front ? "front" : "side", 3.6, seq([E(A, 1), E(B, k === "rotation" || k === "sidebend" ? 1 : 0.3)], [0, 0.5]), undefined, { crop });
}

/** Isometric shoulder holds against a wall, band or cable. */
export function shoulderIso(o: { kind: "er" | "ir" | "flex" | "ext"; via: "wall" | "band" | "miniband" | "cable" }): Pattern {
  const { kind, via } = o;
  if (kind === "flex" || kind === "ext") {
    const p: Pose = { ...STAND, an: { a: [kind === "flex" ? 4 : -4, kind === "flex" ? 90 : 90] } };
    return pat("side", 3, hold(p, [0, 0]), () => wall(kind === "flex" ? 34 : -16, 190, kind === "flex" ? 1 : -1));
  }
  if (via === "miniband") {
    const p: Pose = { ...STAND_F, an: { a: [-2, -60], s: [1, 0.45] }, af: { a: [2, 60], s: [1, 0.45] } };
    return pat("front", 3, hold(p, [0, 0]), (sk) => band(grip(sk), grip(sk, "F"), "front"));
  }
  const er = kind === "er";
  const p: Pose = { ...STAND_F, an: { a: [-2, er ? -90 : 90], s: [1, 0.4] }, af: { a: [6, 4] } };
  const props = (sk: Skeleton): Shape[] => via === "wall"
    ? (er ? wall(-44, 190, -1) : [...wall(-44, 190, -1).slice(0, 0), ...wall(16, 190, 1).slice(0, 0), ...handProp(add(grip(sk), [3, 0]), "front").slice(0, 0), ...wall(26, 150, 1)])
    : via === "cable" ? [...tower(er ? 70 : -80, 98), ...cable([er ? 70 : -80, 98], grip(sk))] : band(grip(sk), [er ? 80 : -86, 98]);
  return pat("front", 3, hold(p, [0, 0]), props);
}

void seq;
