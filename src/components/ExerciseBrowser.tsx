import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_REGION, categoryName, REGIONS } from "../lib/exercises";
import { useI18n } from "../lib/i18n";
import { exName, type Exercise } from "../lib/workout";
import { Thumb } from "./ExerciseMedia";

/** Search + filters + list/grid of exercises. Used by the library page and the planner's picker. */
export function ExerciseBrowser({ list, onSelect, compact = false, selectedId }: {
  list: Exercise[]; onSelect: (e: Exercise) => void; compact?: boolean; selectedId?: string | null;
}) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [cat, setCat] = useState("all");
  const [eq, setEq] = useState("all");

  const equipmentKeys = useMemo(() => [...new Set(list.flatMap((e) => e.equipment))].sort(), [list]);
  const cats = CATEGORIES.filter((c) => region === "all" || CATEGORY_REGION[c.key] === region);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((e) =>
      (region === "all" || e.region === region) &&
      (cat === "all" || e.category === cat) &&
      (eq === "all" || e.equipment.includes(eq)) &&
      (!needle || e.name_en.toLowerCase().includes(needle) || (e.name_he ?? "").includes(needle)));
  }, [list, q, region, cat, eq]);

  return (
    <div className="exbrowser">
      <div className="row">
        <input type="search" placeholder={t.searchExercises} value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 180px", width: "auto" }} aria-label={t.searchExercises} />
      </div>
      <div className="seg" role="group" aria-label={t.region.lower}>
        <button aria-pressed={region === "all"} onClick={() => { setRegion("all"); setCat("all"); }}>{t.allRegions}</button>
        {REGIONS.map((r) => <button key={r} aria-pressed={region === r} onClick={() => { setRegion(r); setCat("all"); }}>{t.region[r]}</button>)}
      </div>
      <div className="row">
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ flex: "1 1 160px", width: "auto" }} aria-label={t.category}>
          <option value="all">{t.allCategories}</option>
          {cats.map((c) => <option key={c.key} value={c.key}>{lang === "he" ? c.he : c.en}</option>)}
        </select>
        <select value={eq} onChange={(e) => setEq(e.target.value)} style={{ flex: "1 1 140px", width: "auto" }} aria-label={t.equipmentL}>
          <option value="all">{t.allEquipment}</option>
          {equipmentKeys.map((k) => <option key={k} value={k}>{t.equipment[k] ?? k}</option>)}
        </select>
      </div>
      <span className="muted" style={{ fontSize: 12 }}>{shown.length} {t.exercises}</span>
      <div className={compact ? "exlist" : "exgrid"}>
        {shown.map((e) => (
          <button key={e.id} className="excard" aria-current={selectedId === e.id ? "true" : undefined} onClick={() => onSelect(e)}>
            <Thumb ex={e} />
            <span className="exmeta">
              <span className="exname">{exName(e, lang)}</span>
              <span className="muted" style={{ fontSize: 11 }}>{categoryName(e.category, lang)}{e.club_id ? ` · ${t.clubExercise}` : ""}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
