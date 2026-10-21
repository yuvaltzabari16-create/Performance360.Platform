// Plyometrics, jumps, running and change-of-direction drills.
import type { Shape } from "./draw";
import type { Key, Pattern } from "./engine";
import { band, box, cone, dumbbell, hurdle, lineP, tower, wedge } from "./props";
import { E, grip, P, pat, STAND, STAND_F, midHands } from "./kit";
import { add, solve, type Limb, type Pose, type V, type View } from "./rig";

/** Shift a pose: root and every world-space limb target. */
export function shift(p: Pose, dx: number, dy = 0): Pose {
  const sl = (l: Limb): Limb => (l.to ? { ...l, to: [l.to[0] + dx, l.to[1] + dy] } : l);
  return { ...p, root: [p.root[0] + dx, p.root[1] + dy], ln: sl(p.ln), lf: sl(p.lf), an: sl(p.an), af: sl(p.af) };
}
/** Put the lowest ankle of an FK pose on the floor (or `floorY`). */
export function ground(p: Pose, view: View = "side", floorY = 0): Pose {
  const sk = solve(p, view);
  return shift(p, 0, floorY + 7 - Math.min(sk.legN.end[1], sk.legF.end[1]));
}
const lift = (p: Pose, h: number) => shift(p, 0, h);

// ---------------- jump building blocks (side view, IK legs) ----------------
const stand = (x = 0, y = 0, arms: "down" | "back" | "up" | "fwd" = "down", load = false): Pose => ({
  ...STAND, root: [x, 94 + y], ln: { to: [x + 3, 7 + y] }, lf: { to: [x - 3, 7 + y] },
  an: load ? { a: [2, 2] } : arms === "back" ? { a: [-50, -30] } : arms === "up" ? { a: [168, 172] } : arms === "fwd" ? { a: [70, 80] } : { a: [6, 10] },
  af: load ? { a: [-2, -2] } : arms === "back" ? { a: [-56, -36] } : arms === "up" ? { a: [164, 168] } : arms === "fwd" ? { a: [66, 76] } : { a: [-5, 2] },
});
const dip = (x = 0, y = 0, load = false): Pose => ({ ...stand(x, y, "back", load), root: [x - 14, 74 + y], t: 34, h: -8 });
const toes = (x = 0, y = 0, load = false): Pose => ({ ...stand(x, y, "up", load), root: [x + 2, 100 + y], t: -2, ln: { to: [x + 1, 12 + y], end: 30 }, lf: { to: [x - 4, 12 + y], end: 30 } });
const tuck = (x = 0, y = 0, load = false): Pose => ({ ...stand(x, y, "fwd", load), root: [x, 94 + y], t: 14, ln: { to: [x + 16, 46 + y], end: 70 }, lf: { to: [x + 12, 46 + y], end: 70 } });
const land = (x = 0, y = 0, load = false): Pose => ({ ...stand(x, y, "fwd", load), root: [x - 14, 70 + y], t: 32, h: -8 });
const single = (p: Pose): Pose => ({ ...p, lf: { a: [40, -60] } });

function jumpKeys(steps: [number, Pose, number?][]): Key[] {
  return steps.map(([t, p, e]) => ({ t, p: { ...p, e: e ?? p.e ?? 0.5 } }));
}
/** fade out at the end, jump back to the start invisibly, fade in */
function withReset(ks: Key[], start: Pose, at = 0.84): Key[] {
  const kept = ks.filter((k) => k.t < at).map((k) => ({ ...k, p: { ...k.p, o: 1 } }));
  const last = kept[kept.length - 1].p;
  return [...kept, { t: at, p: { ...last, o: 1 } }, { t: at + 0.06, p: { ...last, o: 0 } }, { t: at + 0.08, p: { ...start, o: 0 } }, { t: 1, p: { ...start, o: 1 } }];
}

