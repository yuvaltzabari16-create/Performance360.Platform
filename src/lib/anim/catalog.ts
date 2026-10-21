// Maps an exercise (category + name + equipment) to an animated movement pattern and its working muscles.
// Rules are keyword based, so exercises added by a club get a sensible animation too.
import type { Muscle } from "./draw";
import type { Anim, Pattern } from "./engine";
import * as Lo from "./p_lower";
import * as Up from "./p_upper";
import * as Co from "./p_core";
import * as Pl from "./p_plyo";
import * as Re from "./p_rehab";

export interface ExLike { category: string; name_en: string; equipment?: string[] | null }

type R = [Pattern, Muscle[]];

function lower(c: string, n: string, eq: string[]): R | null {
  const has = (re: RegExp) => re.test(n);
  const db = has(/dumbbell|\bdb\b|goblet/) || eq.includes("dumbbell");
  const smith = has(/smith/);
  const single = has(/single leg|single-leg/);
  if (c === "squat") {
    if (has(/wall sit/)) return [Lo.wallSit({ single, weighted: has(/weighted/) }), ["quads", "glutes"]];
    if (has(/wall squat/)) return [Lo.wallSit({ dynamic: true, heels: has(/heels elevated/) }), ["quads", "glutes"]];
    if (has(/leg press/)) return [Lo.legPress({ single, horizontal: has(/horizontal/) }), ["quads", "glutes"]];
    if (has(/pendulum|hack/)) return [Lo.squat({ load: "back", machine: has(/hack/) ? "hack" : "pendulum" }), ["quads", "glutes"]];
    if (has(/single leg squat/)) return [Lo.singleLegSquat(), ["quads", "glutes"]];
    if (has(/kickstand squat/)) return [Lo.singleLegSquat({ kickstand: true }), ["quads", "glutes"]];
    if (has(/rear foot elevated/)) return [Lo.splitSquat({ rfe: true, smith, load: db ? "db" : "none" }), ["quads", "glutes", "adductors"]];
    if (has(/split squat/)) return [Lo.splitSquat({ load: db ? "db" : "none", smith, reduced: has(/reduced/), support: has(/hand support/), wallFront: has(/wall constrained/) }), ["quads", "glutes"]];
    if (has(/walking lunge/)) return [Lo.reverseLunge({ walking: true, load: db ? "db" : "none" }), ["quads", "glutes"]];
    if (has(/lateral lunge/)) return [Lo.lateralLunge({ goblet: has(/goblet/), box: has(/box/) }), ["adductors", "quads", "glutes"]];
    if (has(/lunge/)) return [Lo.reverseLunge({ load: db ? "db" : "none", smith }), ["quads", "glutes"]];
    if (has(/step.?up/)) return [Lo.stepUp({ support: has(/hand support/), load: db ? "db" : "none" }), ["quads", "glutes"]];
    if (has(/lateral step down/)) return [Lo.lateralStepDown({ wall: has(/wall/) }), ["quads", "glutes", "abductors"]];
    const load: Lo.Load = has(/zercher/) ? "zercher" : has(/front squat/) ? "front" : has(/back squat|barbell/) ? "back" : has(/goblet/) ? "goblet" : "none";
    return [Lo.squat({ load, box: has(/to box/), heels: has(/heels elevated/) }), ["quads", "glutes", "adductors"]];
  }
  if (c === "hinge") {
    if (has(/trap bar/)) return [Lo.rdl({ trap: true }), ["glutes", "hams", "quads", "lowback"]];
    if (has(/deadlift/)) return [Lo.rdl({ deadlift: true }), ["glutes", "hams", "lowback", "quads"]];
    if (has(/single leg .*rdl|kickstand/)) return [Lo.slRdl({ support: has(/hand support/), kickstand: has(/kickstand/), smith, landmine: has(/landmine/), load: has(/kickstand/) ? "db" : "none" }), ["hams", "glutes"]];
    if (has(/rdl/)) return [Lo.rdl({ load: has(/kb/) ? "kb" : db ? "db" : "back" }), ["hams", "glutes", "lowback"]];
    if (has(/back extension/)) return [Lo.backExtension({ iso: has(/isometric/), weighted: has(/weighted/), single, ghr: has(/ghr/) }), ["lowback", "glutes", "hams"]];
    if (has(/hip thrust/)) return [Lo.hipThrust({ load: has(/barbell/) ? "back" : db ? "db" : has(/weighted/) ? "db" : "none", single, smith }), ["glutes", "hams"]];
    if (has(/bridge/)) return [Lo.bridge({ single, elevated: has(/feet elevated/), iso: has(/isometric/) }), ["glutes", "hams"]];
  }
  if (c === "quad") {
    const iso = has(/90 degrees/) ? 90 : has(/60 degrees/) ? 60 : undefined;
    return [Lo.legExtension({ single, partial: has(/partial/), iso }), ["quads"]];
  }
  if (c === "hamstring") {
    if (has(/nordic/)) return [Lo.nordic(), ["hams"]];
    if (has(/slider/)) return [Lo.sliderCurl({ single, eccentric: has(/eccentric/) }), ["hams", "glutes"]];
    return [Lo.hamCurlMachine({ prone: has(/prone/), single }), ["hams"]];
  }
  if (c === "adductor") {
    if (has(/bridge/)) return [Lo.bridge({ squeeze: true }), ["adductors", "glutes"]];
    if (has(/ball squeeze/)) return [Lo.ballSqueezeSeated(), ["adductors"]];
    if (has(/machine/)) return [Lo.hipMachine({ add: true }), ["adductors"]];
    return [Lo.sidePlank({ cop: true, short: has(/short/), thruster: has(/thruster/) }), ["adductors", "obliques"]];
  }
  if (c === "abductor") {
    if (has(/machine/)) return [Lo.hipMachine({ add: false }), ["abductors", "glutes"]];
    if (has(/sidestep/)) return [Lo.sidestep(), ["abductors", "glutes"]];
    if (has(/side bend/)) return [Lo.romanSideBend({ iso: has(/isometric/) }), ["obliques", "abductors"]];
    return [Lo.sidePlank({ short: has(/short/), thruster: has(/thruster/) }), ["abductors", "obliques"]];
  }
  if (c === "calf") {
    return [Lo.heelRaise({
      single, iso: has(/isometric/), deficit: has(/deficit/), seated: has(/seated/), legPress: has(/leg press/),
      frontFoot: has(/front foot/), load: smith ? "smith" : has(/weighted/) ? "db" : undefined,
    }), ["calves"]];
  }
  return null;
}

