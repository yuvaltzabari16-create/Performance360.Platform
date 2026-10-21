// Assembles a movement pattern into a looping SVG (SMIL animation, no JS needed to play).
import { bodyShapes, skeletonPoints, type Muscle, type Shape } from "./draw";
import { ease, lerpPose, solve, type Pose, type Skeleton, type V, type View } from "./rig";

export interface Key { t: number; p: Pose; lin?: boolean }
export interface Pattern {
  view: View;
  dur: number;                 // seconds per loop
  keys: Key[];                 // t in [0,1]; last pose should equal the first for a seamless loop
  props?: (sk: Skeleton) => Shape[];
  ground?: boolean;            // draw floor (default true)
  /** extra points to include in framing */
  frame?: V[];
  /** run-in-place: ground dashes scroll at this speed (units per loop) */
  scroll?: number;
  /** fixed close-up window [x0, y0, x1, y1] in world units (no floor) */
  crop?: [number, number, number, number];
}
export interface Anim { pattern: Pattern; muscles: Muscle[] }

const N = 40;
let UID = 0;

export function poseAt(pat: Pattern, k: number): Pose {
  const ks = pat.keys;
  if (k <= ks[0].t) return ks[0].p;
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (k <= b.t) {
      const u = b.t === a.t ? 1 : (k - a.t) / (b.t - a.t);
      return lerpPose(a.p, b.p, b.lin ? u : ease(u));
    }
  }
  return ks[ks.length - 1].p;
}

function frameShapes(anim: Anim, k: number): { shapes: Shape[]; pts: V[]; o: number } {
  const pose = poseAt(anim.pattern, k);
  const sk = solve(pose, anim.pattern.view);
  const body = bodyShapes(sk, anim.muscles, pose.e ?? 0);
  const props = (anim.pattern.props?.(sk) ?? []).map((s, i) => ({ ...s, id: `p${i}-${s.id}` }));
  const pts = skeletonPoints(sk);
  for (const p of props) collectPts(p, pts);
  return {
    shapes: [...props.filter((p) => p.layer === "back"), ...interleave(body, props), ...props.filter((p) => p.layer === "front")],
    pts, o: pose.o ?? 1,
  };
}
/** "mid" props go right after the torso (behind the near limbs in side view). */
function interleave(body: Shape[], props: Shape[]): Shape[] {
  const mid = props.filter((p) => !p.layer || p.layer === "mid");
  if (!mid.length) return body;
  const i = body.findIndex((s) => s.id === "torso");
  const j = body.findIndex((s, n) => n > i && !s.id.startsWith("m-"));
  const at = j < 0 ? body.length : j;
  return [...body.slice(0, at), ...mid, ...body.slice(at)];
}
function collectPts(s: Shape, out: V[]) {
  if (s.tag === "circle") {
    const cx = Number(s.a.cx), cy = -Number(s.a.cy), r = Number(s.a.r);
    out.push([cx - r, cy - r], [cx + r, cy + r]);
  } else if (typeof s.a.d === "string" && s.a.d !== "M0 0Z") {
    const nums = s.a.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    // arcs contain flags/radii; good enough for framing since control points dominate
    for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i], -nums[i + 1]]);
  }
}

const STYLE = `.an-b{fill:var(--an-body,#DCE4DF)}.an-o{fill:var(--an-edge,#9AAAA1);stroke:var(--an-edge,#9AAAA1);stroke-width:2.4;stroke-linejoin:round}
.an-b.an-far{fill:var(--an-body2,#C4D0C9)}
.an-face{fill:var(--an-edge,#9AAAA1);opacity:.55}
.an-m{fill:var(--an-muscle,#3FAE4F)}.an-m.an-far{fill:var(--an-muscle2,#2E8C3E)}
.an-p{fill:var(--an-prop,#3B4A42)}.an-ps{fill:none;stroke:var(--an-prop,#3B4A42);stroke-linecap:round;stroke-linejoin:round}
.an-pl{fill:var(--an-plate,#56665D);stroke:var(--an-prop,#3B4A42);stroke-width:1.2}
.an-pad{fill:var(--an-pad,#0B5A3A)}.an-pad2{fill:var(--an-pad2,#A9B8B0)}
.an-box{fill:var(--an-boxc,#E9EFEB);stroke:var(--an-edge,#9AAAA1);stroke-width:1.2}
.an-band{fill:none;stroke:var(--an-band,#7BC86C);stroke-width:2.6;stroke-linecap:round}
.an-cable{fill:none;stroke:var(--an-cable,#56665D);stroke-width:1.3}
.an-ball{fill:var(--an-ball,#0B5A3A);stroke:var(--an-prop,#3B4A42);stroke-width:1}
.an-floor{fill:var(--an-floor,#EEF4F0)}.an-fl{stroke:var(--an-edge,#9AAAA1);stroke-width:1.2}
.an-dash{stroke:var(--an-edge,#9AAAA1);stroke-width:2;stroke-dasharray:6 14}`;