export function cmj(o: { repeat?: boolean; load?: boolean; single?: boolean; seated?: boolean } = {}): Pattern {
  const L = o.load ?? false;
  const S = o.single ? single : (p: Pose) => p;
  if (o.seated) {
    const sit: Pose = { root: [-6, 52], t: 30, h: -8, ln: { to: [26, 7] }, lf: { to: [22, 7] }, an: { a: [-40, -20] }, af: { a: [-44, -24] } };
    const ks = jumpKeys([[0, sit, 0.3], [0.2, sit, 0.5], [0.34, toes(4, 0), 1], [0.46, lift(toes(4, 0), 26), 0.8], [0.6, land(6), 0.7], [0.72, stand(6), 0.2]]);
    return pat("side", 3, withReset(ks, sit), () => box(-40, -6, 42));
  }
  const ks = jumpKeys([
    [0, S(stand(0, 0, "down", L)), 0.2], [0.22, S(dip(0, 0, L)), 0.6], [0.36, S(toes(0, 0, L)), 1],
    [0.48, S(lift(toes(0, 0, L), 30)), 0.7], [0.62, S(land(0, 0, L)), 0.8], [o.repeat ? 0.8 : 0.82, S(stand(0, 0, "down", L)), 0.2], [1, S(stand(0, 0, "down", L)), 0.2],
  ]);
  return pat("side", o.repeat ? 1.8 : 2.6, ks, L ? (sk) => [...dumbbell(grip(sk), "front"), ...dumbbell(grip(sk, "F"), "back")] : undefined);
}

export function boxJump(o: { single?: boolean; toDrop?: boolean } = {}): Pattern {
  const S = o.single ? single : (p: Pose) => p;
  const bx0 = 46, bx1 = 92, bh = 40;
  const start = S(stand(0));
  const ks = jumpKeys([
    [0, start, 0.2], [0.16, S(dip(0)), 0.6], [0.28, S(toes(4)), 1], [0.4, S(tuck(40, 34)), 0.7],
    [0.5, S(land(68, bh)), 0.8], [0.6, stand(68, bh), 0.2],
    ...(o.toDrop ? [[0.68, P(stand(70, bh), { lf: { to: [96, bh + 14] } }), 0.2], [0.76, lift(stand(104, 0, "fwd"), 6), 0.4], [0.8, land(106, 0), 1]] as [number, Pose, number][] : []),
  ]);
  return pat("side", 3.2, withReset(ks, start, o.toDrop ? 0.88 : 0.8), () => box(bx0, bx1, bh));
}

export function dropJump(o: { kind: "altitude" | "drop" | "depth" | "slHeiden" }): Pattern {
  const bh = 40;
  const top = stand(-30, bh);
  const step = P(stand(-26, bh), { ln: { a: [40, 10] }, lf: { to: [-29, bh + 7] } });
  const air = lift(stand(4, 0, "fwd"), 14);
  const ks: [number, Pose, number?][] = [[0, top, 0.2], [0.14, step, 0.3], [0.26, air, 0.4], [0.34, land(8), 1]];
  if (o.kind === "altitude") ks.push([0.5, land(8), 1], [0.62, stand(8), 0.2]);
  if (o.kind === "drop") ks.push([0.42, toes(8), 1], [0.52, lift(toes(8), 26), 0.7], [0.64, land(8), 0.8], [0.72, stand(8), 0.2]);
  if (o.kind === "depth") ks.push([0.42, toes(12), 1], [0.54, lift(tuck(44), 20), 0.7], [0.66, land(70), 0.9], [0.74, stand(70), 0.2]);
  if (o.kind === "slHeiden") ks.push([0.44, single(land(10)), 1], [0.56, lift(single(stand(40, 0, "fwd")), 14), 0.6], [0.66, single(land(64)), 1], [0.74, single(stand(64)), 0.4]);
  return pat("side", 3.2, withReset(jumpKeys(ks), top, 0.82), () => box(-60, -10, bh));
}

