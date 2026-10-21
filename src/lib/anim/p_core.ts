// Trunk / core patterns: planks, side bends, dead bugs, leg raises, crunches, rotations, medicine ball.
import type { Shape } from "./draw";
import type { Pattern } from "./engine";
import { bench, box, cable, dumbbell, frame, inclineBench, lineP, medball, pad, plate, pullBar, tower, wall, barLong, band } from "./props";
import { E, grip, hold, midHands, P, pat, rep, seq, STAND, STAND_F, onTrunk, ankle } from "./kit";
import { alignedRoot, pushUp } from "./p_upper";
import { sidePlank, romanSideBend } from "./p_lower";
import { add, lerpV, trunkDir, type Pose, type Skeleton, type V } from "./rig";

export function plank(o: { kind: "tall" | "forearm" | "elevated" }): Pattern {
  if (o.kind !== "forearm") {
    const p = pushUp({ hands: o.kind === "elevated" ? "bench" : "floor" });
    const top = p.keys[0].p;
    return { ...p, keys: hold(top, [0, 0.6]) };
  }
  const t = 81;
  const root = alignedRoot([-82, 13], t);
  const shX = root[0] + Math.sin((t * Math.PI) / 180) * 47.5;
  const p: Pose = { root, t, h: -4, ln: { rel: true, a: [0, 0], end: t + 5 }, lf: { rel: true, a: [0, 0], end: t + 5 }, an: { to: [shX + 24, 6], bend: 1 }, af: { to: [shX + 21, 6], bend: 1 } };
  return pat("side", 3, hold(p, [0, 0.6]));
}

export function sidePlanks(o: { short?: boolean; thruster?: boolean } = {}): Pattern { return sidePlank(o); }

export type SideArms = "side" | "head" | "overhead" | "db" | "dbHead" | "smith" | "cable";
export function sideBend(o: { arms?: SideArms; straddle?: boolean; kick?: boolean; roman?: boolean; weighted?: boolean; iso?: boolean } = {}): Pattern {
  if (o.roman) return romanSideBend({ iso: o.iso, weighted: o.weighted });
  const arms = o.arms ?? "side";
  const wide = o.straddle ? 34 : 12;
  const A: Record<SideArms, Pick<Pose, "an" | "af">> = {
    side: { an: { a: [-4, -2] }, af: { a: [4, 2] } },
    head: { an: { tr: [16, -12], bend: -1 }, af: { tr: [16, -12], bend: 1 } },
    overhead: { an: { a: [-176, -178] }, af: { a: [176, 178] } },
    db: { an: { a: [-3, -2] }, af: { a: [4, 2] } },
    dbHead: { an: { a: [-3, -2] }, af: { tr: [16, -12], bend: 1 } },
    smith: { an: { tr: [2, 22], bend: 1 }, af: { tr: [2, 22], bend: -1 } },
    cable: { an: { a: [-176, -178] }, af: { a: [176, 178] } },
  };
  const base: Pose = { ...STAND_F, ln: { to: [-wide, 7] }, lf: { to: [wide, 7] }, ...A[arms] };
  const bend = P(base, { t: -6, t2: -34, h: -8, root: [4, 93], ...(o.kick ? { ln: { a: [-48, -48] } } : {}) });
  const props = (sk: Skeleton): Shape[] => [
    ...(arms === "db" || arms === "dbHead" ? dumbbell(grip(sk), "front") : []),
    ...(arms === "smith" ? barLong(onTrunk(sk, 26, 0), 52, "back") : []),
    ...(arms === "cable" ? [...tower(80, 20), ...cable([80, 20], midHands(sk))] : []),
  ];
  return pat("front", 2.8, rep(bend, base, { eA: 0.35 }), props);
}

export function deadbug(o: { straight?: boolean; weighted?: boolean } = {}): Pattern {
  const legUp = o.straight ? [178, 178] as [number, number] : [180, 92] as [number, number];
  const legOut: [number, number] = o.straight ? [104, 104] : [102, 100];
  const base: Pose = { root: [0, 10], t: -90, h: 0, ln: { a: legUp }, lf: { a: legUp }, an: { a: [180, 180] }, af: { a: [180, 180] } };
  const A = P(base, { an: o.weighted ? base.an : { a: [262, 262] }, lf: { a: legOut } });
  const B = P(base, { af: o.weighted ? base.af : { a: [262, 262] }, ln: { a: legOut } });
  return pat("side", 4, seq([E(base, 0.4), E(A, 1), E(base, 0.4), E(B, 1)]), (sk) => (o.weighted ? dumbbell(midHands(sk), "front", 7) : []));
}