function plyo(c: string, n: string): R | null {
  const has = (re: RegExp) => re.test(n);
  const single = has(/single leg/);
  const legs: Muscle[] = ["calves", "quads", "glutes"];
  if (c === "plyo") {
    if (has(/pogo/)) return [Pl.pogo({ single, dir: has(/lateral/) ? "lateral" : has(/forward/) ? "fb" : has(/split/) ? "split" : "up", frontFoot: has(/front foot/) }), ["calves"]];
    if (has(/box jumps? to altitude/)) return [Pl.boxJump({ toDrop: true }), legs];
    if (has(/box jump/)) return [Pl.boxJump({ single }), legs];
    if (has(/altitude drop/)) return [Pl.dropJump({ kind: "altitude" }), ["quads", "glutes"]];
    if (has(/drop to lateral heiden/)) return [Pl.dropJump({ kind: "slHeiden" }), ["glutes", "abductors", "quads"]];
    if (has(/heiden/)) return [Pl.heiden({ kind: has(/stick/) ? "stick" : has(/rebound/) ? "rebound" : "continuous" }), ["glutes", "abductors", "quads"]];
    if (has(/seated vertical/)) return [Pl.cmj({ seated: true }), legs];
    if (has(/seated broad/)) return [Pl.broadJump({ seated: true }), legs];
    if (has(/countermovement/)) return [Pl.cmj({ repeat: has(/repeat/), load: has(/weighted/), single }), legs];
    if (has(/hurdle/)) return [Pl.broadJump({ hurdle: single ? "single" : has(/mini bounce/) ? "bounce" : has(/continuous/) ? "continuous" : "stick" }), legs];
    if (has(/broad/)) return [Pl.broadJump({ double: has(/double/) }), legs];
    if (has(/drop jump/)) return [Pl.dropJump({ kind: "drop" }), legs];
    if (has(/depth jump/)) return [Pl.dropJump({ kind: "depth" }), legs];
    return [Pl.eccentricRfd(), ["quads", "glutes"]];
  }
  if (c === "cod") {
    const cod: Muscle[] = ["quads", "glutes", "adductors"];
    if (has(/low box shuffle/)) return [Pl.lateral({ kind: "shuffle", lowBox: "shuffle" }), ["calves", "quads"]];
    if (has(/straddle/)) return [Pl.lateral({ kind: "shuffle", lowBox: "straddle" }), ["calves", "quads", "adductors"]];
    if (has(/anti-rotation/)) return [Pl.lateral({ kind: "shuffle", band: has(/power/) ? "power" : "loaded" }), ["obliques", "abs", "glutes"]];
    if (has(/back pedal/)) return [Pl.sprint({ backpedal: true, band: true }), ["quads", "calves"]];
    if (has(/hip turn/)) return [Pl.lateral({ kind: has(/run/) ? "hipTurnRun" : has(/shuffle/) ? "hipTurnShuffle" : "hipTurn" }), cod];
    if (has(/lateral stop to/)) return [Pl.lateral({ kind: "stopRun" }), cod];
    if (has(/lateral stop/)) return [Pl.lateral({ kind: "stop" }), cod];
    if (has(/lunge stop/)) return [Pl.sprint({ then: "lunge" }), ["quads", "glutes"]];
    if (has(/t.step/)) return [Pl.lateral({ kind: "tstep" }), cod];
    if (has(/lateral run/)) return [Pl.lateral({ kind: "crossover" }), cod];
    if (has(/decel|braking/)) return [Pl.sprint({ then: "decel" }), ["quads", "glutes"]];
    if (has(/45/)) return [Pl.sprint({ then: "cut45" }), cod];
    if (has(/90 degree cut/)) return [Pl.sprint({ then: "cut90" }), cod];
    if (has(/180 degree cut/)) return [Pl.sprint({ then: "cut180" }), cod];
    if (has(/pivot/)) return [Pl.sprint({ then: "pivot" }), cod];
    return [Pl.sprint({ curve: has(/curvilinear/) }), ["quads", "hams", "glutes", "calves"]];
  }
  return null;
}

