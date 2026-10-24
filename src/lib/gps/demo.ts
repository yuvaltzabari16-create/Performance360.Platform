import type { PitchSize, Sample } from "./types";

/** Small seeded generator so the sample session is the same every time. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Typical home areas (fractions of the pitch) for 11 outfield / goalkeeper roles, cycled for larger squads. */
const HOMES: [number, number][] = [
  [0.1, 0.5], [0.28, 0.2], [0.28, 0.4], [0.28, 0.6], [0.28, 0.8], [0.5, 0.3], [0.5, 0.7], [0.55, 0.5], [0.75, 0.2], [0.75, 0.8], [0.85, 0.5],
];

/** Speeds in m/s for walking, jogging, running, high-speed running and sprinting, with how often each is chosen. */
const MODES: { speed: number; weight: number }[] = [
  { speed: 1.2, weight: 0.38 }, { speed: 3.0, weight: 0.34 }, { speed: 4.6, weight: 0.17 }, { speed: 6.0, weight: 0.08 }, { speed: 8.0, weight: 0.03 },
];

/**
 * Synthetic readings for one athlete (2 readings per second). Used only for the clearly labelled
 * sample session, so the GPS pages can be explored before a wearable is connected.
 */
export function generateSamples(index: number, pitch: PitchSize, minutes = 45): Sample[] {
  const rand = rng(1000 + index * 7919);
  const role = (index + 1) % HOMES.length; // the first athletes are outfield players; the keeper comes eleventh
  const home = HOMES[role];
  const hx = home[0] * pitch.length;
  const hy = home[1] * pitch.width;
  const goalkeeper = role === 0;
  const stepsPerSecond = 2;
  const total = minutes * 60 * stepsPerSecond;
  const out: Sample[] = [];
  let x = hx, y = hy, speed = 0, tx = hx, ty = hy, target = 0;
  let mode = MODES[0].speed;
  let segmentLeft = 0;
  for (let i = 0; i < total; i++) {
    const arrived = Math.hypot(tx - x, ty - y) < 1.5;
    if (segmentLeft <= 0 || arrived) {
      if (segmentLeft <= 0) {
        segmentLeft = (2 + rand() * 8) * stepsPerSecond;
        let pick = rand() * (goalkeeper ? 0.6 : 1);
        mode = MODES[MODES.length - 1].speed;
        for (const m of MODES) { pick -= m.weight; if (pick <= 0) { mode = m.speed; break; } }
      }
      // A new target near the home area, far enough away to keep moving at the chosen pace.
      const radius = (goalkeeper ? 8 : 30) * (0.5 + rand());
      const angle = rand() * Math.PI * 2;
      tx = Math.min(pitch.length, Math.max(0, hx + Math.cos(angle) * radius * 1.4));
      ty = Math.min(pitch.width, Math.max(0, hy + Math.sin(angle) * radius));
      target = mode;
    }
    segmentLeft--;
    const dx = tx - x, dy = ty - y;
    const dist = Math.hypot(dx, dy);
    const wanted = target;
    speed += Math.max(-5, Math.min(5, wanted - speed)) / stepsPerSecond * 1.6;
    if (dist > 0.01) {
      const step = Math.min(dist, (speed / stepsPerSecond));
      x += (dx / dist) * step;
      y += (dy / dist) * step;
    }
    const hr = Math.round(110 + Math.min(speed, 8) * 9 + rand() * 6);
    out.push({ t: i / stepsPerSecond, x, y, speed, hr });
  }
  return out;
}