export interface RenderOpts { animate?: boolean; at?: number; title?: string; className?: string }

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** Renders an animation to an SVG string. animate=false gives a single still at `at` (default: hardest point). */
export function renderSVG(anim: Anim, o: RenderOpts = {}): string {
  const pat = anim.pattern;
  const animate = o.animate !== false;
  const peak = o.at ?? pat.keys.reduce((b, k) => ((k.p.e ?? 0) > (b.p.e ?? 0) ? k : b), pat.keys[0]).t;
  const ks = animate ? Array.from({ length: N + 1 }, (_, i) => i / N) : [peak];
  const frames = ks.map((k) => frameShapes(anim, k));
  // framing over the whole loop
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const allPts = (animate ? frames : ks.length ? Array.from({ length: 13 }, (_, i) => frameShapes(anim, i / 12)) : frames).flatMap((fr) => fr.pts);
  for (const [x, y] of [...allPts, ...(pat.frame ?? [])]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const ground = pat.ground !== false && !pat.crop;
  if (pat.crop) { [x0, y0, x1, y1] = pat.crop; }
  if (ground) y0 = Math.min(y0, -3);
  const pad = pat.crop ? 0 : 10;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  // 4:3 aspect, keep a minimum size so small movements are not blown up
  let w = pat.crop ? x1 - x0 : Math.max(x1 - x0, 120), h = pat.crop ? y1 - y0 : Math.max(y1 - y0, 90);
  if (w / h < 4 / 3) w = (h * 4) / 3; else h = (w * 3) / 4;
  const cx = (x0 + x1) / 2;
  let cy = (y0 + y1) / 2;
  if (ground) cy = Math.max(cy, -8 + h / 2 - pad - 4); // keep the floor near the bottom
  const vx = cx - w / 2, vy = -(cy + h / 2);
  const parts: string[] = [];
  if (ground) {
    // floor runs past the viewBox so it reaches the frame edges when the SVG is letterboxed (overflow: visible)
    parts.push(`<rect class="an-floor" x="${fmt(vx - 2000)}" y="0" width="${fmt(w + 4000)}" height="${fmt(h)}"/>`);
    parts.push(`<path class="an-fl" d="M${fmt(vx - 2000)} 0H${fmt(vx + w + 2000)}"/>`);
    if (pat.scroll && animate) {
      parts.push(`<path class="an-dash" d="M${fmt(vx - 40)} 5H${fmt(vx + w + 40)}"><animate attributeName="stroke-dashoffset" values="0;${pat.scroll}" dur="${pat.dur}s" repeatCount="indefinite"/></path>`);
    }
  }
  const first = frames[0].shapes;
  const ops = frames.map((fr) => fr.o);
  const fades = animate && ops.some((v) => v !== 1);
  let fadeOpen = false;
  const uid = "a" + (++UID).toString(36);
  let gStart = -1;
  for (let si = 0; si < first.length; si++) {
    const s = first[si];
    const grouped = !!s.grp;
    if (grouped && first[si - 1]?.grp !== s.grp) {
      // open group: outline copies of every member first, then the fills
      gStart = si;
      const ids: string[] = [];
      for (let j = si; j < first.length && first[j].grp === s.grp; j++) ids.push(`${uid}-${j}`);
      parts.push(`<g class="an-o">${ids.map((id) => `<use href="#${id}"/>`).join("")}</g><g class="${s.cls}">`);
    }
    void gStart;
    const attrs: string[] = grouped ? [`id="${uid}-${si}"`] : [`class="${s.cls}"`];
    const anims: string[] = [];
    // when the figure fades (reset of a travelling drill), unchanged furniture stays outside the fading group
    if (fades && !fadeOpen && (s.grp || Object.keys(s.a).some((key) => frames.some((fr) => fr.shapes[si]?.a[key] !== s.a[key])))) {
      if (grouped && first[si - 1]?.grp === s.grp) { /* already inside */ } else {
        parts.splice(grouped ? parts.length - 1 : parts.length, 0, `<g opacity="${ops[0]}"><animate attributeName="opacity" values="${ops.map(fmt).join(";")}" dur="${pat.dur}s" repeatCount="indefinite"/>`);
        fadeOpen = true;
      }
    }
    for (const [key, v0] of Object.entries(s.a)) {
      const vals = frames.map((fr) => fr.shapes[si]?.a[key] ?? v0);
      const same = vals.every((v) => v === vals[0]);
      attrs.push(`${key}="${v0}"`);
      if (!same && animate) anims.push(`<animate attributeName="${key}" values="${vals.join(";")}" dur="${pat.dur}s" repeatCount="indefinite"/>`);
    }
    parts.push(anims.length ? `<${s.tag} ${attrs.join(" ")}>${anims.join("")}</${s.tag}>` : `<${s.tag} ${attrs.join(" ")}/>`);
    if (grouped && first[si + 1]?.grp !== s.grp) parts.push("</g>");
  }
  if (fadeOpen) parts.push("</g>");
  const title = o.title ? `<title>${o.title.replace(/[<&]/g, "")}</title>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vx)} ${fmt(vy)} ${fmt(w)} ${fmt(h)}" class="${o.className ?? "exanim"}" role="img">${title}<style>${STYLE}</style>${parts.join("")}</svg>`;
}