function upper(c: string, n: string, eq: string[]): R | null {
  const has = (re: RegExp) => re.test(n);
  const imp: Up.Imp = has(/smith/) ? "smith" : has(/barbell/) ? "bb" : has(/machine/) ? "machine" : has(/cable|rope/) ? "cable" : has(/band/) ? "band" : has(/\bkb\b|kettlebell/) ? "kb" : has(/\bdb\b|dumbbell/) || eq.includes("dumbbell") ? "db" : "bw";
  if (c === "hpress") {
    const m: Muscle[] = ["chest", "triceps", "delts"];
    if (has(/push-?up/)) return [Up.pushUp({ hands: has(/elevated/) ? "bench" : has(/smith/) ? "smith" : has(/deficit/) ? "deficit" : "floor", weighted: has(/weighted/) }), m];
    if (has(/machine press/)) return [Up.machinePress({ dir: "chest" }), m];
    return [Up.benchPress({ imp, floor: has(/floor/) }), m];
  }
  if (c === "hrow") {
    const m: Muscle[] = ["lats", "upperback", "biceps", "reardelt"];
    if (has(/trx/)) return [Up.row({ kind: "trx" }), m];
    if (has(/kneeling/)) return [Up.row({ kind: "halfKneelCable" }), m];
    if (has(/3 point/)) return [Up.row({ kind: "3pt" }), m];
    if (has(/seated cable/)) return [Up.row({ kind: "seatedCable" }), m];
    if (has(/machine row/)) return [Up.row({ kind: "machine" }), m];
    if (has(/incline/)) return [Up.row({ kind: "inclineDB" }), m];
    if (has(/inverted/)) return [Up.row({ kind: "inverted" }), m];
    if (has(/gorilla/)) return [Up.row({ kind: "gorilla" }), m];
    return [Up.row({ kind: "bent", imp }), m];
  }
  if (c === "vpress") {
    if (has(/incline machine/)) return [Up.machinePress({ dir: "incline" }), ["chest", "delts", "triceps"]];
    if (has(/overhead machine/)) return [Up.machinePress({ dir: "overhead" }), ["delts", "triceps"]];
    if (has(/incline/)) return [Up.overheadPress({ imp, incline: true }), ["chest", "delts", "triceps"]];
    if (has(/landmine/)) return [Up.overheadPress({ landmine: true }), ["delts", "chest", "triceps"]];
    return [Up.overheadPress({ imp, seated: has(/seated/), halfKneel: has(/kneeling/) }), ["delts", "triceps", "traps"]];
  }
  if (c === "vpull") {
    const m: Muscle[] = ["lats", "biceps", "upperback"];
    if (has(/pull-?up|chin-?up/)) return [Up.pullUp({ chin: has(/chin/), assisted: has(/assisted/) }), m];
    return [Up.pulldown({ grip: has(/close/) ? "close" : "wide", halfKneel: has(/kneeling/), alternating: has(/alternating/) }), m];
  }
  if (c === "arms") {
    if (has(/skull/)) return [Up.benchPress({ skull: true }), ["triceps"]];
    if (has(/pushdown/)) return [Up.triceps({ kind: "pushdown" }), ["triceps"]];
    if (has(/overhead tricep/)) return [Up.triceps({ kind: has(/cable/) ? "overheadCable" : "overheadDB" }), ["triceps"]];
    return [Up.curl({ imp: imp === "cable" ? "cable" : imp === "bb" ? "bb" : "db", incline: has(/incline/), single: has(/single arm/) }), ["biceps", "forearms"]];
  }
  if (c === "forearm") {
    return [Up.wrist({ kind: has(/pronation/) ? "prosup" : has(/radial/) ? "radial" : has(/extension/) ? "ext" : "flex", band: has(/band/) }), ["forearms"]];
  }
  if (c === "shoulder") {
    if (has(/dips/)) return [Up.dips({ machine: has(/machine/), weighted: has(/weighted/) }), ["triceps", "chest", "delts"]];
    if (has(/reverse.*fly|reverse db fly/)) return [Up.fly({ kind: has(/machine/) ? "reverseMachine" : has(/chest supported/) ? "reverseChest" : "reverseBent" }), ["reardelt", "upperback"]];
    if (has(/fly/)) return [Up.fly({ kind: has(/machine/) ? "machine" : has(/incline/) ? "incline" : "flat" }), ["chest", "delts"]];
    if (has(/lateral raise/)) return [Up.raise({ kind: "lateral", band: has(/band/) }), ["delts"]];
    if (has(/forward raise/)) return [Up.raise({ kind: "forward" }), ["delts"]];
    if (has(/scaption/)) return [Up.raise({ kind: "scaption", band: has(/band/) }), ["delts", "rotcuff"]];
    if (has(/face pull/)) return [Up.facePull({ band: has(/band/) }), ["reardelt", "upperback", "rotcuff"]];
    if (has(/pull aparts?/)) return [Up.pullApart(), ["reardelt", "upperback"]];
    const mode = has(/\bir\b|internal/) ? "ir" : "er";
    const setup = has(/sidelying/) ? "sidelying" : has(/elbow on knee/) ? "knee" : has(/90\/90/) ? (has(/elbow supported/) ? "9090side" : "9090") : "side";
    const rimp: Up.Imp = has(/cable/) ? "cable" : has(/band/) ? "band" : "db";
    return [Up.rotation({ mode, setup, imp: rimp }), ["rotcuff", "reardelt"]];
  }
  return null;
}