export function broadJump(o: { double?: boolean; seated?: boolean; hurdle?: "stick" | "bounce" | "continuous" | "single" } = {}): Pattern {
  const h = o.hurdle;
  const S = h === "single" ? single : (p: Pose) => p;
  if (o.seated) {
    const sit: Pose = { root: [-6, 52], t: 30, h: -8, ln: { to: [26, 7] }, lf: { to: [22, 7] }, an: { a: [-40, -20] }, af: { a: [-44, -24] } };
    const ks = jumpKeys([[0, sit, 0.3], [0.16, sit, 0.5], [0.3, toes(14), 1], [0.42, lift(tuck(44), 22), 0.7], [0.54, land(72), 0.9], [0.66, stand(72), 0.2]]);
    return pat("side", 3, withReset(ks, sit, 0.78), () => box(-40, -6, 42));
  }
  const dist = h ? 64 : 76;
  const ks: [number, Pose, number?][] = [[0, S(stand(0)), 0.2], [0.14, S(dip(0)), 0.6], [0.26, S(toes(8)), 1], [0.38, S(lift(tuck(dist / 2), 26)), 0.7], [0.5, S(land(dist)), 1]];
  if (o.double || h === "continuous") ks.push([0.6, S(toes(dist + 8)), 1], [0.7, S(lift(tuck(dist * 1.5), 26)), 0.7], [0.8, S(land(dist * 2)), 1]);
  else if (h === "bounce") ks.push([0.58, S(toes(dist)), 0.8], [0.64, S(lift(toes(dist), 8)), 0.5], [0.72, S(land(dist)), 0.8]);
  else ks.push([0.66, S(land(dist)), 1], [0.72, S(stand(dist)), 0.2]);
  const props = (): Shape[] => (h ? [...hurdle(dist / 2 - 2, 30), ...(o.double || h === "continuous" ? hurdle(dist * 1.5 - 2, 30) : [])] : [...cone(-6), ...cone(o.double ? dist * 2 + 10 : dist + 10)]);
  return pat("side", o.double || h === "continuous" ? 3.6 : 3, withReset(jumpKeys(ks), S(stand(0)), o.double || h === "continuous" ? 0.86 : 0.8), props);
}

export function pogo(o: { dir?: "up" | "lateral" | "fb" | "split"; single?: boolean; frontFoot?: boolean } = {}): Pattern {
  const dir = o.dir ?? "up";
  if (dir === "lateral") {
    const base = (x: number, y: number): Pose => ({ ...STAND_F, root: [x, 92 + y], ln: o.single ? { a: [-4, 60] } : { to: [x - 9, 9 + y] }, lf: { to: [x + 9, 9 + y] }, an: { a: [-14, 70] }, af: { a: [14, -70] } });
    return pat("front", 1.2, [{ t: 0, p: E(base(-12, 0), 1) }, { t: 0.25, p: E(base(0, 9), 0.4) }, { t: 0.5, p: E(base(12, 0), 1) }, { t: 0.75, p: E(base(0, 9), 0.4) }, { t: 1, p: E(base(-12, 0), 1) }]);
  }
  const contact = (x: number, sp = 0): Pose => ({ ...stand(x, 0), root: [x, 92], t: 4,
    ln: sp ? { to: [x + 3 + sp * 18, 10], end: 50 } : { to: [x + 3, 10], end: 50 },
    lf: o.single ? { a: [30, -70] } : sp ? { to: [x - 3 - sp * 18, 10], end: 50 } : { to: [x - 3, 10], end: 50 },
    an: { a: [24, 100] }, af: { a: [-20, 70] } });
  const air = (x: number, sp = 0): Pose => lift({ ...contact(x, sp), ln: { ...contact(x, sp).ln, end: 30 }, lf: o.single ? contact(x, sp).lf : { ...contact(x, sp).lf, end: 30 } }, 10);
  let keys: Key[];
  if (dir === "fb") keys = [{ t: 0, p: E(contact(-10), 1) }, { t: 0.25, p: E(air(0), 0.4) }, { t: 0.5, p: E(contact(10), 1) }, { t: 0.75, p: E(air(0), 0.4) }, { t: 1, p: E(contact(-10), 1) }];
  else if (dir === "split") keys = [{ t: 0, p: E(contact(0, 1), 1) }, { t: 0.25, p: E(air(0, 0), 0.4) }, { t: 0.5, p: E(contact(0, -1), 1) }, { t: 0.75, p: E(air(0, 0), 0.4) }, { t: 1, p: E(contact(0, 1), 1) }];
  else keys = [{ t: 0, p: E(contact(0), 1) }, { t: 0.5, p: E(air(0), 0.4) }, { t: 1, p: E(contact(0), 1) }];
  return pat("side", dir === "up" ? 0.55 : 1.1, keys, o.frontFoot ? () => wedge(-2, 30, 8, "right") : undefined);
}

