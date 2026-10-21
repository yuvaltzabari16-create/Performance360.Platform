// Equipment drawn around the figure. Every function returns shapes with a fixed structure so they animate.
import { blob, capsule, circ, ellipse, line, path, poly, type Layer, type Shape } from "./draw";
import { add, lerpV, norm, sub, type V } from "./rig";

export const dumbbell = (c: V, layer: Layer = "front", r = 6): Shape[] => [
  circ("db", c, r, "an-pl", layer), circ("dbh", c, r * 0.36, "an-p", layer),
];
/** Dumbbell seen lengthwise (axis = direction of the handle on screen). */
export const dumbbellLong = (c: V, axis: V, layer: Layer = "front", s = 1): Shape[] => {
  const u = norm(axis);
  return [
    path("dbl", line(add(c, u, -9 * s), add(c, u, 9 * s)), "an-ps", layer),
    path("dbl1", capsule(add(c, u, -10 * s), add(c, u, -6 * s), 4.8 * s, 4.8 * s), "an-pl", layer),
    path("dbl2", capsule(add(c, u, 6 * s), add(c, u, 10 * s), 4.8 * s, 4.8 * s), "an-pl", layer),
  ].map((x, i) => (i === 0 ? { ...x, a: { ...x.a, "stroke-width": "2.6" } } : x));
};
export const kettlebell = (hand: V, layer: Layer = "front"): Shape[] => {
  const c = add(hand, [0, -9]);
  return [
    path("kbh", `M${pp(add(hand, [-4, -3]))}Q${pp(add(hand, [0, 4]))} ${pp(add(hand, [4, -3]))}`, "an-ps", layer),
    circ("kb", c, 7.5, "an-pl", layer),
  ].map((x, i) => (i === 0 ? { ...x, a: { ...x.a, "stroke-width": "2.4" } } : x));
};
const pp = (p: V) => `${Math.round(p[0] * 10) / 10} ${Math.round(-p[1] * 10) / 10}`;

/** Barbell seen end-on (plate + sleeve). */
export const plate = (c: V, layer: Layer = "back", r = 20): Shape[] => [
  circ("pl", c, r, "an-pl", layer), circ("pl2", c, r * 0.55, "an-p", layer), circ("pl3", c, 2.4, "an-pad2", layer),
];
/** Barbell seen lengthwise (front view). */
export const barLong = (c: V, half = 46, layer: Layer = "front"): Shape[] => [
  path("bar", line(add(c, [-half, 0]), add(c, [half, 0])), "an-ps", layer),
  path("blp", capsule(add(c, [-half + 2, 0]), add(c, [-half + 8, 0]), 13, 13), "an-pl", layer),
  path("brp", capsule(add(c, [half - 8, 0]), add(c, [half - 2, 0]), 13, 13), "an-pl", layer),
].map((x, i) => (i === 0 ? { ...x, a: { ...x.a, "stroke-width": "2.4" } } : x));

export const medball = (c: V, layer: Layer = "front", r = 8.5): Shape[] => [
  circ("mb", c, r, "an-ball", layer),
  path("mbs", `M${pp(add(c, [-r * 0.8, -r * 0.5]))}Q${pp(c)} ${pp(add(c, [r * 0.8, r * 0.5]))}`, "an-cable", layer),
];
export const physioBall = (c: V, r = 22, layer: Layer = "back"): Shape[] => [circ("pb", c, r, "an-box", layer)];

export const band = (a: V, b: V, layer: Layer = "front"): Shape[] => [path("band", line(a, b), "an-band", layer)];
export const cable = (a: V, b: V, layer: Layer = "front"): Shape[] => [
  path("cab", line(a, b), "an-cable", layer), circ("cabh", b, 2.6, "an-p", layer),
];
export const stick = (a: V, b: V, layer: Layer = "front", w = 3): Shape[] => [
  { ...path("stick", line(a, b), "an-ps", layer), a: { d: line(a, b), "stroke-width": String(w) } },
];
export const dowelEnd = (c: V, layer: Layer = "front"): Shape[] => [circ("dw", c, 2.6, "an-p", layer)];