function core(c: string, n: string): R | null {
  const has = (re: RegExp) => re.test(n);
  if (c === "rom") {
    if (has(/cervical/)) return [Re.cervical({ kind: has(/rotation/) ? "rotation" : has(/sidebend/) ? "sidebend" : has(/extension/) ? "extension" : "flexion" }), ["neck"]];
    if (has(/elbow/)) return [Re.supineRom({ kind: "elbow" }), ["biceps", "triceps"]];
    if (has(/cat/)) return [Re.catCow(), ["lowback", "abs"]];
    if (has(/open book/)) return [Re.openBook(), ["obliques", "chest", "upperback"]];
    if (has(/thoracic/)) return [Re.thoracicRotation(), ["obliques", "upperback"]];
    if (has(/abduction/)) return [Re.dowelAbduction(), ["delts", "rotcuff"]];
    const imp = has(/dowel/) ? "dowel" : has(/kb/) ? "kb" : has(/weight/) ? "db" : "none";
    if (has(/flexion/)) return [Re.supineRom({ kind: "flexion", imp, single: has(/single arm/), offBench: has(/off bench/) }), ["lats", "delts"]];
    if (has(/internal/)) return [Re.supineRom({ kind: "ir9090", imp }), ["rotcuff"]];
    if (has(/90\/90/)) return [Re.supineRom({ kind: "er9090", imp }), ["rotcuff"]];
    if (has(/external/)) return [Re.supineRom({ kind: has(/dowel/) ? "er" : "er9090", imp, extra: has(/extra/) }), ["rotcuff"]];
  }
  if (c === "iso") {
    if (has(/cervical/)) return [Re.cervical({ kind: has(/rotation/) ? "rotation" : has(/side bend/) ? "sidebend" : has(/extension/) ? "extension" : "flexion", iso: true }), ["neck"]];
    const kind = has(/internal/) ? "ir" : has(/flexion/) ? "flex" : has(/extension/) ? "ext" : "er";
    const via = has(/miniband/) ? "miniband" : has(/wall/) ? "wall" : has(/cable/) ? "cable" : "band";
    return [Re.shoulderIso({ kind, via }), kind === "flex" ? ["delts"] : kind === "ext" ? ["reardelt", "triceps"] : ["rotcuff", "reardelt"]];
  }
  if (c === "medball") {
    const kind = has(/underhand scoop/) ? "scoopWall" : has(/overhead taps/) ? "overheadTap" : has(/chest pass/) ? "chestPass" : has(/rotational medicine ball slam/) ? "rotSlam"
      : has(/slam/) ? "slam" : has(/rotational/) ? "rotThrow" : has(/hammer/) ? "hammer" : "scoop";
    const m: Record<string, Muscle[]> = { scoopWall: ["glutes", "quads", "delts"], overheadTap: ["delts", "triceps", "abs"], chestPass: ["chest", "triceps"], slam: ["abs", "lats", "delts"], rotSlam: ["obliques", "abs", "lats"], rotThrow: ["obliques", "glutes"], scoop: ["obliques", "glutes"], hammer: ["obliques", "lats", "abs"] };
    return [Co.medBall({ kind }), m[kind]];
  }
  if (c === "plank") {
    if (has(/side bend/)) return [Co.sideBend({ roman: true, iso: true, weighted: has(/weighted/) }), ["obliques"]];
    if (has(/side plank/)) return [Co.sidePlanks({ short: has(/bent knee/), thruster: has(/thruster/) }), ["obliques", "abductors"]];
    return [Co.plank({ kind: has(/forearm/) ? "forearm" : has(/elevated/) ? "elevated" : "tall" }), ["abs", "obliques"]];
  }
  if (c === "sidebend") {
    if (has(/roman chair/)) return [Co.sideBend({ roman: true, weighted: has(/weighted/) }), ["obliques"]];
    const arms: Co.SideArms = has(/smith/) ? "smith" : has(/cable/) ? "cable" : has(/dumbbell/) ? (has(/behind head/) ? "dbHead" : "db") : has(/behind head/) ? "head" : has(/overhead/) ? "overhead" : "side";
    return [Co.sideBend({ arms, straddle: has(/straddle/), kick: has(/side kick/) }), has(/side kick/) ? ["obliques", "abductors"] : ["obliques"]];
  }
  if (c === "flexpelvis") {
    if (has(/deadbug/)) return [Co.deadbug({ straight: has(/straight/), weighted: has(/weighted/) }), ["abs", "hipflex"]];
    const kind = has(/garhammer/) ? "garhammer" : has(/straight|weighted leg/) ? "straight" : "tuck";
    if (has(/incline/)) return [Co.legRaise({ rig: "incline", kind: "tuck" }), ["abs", "hipflex"]];
    return [Co.legRaise({ rig: has(/hanging/) ? "hang" : "chair", kind, weighted: has(/weighted/) }), ["abs", "hipflex"]];
  }
  if (c === "flexrib") {
    const kind = has(/cable crunch/) ? "cable" : has(/rope/) ? "rope" : has(/decline.*weighted/) ? "declineWeighted" : has(/decline/) ? "decline" : has(/off bench/) ? "offBench" : has(/ghd/) ? "ghd" : "floor";
    return [Co.crunch({ kind }), ["abs"]];
  }
  if (c === "rotation") {
    const stance = has(/anchor/) ? "bentAnchor" : has(/bent over/) ? "bent" : has(/kneeling/) ? "halfKneel" : "stand";
    return [Co.cableRotation({ stance }), ["obliques", "abs"]];
  }
  return null;
}