/** Lateral bound (front view): near leg → far leg and back. */
export function heiden(o: { kind: "stick" | "rebound" | "continuous" }): Pattern {
  const landN = (x: number): Pose => ({ ...STAND_F, root: [x, 76], t: -8, ln: { to: [x - 8, 7] }, lf: { a: [-30, -70], s: [1, 0.6] }, an: { a: [30, 100] }, af: { a: [40, 80] } });
  const landF = (x: number): Pose => ({ ...STAND_F, root: [x, 76], t: 8, lf: { to: [x + 8, 7] }, ln: { a: [30, 70], s: [1, 0.6] }, an: { a: [-40, -80] }, af: { a: [-30, -100] } });
  const air = (x: number): Pose => ({ ...STAND_F, root: [x, 104], t: 0, ln: { a: [-20, -10] }, lf: { a: [20, 10] }, an: { a: [-60, -70] }, af: { a: [60, 70] } });
  const holdT = o.kind === "stick" ? 0.14 : o.kind === "rebound" ? 0.05 : 0;
  const a = landN(-40), b = landF(40);
  const k1 = 0.5 - holdT;
  return pat("front", o.kind === "stick" ? 3 : 2, [
    { t: 0, p: E(a, 1) }, { t: holdT, p: E(a, 1) }, { t: holdT + (k1 - holdT) / 2, p: E(air(0), 0.4) }, { t: 0.5, p: E(b, 1) },
    { t: 0.5 + holdT, p: E(b, 1) }, { t: 0.5 + holdT + (0.5 - holdT) / 2, p: E(air(0), 0.4) }, { t: 1, p: E(a, 1) },
  ]);
}

export function eccentricRfd(): Pattern {
  const a = stand(0, 0, "up"), b = P(land(0), { an: { a: [-50, -30] }, af: { a: [-56, -36] } });
  return pat("side", 2.4, [{ t: 0, p: E(a, 0.2) }, { t: 0.3, p: E(a, 0.2) }, { t: 0.42, p: E(b, 1) }, { t: 0.75, p: E(b, 1) }, { t: 1, p: E(a, 0.2) }]);
}

// ---------------- running ----------------
const run = (phase: number, lean = 12, back = false): Pose => {
  // phase 0: near foot contact, 1: flight, 2: far contact, 3: flight
  const sgn = back ? -1 : 1;
  const stanceLeg: Limb = { a: [6 * sgn, -6 * sgn], end: 90 };
  const drive: Limb = { a: [70 * sgn, -10 * sgn], end: 90 };
  const push: Limb = { a: [-34 * sgn, -70 * sgn], end: back ? 60 : 130 };
  const reach: Limb = { a: [40 * sgn, 20 * sgn], end: 90 };
  const armF: Limb = { a: [40, 130] }, armB: Limb = { a: [-50, 40] };
  const t = back ? -6 : lean;
  if (phase === 0) return { root: [0, 92], t, h: 0, ln: stanceLeg, lf: drive, an: armF, af: armB };
  if (phase === 1) return { root: [0, 100], t, h: 0, ln: push, lf: reach, an: { a: [-6, 90] }, af: { a: [-6, 90] } };
  if (phase === 2) return { root: [0, 92], t, h: 0, lf: stanceLeg, ln: drive, af: armF, an: armB };
  return { root: [0, 100], t, h: 0, lf: push, ln: reach, af: { a: [-6, 90] }, an: { a: [-6, 90] } };
};
const runKeys = (t0: number, t1: number, back = false, lean = 12): Key[] =>
  [0, 1, 2, 3].map((ph, i) => ({ t: t0 + ((t1 - t0) * i) / 4, p: E(ground(run(ph, lean, back)), ph % 2 ? 0.5 : 1) }));