/** Leg raises: captain's chair, hanging, incline reverse crunch. */
export function legRaise(o: { rig: "chair" | "hang" | "incline"; kind: "tuck" | "straight" | "garhammer"; weighted?: boolean }): Pattern {
  if (o.rig === "incline") {
    const W: V = [-14, 46];
    const at = (t: number, legs: [number, number], e: number): Pose => {
      const root = add(W, trunkDir(t), -24);
      return { root, t, t2: -66, h: 20, ln: { a: legs }, lf: { a: legs }, an: { a: [236, 200] }, af: { a: [236, 200] }, e };
    };
    return pat("side", 3, rep(at(-66, [150, 70], 0.3), at(-112, [212, 120], 1)), () => [...inclineBench(-80, 20, 36, 0, 0, 1).slice(0, 0), ...frame([[-92, 66], [24, 26]], 7), ...frame([[-60, 0], [-60, 54]], 3), ...frame([[10, 0], [10, 28]], 3)]);
  }
  const hang = o.rig === "hang";
  const shY = hang ? 222 - 54 : 150;
  const root: V = [0, shY - 47.5];
  const legsA: [number, number] = [2, -2];
  const legsB: [number, number] = o.kind === "straight" ? [94, 96] : o.kind === "garhammer" ? [128, 30] : [98, 4];
  const arms = hang ? { an: { to: [4, 222] as V }, af: { to: [2, 222] as V } } : { an: { a: [-2, 92] as [number, number] }, af: { a: [-4, 90] as [number, number] } };
  const A: Pose = { root, t: hang ? -2 : 0, h: 0, ln: { a: legsA }, lf: { a: legsA }, ...arms };
  const B = P(A, { ln: { a: legsB }, lf: { a: legsB }, t: o.kind === "garhammer" ? -18 : A.t, root: o.kind === "garhammer" ? add(root, [-2, 4]) : root });
  const props = (sk: Skeleton): Shape[] => [
    ...(hang ? pullBar([3, 222]) : [...pad([-12, shY - 50], [-12, shY + 20], 5), ...pad(add(sk.armN.mid, [-4, -5]), add(sk.armN.mid, [26, -5]), 3.6, "back"), ...frame([[-20, 0], [-20, shY + 30]], 3)]),
    ...(o.weighted ? dumbbell(lerpV(ankle(sk), ankle(sk, "F"), 0.5), "front", 6) : []),
  ];
  return pat("side", 3, rep(A, B), props);
}

