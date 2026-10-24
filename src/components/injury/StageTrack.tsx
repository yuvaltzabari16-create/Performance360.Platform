import { cx } from "@/components/ui";
import { INJURY_STAGES, stageIndex, type InjuryStage } from "@/lib/injury";
import type { Dictionary } from "@/lib/i18n";

/** The six return-to-play stages as a track: done steps filled, the current one highlighted. */
export function StageTrack({ stage, t }: { stage: InjuryStage; t: Dictionary }) {
  const current = stageIndex(stage);
  return (
    <ol aria-label={t.injury.stageTrack} className="grid grid-cols-6 gap-1">
      {INJURY_STAGES.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined} title={t.injury.stageHelp[s]} className="min-w-0">
            <div
              className={cx(
                "h-2 rounded-full",
                state === "done" && "bg-brand-400",
                state === "current" && (s === "cleared" ? "bg-brand-600" : "bg-amber-400"),
                state === "todo" && "bg-line",
              )}
            />
            <div className={cx("mt-1.5 truncate text-[11px] leading-tight", state === "current" ? "font-semibold text-ink" : "text-muted")}>{t.injury.stages[s]}</div>
          </li>
        );
      })}
    </ol>
  );
}