export function sprint(o: { then?: "decel" | "cut45" | "cut90" | "cut180" | "lunge" | "pivot"; curve?: boolean; backpedal?: boolean; band?: boolean } = {}): Pattern {
  if (!o.then) {
    const ks = runKeys(0, 1, o.backpedal, o.curve ? 18 : 12);
    return pat("side", o.backpedal ? 1 : 0.8, [...ks, { t: 1, p: ks[0].p }], o.band ? (sk) => [...band(add(sk.pelvis, [0, 4]), [140, 98], "back"), ...lineP([140, 0], [140, 110], 3)] : undefined, { scroll: o.backpedal ? -80 : 120 });
  }
  const ks = runKeys(0, 0.4);
  const deep = o.then === "cut180" || o.then === "pivot" ? 1 : o.then === "cut90" ? 0.8 : 0.6;
  const plant: Pose = ground({ root: [0, 70], t: -6 - 10 * deep, h: 0, ln: { a: [46, 6], end: 90 }, lf: { a: [-30, -70], end: 140 }, an: { a: [30, 90] }, af: { a: [-30, 60] } });
  const lunge: Pose = ground({ root: [0, 64], t: 4, h: 0, ln: { a: [62, -4], end: 90 }, lf: { a: [-40, -110], end: 160 }, an: { a: [-30, 60] }, af: { a: [30, 90] } });
  const stopP = o.then === "lunge" ? lunge : plant;
  const after: Pose = o.then === "decel" || o.then === "lunge" ? stopP : ground({ ...run(2, 30), root: [0, 88] });
  return pat("side", 2.6, [...ks, { t: 0.5, p: E(ground(run(0, 0)), 0.6) }, { t: 0.62, p: E(stopP, 1) }, { t: 0.78, p: E(stopP, 1) }, { t: 0.9, p: E(after, 0.8) }, { t: 1, p: ks[0].p }]);
}