export function crunch(o: { kind: "floor" | "cable" | "rope" | "decline" | "declineWeighted" | "offBench" | "ghd" }): Pattern {
  const k = o.kind;
  if (k === "cable" || k === "rope") {
    const kneel: Pose = { root: [0, 52], t: 8, h: 0, ln: { to: [2, 7], bend: -1 }, lf: { to: [-2, 7], bend: -1 }, an: { tr: [4, 8] }, af: { tr: [4, 8] } };
    // knees on the floor: shins lie back along the floor
    kneel.ln = { a: [2, -88], end: 180 }; kneel.lf = { a: [0, -88], end: 180 };
    kneel.root = [0, 51];
    const down = P(kneel, { t: 42, t2: 86, h: 20 });
    return pat("side", 2.8, rep(kneel, down), (sk) => [...tower(56, 200), ...cable([56, 200], grip(sk))]);
  }
  if (k === "decline" || k === "declineWeighted") {
    const W: V = [6, 58];
    const at = (t2: number, e: number): Pose => {
      const t = -108;
      const root = add(W, trunkDir(t), -24);
      return { root, t, t2, h: 10, ln: { to: [70, 98] }, lf: { to: [66, 98] }, an: k === "decline" ? { tr: [14, -8], bend: 1 } : { tr: [-6, 12] }, af: k === "decline" ? { tr: [14, -8], bend: 1 } : { tr: [-6, 12] }, e };
    };
    return pat("side", 2.8, rep(at(-110, 0.3), at(-40, 1)), (sk) => [...frame([[-60, 22], [64, 64]], 7), ...frame([[-40, 0], [-40, 28]], 3), ...frame([[60, 0], [60, 66], [76, 92]], 3), ...pad([66, 88], [80, 92], 4), ...(k === "declineWeighted" ? plate(onTrunk(sk, 16, 10), "front", 11) : [])]);
  }
  if (k === "offBench") {
    const W: V = [-4, 54];
    const at = (t2: number, arm: number, e: number): Pose => ({ root: add(W, trunkDir(-90), -24), t: -90, t2, h: 0, ln: { to: [56, 7] }, lf: { to: [52, 7] }, an: { rel: true, a: [arm, arm] }, af: { rel: true, a: [arm, arm] }, e });
    return pat("side", 3, rep(at(-118, 180, 0.3), at(-56, 120, 1)), () => bench(-8, 60, 44));
  }
  if (k === "ghd") {
    const at = (t: number, e: number): Pose => ({ root: [0, 92], t, h: t < -40 ? 10 : 0, ln: { to: [64, 54], end: 30 }, lf: { to: [62, 52], end: 30 }, an: { rel: true, a: [-140, -150] }, af: { rel: true, a: [-140, -150] }, e });
    return pat("side", 3, rep(at(-92, 0.3), at(6, 1)), () => [...frame([[-10, 0], [-4, 80], [64, 42], [70, 0]], 3.2), ...pad([-10, 84], [10, 84], 6), ...pad([60, 42], [70, 46], 3.6)]);
  }
  const base: Pose = { root: [0, 10], t: -90, h: 0, ln: { to: [38, 7] }, lf: { to: [34, 7] }, an: { tr: [-6, 12] }, af: { tr: [-6, 12] } };
  return pat("side", 2.6, rep(base, P(base, { t2: -56, h: 14 })));
}

/** Cable rotations (front view): hands travel across the body while the shoulders turn. */
export function cableRotation(o: { stance: "stand" | "bent" | "bentAnchor" | "halfKneel" }): Pattern {
  const bent = o.stance === "bent" || o.stance === "bentAnchor";
  const kneel = o.stance === "halfKneel";
  const y = bent ? 96 : kneel ? 92 : 130;
  const root: V = kneel ? [0, 52] : [0, bent ? 86 : 94];
  const legs = kneel
    ? { ln: { to: [-12, 6] as V, s: [1, 0.3] as [number, number], end: 0 }, lf: { a: [6, 2] as [number, number], s: [0.35, 1] as [number, number] } }
    : { ln: { to: [-18, 7] as V }, lf: { to: [18, 7] as V } };
  const mk = (side: number, e: number): Pose => ({
    root, t: 0, ts: bent ? 0.5 : 1, tw: side * 50, h: 0, hr: side * 40, ...legs,
    an: { to: [side * 36 - 2, y], s: [0.8, 0.8] }, af: { to: [side * 36 + 2, y], s: [0.8, 0.8] }, e,
  });
  const anchor: V = [-90, y];
  return pat("front", 2.8, rep(mk(-1, 0.3), mk(1, 1)), (sk) => [...tower(anchor[0], anchor[1]), ...cable(anchor, midHands(sk))]);
}