// ---------- static furniture ----------
export const box = (x0: number, x1: number, h: number, y = 0, layer: Layer = "back"): Shape[] => [
  path("box", `M${pp([x0, y])}L${pp([x0, y + h])}L${pp([x1, y + h])}L${pp([x1, y])}Z`, "an-box", layer),
];
export const bench = (x0: number, x1: number, h = 40, layer: Layer = "back"): Shape[] => [
  path("bpad", capsule([x0 + 3, h - 3], [x1 - 3, h - 3], 3.6, 3.6), "an-pad", layer),
  path("bleg", `M${pp([x0 + 6, 0])}L${pp([x0 + 6, h - 6])}M${pp([x1 - 6, 0])}L${pp([x1 - 6, h - 6])}`, "an-ps", layer),
].map((x, i) => (i === 1 ? { ...x, a: { ...x.a, "stroke-width": "3" } } : x));
/** Incline bench: seat from x0..x1 at height h, back pad from the seat end up at `deg` from horizontal. */
export const inclineBench = (x0: number, x1: number, h: number, deg: number, backLen = 62, dir = -1, layer: Layer = "back"): Shape[] => {
  const piv: V = dir < 0 ? [x0, h] : [x1, h];
  const r = (deg * Math.PI) / 180;
  const top: V = add(piv, [Math.cos(r) * backLen * dir, Math.sin(r) * backLen]);
  return [
    path("ibs", capsule([x0 + 3, h - 3], [x1 - 3, h - 3], 3.6, 3.6), "an-pad", layer),
    path("ibb", capsule(add(piv, [0, -2]), add(top, [0, -2]), 3.6, 3.6), "an-pad", layer),
    { ...path("ibl", `M${pp([x0 + 5, 0])}L${pp([x0 + 5, h - 6])}M${pp([x1 - 5, 0])}L${pp([x1 - 5, h - 6])}M${pp(add(piv, [0, -6]))}L${pp(lerpV(piv, top, 0.6))}`, "an-ps", layer), a: { d: `M${pp([x0 + 5, 0])}L${pp([x0 + 5, h - 6])}M${pp([x1 - 5, 0])}L${pp([x1 - 5, h - 6])}`, "stroke-width": "3" } },
  ];
};
export const wall = (x: number, h = 190, side = 1, layer: Layer = "back"): Shape[] => [
  path("wall", `M${pp([x, 0])}L${pp([x, h])}L${pp([x + 8 * side, h])}L${pp([x + 8 * side, 0])}Z`, "an-pad2", layer),
];
export const pullBar = (c: V, layer: Layer = "back"): Shape[] => [
  { ...path("pbs", `M${pp(add(c, [-14, 0]))}L${pp(add(c, [14, 0]))}`, "an-ps", layer), a: { d: `M${pp(add(c, [0, 4]))}L${pp(add(c, [0, 30]))}`, "stroke-width": "3" } },
  circ("pb", c, 3.4, "an-p", layer),
];
export const rail = (x: number, h = 200, layer: Layer = "back"): Shape[] => [
  { ...path("rail", line([x, 0], [x, h]), "an-ps", layer), a: { d: line([x, 0], [x, h]), "stroke-width": "3.2" } },
];
export const tower = (x: number, pulleyY: number, layer: Layer = "back"): Shape[] => {
  const h = Math.max(pulleyY + 16, 90);
  return [
    path("tw", `M${pp([x - 4, 0])}L${pp([x - 4, h])}L${pp([x + 4, h])}L${pp([x + 4, 0])}Z`, "an-pad2", layer),
    circ("tp", [x, pulleyY], 4, "an-p", layer),
    path("tst", `M${pp([x - 9, 0])}L${pp([x - 9, 34])}L${pp([x - 5, 34])}L${pp([x - 5, 0])}Z`, "an-p", layer),
  ];
};
export const hurdle = (x: number, h = 32, layer: Layer = "back"): Shape[] => [
  { ...path("hd", `M${pp([x, 0])}L${pp([x, h])}`, "an-ps", layer), a: { d: `M${pp([x - 6, 0])}L${pp([x, h])}L${pp([x + 6, 0])}`, "stroke-width": "2.6" } },
  circ("hdt", [x, h], 3.2, "an-pad", layer),
];
export const cone = (x: number, layer: Layer = "back"): Shape[] => [
  path("cone", `M${pp([x - 6, 0])}L${pp([x, 15])}L${pp([x + 6, 0])}Z`, "an-pad", layer),
];
export const wedge = (x0: number, x1: number, h: number, high: "left" | "right" = "left", layer: Layer = "back"): Shape[] => [
  path("wedge", high === "left" ? `M${pp([x0, 0])}L${pp([x0, h])}L${pp([x1, 0])}Z` : `M${pp([x0, 0])}L${pp([x1, h])}L${pp([x1, 0])}Z`, "an-box", layer),
];
export const slider = (c: V, layer: Layer = "back"): Shape[] => [path("sld", ellipse(add(c, [0, 1.4]), [1, 0], 8, 1.6), "an-pad", layer)];
export const pad = (a: V, b: V, r = 4, layer: Layer = "back", cls = "an-pad"): Shape[] => [path("pad", capsule(a, b, r, r), cls, layer)];
export const frame = (pts: V[], w = 3, layer: Layer = "back", close = false): Shape[] => [
  { ...path("fr", poly(pts, close), "an-ps", layer), a: { d: poly(pts, close), "stroke-width": String(w) } },
];
export const towel = (c: V, layer: Layer = "back"): Shape[] => [path("tow", ellipse(c, [1, 0], 9, 4), "an-pad2", layer)];
export const hand = (c: V, layer: Layer = "front"): Shape[] => [path("mh", ellipse(c, [1, 0], 5, 3.8), "an-b an-far", layer)];
export const softBlob = (pts: V[], cls = "an-pad2", layer: Layer = "back"): Shape[] => [path("blob", blob(pts), cls, layer)];
export const lineP = (a: V, b: V, w = 2.4, layer: Layer = "back"): Shape[] => [
  { ...path("ln", line(a, b), "an-ps", layer), a: { d: line(a, b), "stroke-width": String(w) } },
];
export const midpoint = (a: V, b: V) => lerpV(a, b, 0.5);
export const toward = (a: V, b: V, d: number) => add(a, norm(sub(b, a)), d);