function rehab(c: string, n: string): R | null {
  const has = (re: RegExp) => re.test(n);
  if (c === "knee_flex") {
    if (has(/biking|bike/)) return [Lo.bike(), ["quads", "hams", "calves"]];
    if (has(/half kneeling/)) return [Lo.rockBack({ halfKneel: true }), ["quads"]];
    if (has(/rock back/)) return [Lo.rockBack(), ["quads", "glutes"]];
    return [Lo.heelSlide({ wall: has(/wall/), strap: has(/strap/) }), ["hams", "quads"]];
  }
  if (c === "knee_ext") {
    if (has(/tke/)) return [Lo.tke(), ["quads"]];
    if (has(/prone/)) return [Lo.proneKneeExt(), ["hams", "calves"]];
    return [Lo.heelProp(), ["hams", "calves"]];
  }
  if (c === "quad_start") {
    if (has(/quad sets/)) return [Lo.quadSet({ kind: "set" }), ["quads"]];
    if (has(/short arc/)) return [Lo.quadSet({ kind: "short" }), ["quads"]];
    if (has(/long arc/)) return [Lo.quadSet({ kind: "long" }), ["quads"]];
    if (has(/physio ball/)) return [Lo.quadSet({ kind: "ball" }), ["quads"]];
    if (has(/machine/)) return [Lo.quadSet({ kind: "machine" }), ["quads"]];
    return [Lo.quadSet({ kind: "slr" }), ["quads", "hipflex"]];
  }
  if (c === "gait") {
    if (has(/crutch walking/)) return [Lo.marching({ crutches: 2, walk: true }), ["triceps", "lats", "quads"]];
    if (has(/2 crutch/)) return [Lo.marching({ crutches: 2 }), ["hipflex", "quads"]];
    if (has(/1 crutch/)) return [Lo.marching({ crutches: 1 }), ["hipflex", "quads"]];
    return [Lo.marching(), ["hipflex", "quads"]];
  }
  if (c === "rehab_other") {
    if (has(/bridge/)) return [Lo.bridge(), ["glutes", "hams"]];
    if (has(/heel raise/)) return [Lo.heelRaise(), ["calves"]];
    if (has(/abduction/)) return [Lo.sidelyingAbduction(), ["abductors"]];
    if (has(/adduction/)) return [Lo.supineAdductionIso(), ["adductors"]];
  }
  return null;
}