/** Lateral movement (front view): shuffles, stops, hip turns, crossovers. */
export function lateral(o: { kind: "shuffle" | "stop" | "stopRun" | "hipTurn" | "hipTurnShuffle" | "hipTurnRun" | "tstep" | "crossover"; band?: "loaded" | "power"; lowBox?: "shuffle" | "straddle" }): Pattern {
  const ath = (x: number, w = 22, y = 0, extra: Partial<Pose> = {}): Pose => ({ ...STAND_F, root: [x, 76 + y], t: 0, ts: 0.9, h: 0, ln: { to: [x - w, 7 + y] }, lf: { to: [x + w, 7 + y] }, an: { a: [-12, -40] }, af: { a: [12, 40] }, ...extra });
  if (o.lowBox === "straddle") {
    const onBox: Pose = { ...ath(0, 7, 18), root: [0, 100] };
    const down = ath(0, 28);
    return pat("front", 1.6, [{ t: 0, p: E(onBox, 0.4) }, { t: 0.25, p: E(lift(ath(0, 18, 18), 10), 0.5) }, { t: 0.5, p: E(down, 1) }, { t: 0.75, p: E(lift(ath(0, 18, 18), 10), 0.5) }, { t: 1, p: E(onBox, 0.4) }], () => box(-12, 12, 18));
  }
  if (o.lowBox === "shuffle") {
    const a: Pose = { ...ath(0, 20), ln: { to: [-8, 25] }, lf: { to: [24, 7] } };
    const b: Pose = { ...ath(0, 20), ln: { to: [-24, 7] }, lf: { to: [8, 25] } };
    return pat("front", 1, [{ t: 0, p: E(a, 1) }, { t: 0.25, p: E(lift(ath(0, 18), 6), 0.4) }, { t: 0.5, p: E(b, 1) }, { t: 0.75, p: E(lift(ath(0, 18), 6), 0.4) }, { t: 1, p: E(a, 1) }], () => box(-16, 16, 18));
  }
  const armsFwd = o.band ? { an: { to: [-2, 118] as V, s: [0.5, 0.5] as [number, number] }, af: { to: [2, 118] as V, s: [0.5, 0.5] as [number, number] } } : {};
  const sh = (x: number, w: number) => ({ ...ath(x, w), ...armsFwd });
  const bandProps = o.band ? (sk: Parameters<NonNullable<Pattern["props"]>>[0]): Shape[] => [...tower(110, 116), ...band(midHands(sk), [110, 116])] : undefined;
  if (o.kind === "shuffle") {
    const d = o.band === "power" ? 30 : 18;
    return pat("front", 2.2, [
      { t: 0, p: E(sh(0, 22), 0.4) }, { t: 0.12, p: E(sh(-d / 2, 32), 1) }, { t: 0.25, p: E(sh(-d, 22), 0.4) }, { t: 0.37, p: E(sh(-d * 1.5, 32), 1) }, { t: 0.5, p: E(sh(-d * 2, 22), 0.4) },
      { t: 0.62, p: E(sh(-d * 1.5, 32), 1) }, { t: 0.75, p: E(sh(-d, 22), 0.4) }, { t: 0.87, p: E(sh(-d / 2, 32), 1) }, { t: 1, p: E(sh(0, 22), 0.4) }], bandProps);
  }
  if (o.kind === "stop" || o.kind === "stopRun") {
    const stop: Pose = { ...ath(-44, 36, 0), root: [-40, 66], t: 14, t2: 10 };
    const go: Pose = o.kind === "stopRun" ? { ...ath(10, 24), t: 18, ln: { to: [-14, 7] }, lf: { a: [40, 60] } } : stop;
    return pat("front", 2.6, [{ t: 0, p: E(ath(30), 0.4) }, { t: 0.15, p: E(ath(16, 32), 0.8) }, { t: 0.3, p: E(ath(0), 0.4) }, { t: 0.45, p: E(stop, 1) }, { t: 0.65, p: E(stop, 1) }, { t: 0.82, p: E(go, 0.8) }, { t: 1, p: E(ath(30), 0.4) }]);
  }
  if (o.kind === "hipTurn" || o.kind === "hipTurnShuffle" || o.kind === "hipTurnRun") {
    const turn: Pose = { ...ath(-8, 22), pw: 55, tw: 40, hr: -50, t: -10, ln: { to: [-40, 7] }, lf: { to: [14, 7] } };
    const next: Pose = o.kind === "hipTurnRun" ? { ...turn, root: [-30, 86], ln: { a: [-30, 40] }, lf: { to: [-6, 7] }, t: -16 } : o.kind === "hipTurnShuffle" ? { ...ath(-36, 30), pw: 30, tw: 20 } : turn;
    return pat("front", 2.4, [{ t: 0, p: E(ath(0), 0.4) }, { t: 0.25, p: E(turn, 1) }, { t: 0.45, p: E(turn, 1) }, { t: 0.65, p: E(next, 0.8) }, { t: 1, p: E(ath(0), 0.4) }]);
  }
  if (o.kind === "crossover" || o.kind === "tstep") {
    const cross: Pose = { ...ath(-14, 22), pw: 35, tw: 10, lf: { to: [-34, 7] }, ln: { to: [-8, 9] } };
    const out: Pose = { ...ath(-30, 26) };
    return pat("front", 2, [{ t: 0, p: E(ath(0), 0.4) }, { t: 0.3, p: E(cross, 1) }, { t: 0.55, p: E(out, 0.8) }, { t: 1, p: E(ath(0), 0.4) }]);
  }
  return pat("front", 2, [{ t: 0, p: ath(0) }, { t: 1, p: ath(0) }]);
}

void cone; void dumbbell; void STAND;