/** Medicine-ball throws; ball travels with x (0 = in the hands, 1 = at the target). */
export function medBall(o: { kind: "scoopWall" | "overheadTap" | "chestPass" | "slam" | "rotSlam" | "rotThrow" | "scoop" | "hammer" }): Pattern {
  const k = o.kind;
  const side = !(k === "rotSlam" || k === "rotThrow" || k === "scoop" || k === "hammer");
  let target: V = [0, 0];
  let keys: { t: number; p: Pose }[];
  if (side) {
    if (k === "chestPass") {
      target = [84, 128];
      const a: Pose = { ...STAND, ln: { to: [14, 7] }, lf: { to: [-14, 7] }, an: { tr: [-8, 14] }, af: { tr: [-8, 14] } };
      const b = P(a, { t: 8, an: { tr: [-6, 50] }, af: { tr: [-6, 50] } });
      keys = [{ t: 0, p: E(a, 0.3) }, { t: 0.25, p: E({ ...b, x: 0 }, 1) }, { t: 0.5, p: E({ ...b, x: 1 }, 0.6) }, { t: 0.75, p: E({ ...b, x: 0 }, 0.6) }, { t: 1, p: E(a, 0.3) }];
    } else if (k === "overheadTap") {
      target = [76, 182];
      const a: Pose = { ...STAND, ln: { to: [14, 7] }, lf: { to: [-14, 7] }, an: { tr: [40, 18] }, af: { tr: [40, 18] } };
      const b = P(a, { t: 6, an: { tr: [52, 10] }, af: { tr: [52, 10] } });
      keys = [{ t: 0, p: E({ ...a, x: 0 }, 0.4) }, { t: 0.3, p: E({ ...b, x: 0.4 }, 1) }, { t: 0.5, p: E({ ...b, x: 1 }, 0.8) }, { t: 0.75, p: E({ ...b, x: 0.3 }, 0.6) }, { t: 1, p: E({ ...a, x: 0 }, 0.4) }];
    } else if (k === "scoopWall") {
      target = [86, 160];
      const a: Pose = { root: [-16, 66], t: 34, h: -10, ln: { to: [8, 7] }, lf: { to: [-6, 7] }, an: { tr: [-40, 30] }, af: { tr: [-40, 30] } };
      const b: Pose = { ...STAND, root: [2, 96], t: -6, ln: { to: [8, 7], end: 60 }, lf: { to: [-6, 7], end: 60 }, an: { tr: [40, 40] }, af: { tr: [40, 40] } };
      keys = [{ t: 0, p: E(a, 0.5) }, { t: 0.3, p: E({ ...b, x: 0 }, 1) }, { t: 0.55, p: E({ ...b, x: 1 }, 0.5) }, { t: 0.85, p: E({ ...a, x: 0 }, 0.5) }, { t: 1, p: E(a, 0.5) }];
    } else {
      target = [42, 9];
      const a: Pose = { ...STAND, root: [0, 98], ln: { to: [8, 9], end: 60 }, lf: { to: [-8, 9], end: 60 }, an: { tr: [50, 10] }, af: { tr: [50, 10] }, t: -8 };
      const b: Pose = { root: [-18, 70], t: 50, h: -14, ln: { to: [8, 7] }, lf: { to: [-8, 7] }, an: { tr: [-6, 52] }, af: { tr: [-6, 52] } };
      keys = [{ t: 0, p: E({ ...a, x: 0 }, 0.5) }, { t: 0.3, p: E({ ...b, x: 0 }, 1) }, { t: 0.45, p: E({ ...b, x: 1 }, 0.7) }, { t: 0.75, p: E({ ...b, x: 0 }, 0.5) }, { t: 1, p: E({ ...a, x: 0 }, 0.5) }];
    }
    return pat("side", 2.4, keys, (sk) => [...(k === "slam" ? [] : wall(target[0] + 9, 200, 1)), ...medball(lerpV(midHands(sk), target, sk.x), "front")]);
  }
  // rotational (front view)
  const low = k === "scoop" || k === "rotThrow";
  const over = k === "rotSlam" || k === "hammer";
  target = over ? [-66, 9] : [-104, low ? 70 : 110];
  const load: Pose = { ...STAND_F, root: [6, low ? 80 : 94], t: 0, tw: 50, pw: 20, hr: 30, ln: { to: [-24, 7] }, lf: { to: [24, 7] },
    an: { to: over ? [34, 186] : [34, low ? 66 : 92], s: [0.8, 0.8] }, af: { to: over ? [38, 186] : [38, low ? 66 : 92], s: [0.8, 0.8] } };
  const fin: Pose = { ...load, root: [-6, over ? 84 : 92], t: over ? -14 : -4, tw: -50, pw: -20, hr: -40,
    an: { to: over ? [-46, 60] : [-56, low ? 110 : 116], s: [0.8, 0.8] }, af: { to: over ? [-42, 60] : [-52, low ? 110 : 116], s: [0.8, 0.8] } };
  keys = [{ t: 0, p: E({ ...load, x: 0 }, 0.5) }, { t: 0.3, p: E({ ...fin, x: 0 }, 1) }, { t: 0.5, p: E({ ...fin, x: 1 }, 0.6) }, { t: 0.78, p: E({ ...fin, x: 0 }, 0.5) }, { t: 1, p: E({ ...load, x: 0 }, 0.5) }];
  return pat("front", 2.4, keys, (sk) => [...(over ? [] : wall(target[0] - 9, 200, -1)), ...medball(lerpV(midHands(sk), target, sk.x), "front")]);
}

void box; void lineP; void inclineBench; void band; void sidePlank;