/** Fallback by category when no rule matched (custom exercises). */
function byCategory(c: string): R {
  switch (c) {
    case "squat": return [Lo.squat(), ["quads", "glutes"]];
    case "hinge": return [Lo.rdl({ load: "db" }), ["hams", "glutes"]];
    case "quad": return [Lo.legExtension(), ["quads"]];
    case "hamstring": return [Lo.hamCurlMachine(), ["hams"]];
    case "adductor": return [Lo.hipMachine({ add: true }), ["adductors"]];
    case "abductor": return [Lo.hipMachine(), ["abductors"]];
    case "calf": return [Lo.heelRaise(), ["calves"]];
    case "plyo": return [Pl.cmj(), ["quads", "glutes", "calves"]];
    case "cod": return [Pl.lateral({ kind: "shuffle" }), ["quads", "glutes", "adductors"]];
    case "hpress": return [Up.pushUp(), ["chest", "triceps"]];
    case "hrow": return [Up.row({ kind: "bent" }), ["lats", "upperback"]];
    case "vpress": return [Up.overheadPress(), ["delts", "triceps"]];
    case "vpull": return [Up.pulldown(), ["lats", "biceps"]];
    case "arms": return [Up.curl(), ["biceps"]];
    case "forearm": return [Up.wrist({ kind: "flex" }), ["forearms"]];
    case "shoulder": return [Up.raise({ kind: "lateral" }), ["delts"]];
    case "medball": return [Co.medBall({ kind: "chestPass" }), ["chest", "triceps"]];
    case "plank": return [Co.plank({ kind: "forearm" }), ["abs"]];
    case "sidebend": return [Co.sideBend(), ["obliques"]];
    case "flexpelvis": return [Co.deadbug(), ["abs"]];
    case "flexrib": return [Co.crunch({ kind: "floor" }), ["abs"]];
    case "rotation": return [Co.cableRotation({ stance: "stand" }), ["obliques"]];
    case "knee_flex": return [Lo.heelSlide(), ["hams"]];
    case "knee_ext": return [Lo.tke(), ["quads"]];
    case "quad_start": return [Lo.quadSet({ kind: "set" }), ["quads"]];
    case "gait": return [Lo.marching(), ["hipflex"]];
    case "rom": return [Re.catCow(), ["lowback"]];
    case "iso": return [Re.shoulderIso({ kind: "er", via: "wall" }), ["rotcuff"]];
    default: return [Lo.squat(), ["quads", "glutes"]];
  }
}

