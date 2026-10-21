// Shared building blocks for movement patterns.
import type { Shape } from "./draw";
import type { Key, Pattern } from "./engine";
import { add, trunkDir, type Limb, type Pose, type Skeleton, type V, type View } from "./rig";

export const STAND: Pose = {
  root: [0, 94], t: 2, ln: { to: [3, 7] }, lf: { to: [-3, 7] },
  an: { a: [6, 10] }, af: { a: [-5, 2] },
};
export const STAND_F: Pose = {
  root: [0, 94], t: 0, ln: { to: [-11, 7] }, lf: { to: [11, 7] },
  an: { a: [-7, -3] }, af: { a: [7, 3] },
};

/** Pose with overrides; limb fields replace whole limbs. */
export function P(base: Pose, o: Partial<Pose>): Pose { return { ...base, ...o }; }
export const E = (p: Pose, e: number): Pose => ({ ...p, e });

/** Standard rep: A → B (working position, e = 1) → hold → A. */
export function rep(A: Pose, B: Pose, o: { down?: number; hold?: number; eA?: number } = {}): Key[] {
  const d = o.down ?? 0.42, h = o.hold ?? 0.12;
  const a = E(A, o.eA ?? 0.12), b = E(B, 1);
  return [{ t: 0, p: a }, { t: d, p: b }, { t: d + h, p: b }, { t: 1, p: a }];
}
/** Explosive / even timing through a list of poses, looping back to the first. */
export function seq(poses: Pose[], times?: number[]): Key[] {
  const n = poses.length;
  const ts = times ?? poses.map((_, i) => i / n);
  return [...poses.map((p, i) => ({ t: ts[i], p })), { t: 1, p: poses[0] }];
}
/** Isometric hold: tiny breathing motion, effort pulses. */
export function hold(p: Pose, breathe: V = [0, -0.8]): Key[] {
  const a = E(p, 0.75), b = E({ ...p, root: add(p.root, breathe) }, 1);
  return [{ t: 0, p: a }, { t: 0.5, p: b }, { t: 1, p: a }];
}

export function pat(view: View, dur: number, keys: Key[], props?: (sk: Skeleton) => Shape[], extra: Partial<Pattern> = {}): Pattern {
  return { view, dur, keys, props, ...extra };
}

// ---------- reference points on a skeleton ----------
/** Point on the upper trunk: `along` from the waist toward the neck, `out` toward the front (side) / near side (front). */
export function onTrunk(sk: Skeleton, along: number, out: number): V {
  const u = trunkDir(sk.t2);
  return add(add(sk.waist, u, along), [u[1], -u[0]], out);
}
export const nape = (sk: Skeleton) => onTrunk(sk, 24, -8);
export const chest = (sk: Skeleton, d = 14) => onTrunk(sk, 19, d);
export const hipFront = (sk: Skeleton, d = 12) => { const u = trunkDir(sk.t); return add(add(sk.pelvis, [u[1], -u[0]], d), u, 2); };
export const handN = (sk: Skeleton) => sk.armN.end;
export const handF = (sk: Skeleton) => sk.armF.end;
export const grip = (sk: Skeleton, side: "N" | "F" = "N") => { const a = side === "N" ? sk.armN : sk.armF; return add(a.end, [Math.sin(a.endAng * Math.PI / 180) * 4, -Math.cos(a.endAng * Math.PI / 180) * 4]); };
export const midHands = (sk: Skeleton): V => [(sk.armN.end[0] + sk.armF.end[0]) / 2, (sk.armN.end[1] + sk.armF.end[1]) / 2];
export const knee = (sk: Skeleton, side: "N" | "F" = "N") => (side === "N" ? sk.legN.mid : sk.legF.mid);
export const ankle = (sk: Skeleton, side: "N" | "F" = "N") => (side === "N" ? sk.legN.end : sk.legF.end);

export const limb = (o: Limb) => o;