const cache = new Map<string, Anim>();
export function animFor(ex: ExLike): Anim {
  const key = `${ex.category}|${ex.name_en}|${(ex.equipment ?? []).join(",")}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = ex.name_en.toLowerCase().replace(/’/g, "'");
  const c = ex.category;
  const eq = ex.equipment ?? [];
  const r = lower(c, n, eq) ?? plyo(c, n) ?? upper(c, n, eq) ?? core(c, n) ?? rehab(c, n) ?? byCategory(c);
  const anim = { pattern: r[0], muscles: r[1] };
  cache.set(key, anim);
  return anim;
}

/** Muscle labels for the legend. */
export const MUSCLE_LABEL: Record<Muscle, { en: string; he: string }> = {
  quads: { en: "Quads", he: "ארבע ראשי" }, hams: { en: "Hamstrings", he: "המסטרינג" }, glutes: { en: "Glutes", he: "ישבן" },
  abductors: { en: "Hip abductors", he: "מרחיקי ירך" }, adductors: { en: "Adductors", he: "מקרבי ירך" }, hipflex: { en: "Hip flexors", he: "כופפי ירך" },
  calves: { en: "Calves", he: "שוקיים" }, tibialis: { en: "Shin", he: "שוק קדמית" }, abs: { en: "Abs", he: "בטן" }, obliques: { en: "Obliques", he: "אלכסוניים" },
  lowback: { en: "Lower back", he: "גב תחתון" }, lats: { en: "Lats", he: "רחב גבי" }, upperback: { en: "Upper back", he: "גב עליון" }, traps: { en: "Traps", he: "טרפז" },
  chest: { en: "Chest", he: "חזה" }, delts: { en: "Shoulders", he: "כתפיים" }, reardelt: { en: "Rear delts", he: "כתף אחורית" }, rotcuff: { en: "Rotator cuff", he: "שרוול מסובבים" },
  biceps: { en: "Biceps", he: "יד קדמית" }, triceps: { en: "Triceps", he: "יד אחורית" }, forearms: { en: "Forearms", he: "אמות" }, neck: { en: "Neck", he: "צוואר" },
};
