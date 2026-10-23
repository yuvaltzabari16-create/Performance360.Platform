"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FIELD_KEYS, FIELD_TONES, fieldDisplay, fieldEditValue, parseField, type ExercisePatch, type FieldKey,
} from "@/lib/builder-fields";
import { SESSION_SECTIONS, type SessionSection } from "@/lib/catalog";
import type { Dictionary } from "@/lib/i18n";
import type { SessionExercise } from "@/lib/types";
import { cx } from "@/components/ui";
import { AutosaveStatus } from "@/components/autosave/AutosaveStatus";
import type { AutosaveStatus as SaveState } from "@/lib/autosave/useAutosave";
import { AiPanel } from "./AiPanel";
import { addExerciseToSession, duplicateExercise, patchExerciseField, removeExercise, swapExercises } from "../builder-actions";

export interface LibraryExercise { id: string; name: string; category: string; thumb: string | null }

interface Props {
  programId: string;
  session: { id: string; title: string };
  exercises: SessionExercise[];
  library: LibraryExercise[];
  tt: Dictionary["training"];
  categories: Record<string, string>;
  labels: { remove: string; search: string };
}

const hideBroken = (ev: React.SyntheticEvent<HTMLImageElement>) => { ev.currentTarget.style.visibility = "hidden"; };
const sectionOf = (e: SessionExercise) => e.section as SessionSection;
const letter = (i: number) => String.fromCharCode(65 + (i % 26));

export function Builder({ programId, session, exercises, library, tt, categories, labels }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [items, setItems] = useState<SessionExercise[]>(exercises);
  const [extraBlocks, setExtraBlocks] = useState<SessionSection[]>([]);
  const [activeSection, setActiveSection] = useState<SessionSection | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; key: FieldKey } | null>(null);
  const [fieldMenu, setFieldMenu] = useState<string | null>(null);
  const [blockMenu, setBlockMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const b = tt.builder;

  useEffect(() => setItems(exercises), [exercises]);
  useEffect(() => { if (!error) return; const id = setTimeout(() => setError(null), 4000); return () => clearTimeout(id); }, [error]);

  const thumbOf = useMemo(() => new Map(library.map((l) => [l.id, l.thumb])), [library]);

  // Blocks follow the order of their first exercise; empty blocks the coach just created come last.
  const blocks = useMemo(() => {
    const sorted = [...items].sort((x, y) => x.position - y.position);
    const order: SessionSection[] = [];
    sorted.forEach((e) => { if (!order.includes(sectionOf(e))) order.push(sectionOf(e)); });
    extraBlocks.forEach((s) => { if (!order.includes(s)) order.push(s); });
    return order.map((section) => ({ section, items: sorted.filter((e) => sectionOf(e) === section) }));
  }, [items, extraBlocks]);

  const target: SessionSection = activeSection ?? blocks[0]?.section ?? "strength";

  /** Runs a save, reflecting progress in the status indicator; failures revert to the server state. */
  const run = (job: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setSaveState("saving");
      const r = await job();
      if (!r.ok) { setError(r.error ?? b.saveFailed); setSaveState("error"); router.refresh(); }
      else setSaveState("saved");
    });

  const commit = (id: string, key: FieldKey, value: string) => {
    setEditing(null);
    const current = items.find((e) => e.id === id);
    if (!current) return;
    if (value.trim() === fieldEditValue(current, key).trim()) return;
    const parsed = parseField(key, value);
    if (!parsed.ok) { setError(b.invalidValue); return; }
    setItems((prev) => prev.map((e) => (e.id === id ? { ...e, ...parsed.patch } : e)));
    run(() => patchExerciseField({ id, programId, field: key, value }));
  };

  const addFromLibrary = (ex: LibraryExercise) => {
    setActiveSection(target);
    run(() => addExerciseToSession({ sessionId: session.id, programId, section: target, exerciseId: ex.id }));
  };
  const addCustom = (name: string) => {
    if (!name.trim()) return;
    run(() => addExerciseToSession({ sessionId: session.id, programId, section: target, name }));
  };
  const remove = (id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id));
    run(() => removeExercise({ id, programId }));
  };
  const move = (a: SessionExercise, other: SessionExercise) => {
    setItems((prev) => prev.map((e) => (e.id === a.id ? { ...e, position: other.position } : e.id === other.id ? { ...e, position: a.position } : e)));
    run(() => swapExercises({ a: a.id, b: other.id, programId }));
  };

  const addBlock = (section: SessionSection) => {
    setBlockMenu(false);
    setExtraBlocks((prev) => (prev.includes(section) ? prev : [...prev, section]));
    setActiveSection(section);
    setLibraryOpen(true);
  };

  const jump = (section: string) => document.getElementById(`blk-${section}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0 space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-3 text-xs text-muted">{b.clickToEdit}<AutosaveStatus status={saveState} labels={{ saving: b.autosaving, saved: b.autosaved, failed: b.autosaveFailed }} /></p>
          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setAiOpen((v) => !v); setLibraryOpen(false); }}
            aria-expanded={aiOpen}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <span aria-hidden>✦</span> {b.ai.button}
          </button>
          <button
            type="button"
            onClick={() => { setLibraryOpen((v) => !v); setAiOpen(false); }}
            aria-expanded={libraryOpen}
            className={cx("inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
              libraryOpen ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink hover:border-brand-300")}
          >
            <span aria-hidden>▤</span> {b.library}
          </button>
          </div>
        </div>

        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        {blocks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-muted">{b.emptySession}</div>
        )}

        {blocks.map((blk) => {
          const isActive = blk.section === target;
          return (
            <section
              key={blk.section}
              id={`blk-${blk.section}`}
              className={cx("scroll-mt-24 rounded-2xl border bg-surface", isActive ? "border-brand-300 ring-1 ring-brand-200" : "border-line")}
              onClick={() => setActiveSection(blk.section)}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden>
                    {blocks.indexOf(blk) + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-ink">{tt.sections[blk.section]}</h3>
                  <span className="text-xs text-muted">{blk.items.length} {blk.items.length === 1 ? b.exerciseOne : b.exerciseMany}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActiveSection(blk.section); setLibraryOpen(true); }}
                  className="rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  aria-label={`${tt.addExercise}: ${tt.sections[blk.section]}`}
                >
                  + {tt.addExercise}
                </button>
              </header>

              {blk.items.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">{b.emptyBlock}</p>
              ) : (
                <ol className="space-y-2 p-3">
                  {blk.items.map((e, i) => (
                    <li key={e.id} className="rounded-xl border border-line bg-canvas/60">
                      <div className="flex items-start gap-3 p-3">
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-xs font-semibold text-ink-soft" aria-hidden>{letter(i)}</span>
                        {e.exercise_id && thumbOf.get(e.exercise_id) && (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- remote video thumbnail */}
                            <img src={thumbOf.get(e.exercise_id)!} alt="" loading="lazy" onError={hideBroken} className="hidden aspect-video w-16 shrink-0 rounded-md bg-line object-cover sm:block" />
                          </>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            {e.exercise_id
                              ? <Link href={`/exercises/${e.exercise_id}`} className="font-medium text-ink hover:text-brand-700"><bdi>{e.exercise_name}</bdi></Link>
                              : <bdi className="font-medium text-ink">{e.exercise_name}</bdi>}
                            <div className="no-print flex shrink-0 items-center">
                              <IconButton label={tt.moveUp} disabled={i === 0} onClick={() => move(e, blk.items[i - 1])}>↑</IconButton>
                              <IconButton label={tt.moveDown} disabled={i === blk.items.length - 1} onClick={() => move(e, blk.items[i + 1])}>↓</IconButton>
                              <IconButton label={b.duplicate} onClick={() => run(() => duplicateExercise({ id: e.id, programId }))}>⧉</IconButton>
                              <IconButton label={labels.remove} danger onClick={() => remove(e.id)}>×</IconButton>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {FIELD_KEYS.map((key) => {
                              const isEditing = editing?.id === e.id && editing.key === key;
                              const display = fieldDisplay(e as ExercisePatch, key);
                              if (!display && !isEditing) return null;
                              return isEditing ? (
                                <ChipEditor key={key} fieldKey={key} label={b.fields[key]} placeholder={b.placeholders[key]} initial={fieldEditValue(e as ExercisePatch, key)}
                                  onDone={(v) => commit(e.id, key, v)} onCancel={() => setEditing(null)} />
                              ) : (
                                <span key={key} className={cx("group/chip num inline-flex items-center gap-1.5 rounded-lg border text-xs", FIELD_TONES[key])}>
                                  <button type="button" onClick={() => setEditing({ id: e.id, key })} className="inline-flex items-center gap-1.5 rounded-lg py-1 ps-2 pe-1 focus-visible:outline-2 focus-visible:outline-brand-600">
                                    <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{b.fields[key]}</span>
                                    <span className="text-[13px] font-semibold">{display}</span>
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`${b.removeField}: ${b.fields[key]}`}
                                    onClick={() => commit(e.id, key, "")}
                                    className="me-1 rounded px-1 text-[11px] opacity-0 transition-opacity hover:bg-black/10 focus-visible:opacity-100 group-hover/chip:opacity-70"
                                  >×</button>
                                </span>
                              );
                            })}
                            <FieldMenu
                              open={fieldMenu === e.id}
                              onToggle={() => setFieldMenu((cur) => (cur === e.id ? null : e.id))}
                              available={FIELD_KEYS.filter((k) => fieldDisplay(e as ExercisePatch, k) == null)}
                              labels={b.fields}
                              addLabel={b.addField}
                              searchLabel={b.searchFields}
                              emptyLabel={b.noFields}
                              onPick={(k) => { setFieldMenu(null); setEditing({ id: e.id, key: k }); }}
                            />
                          </div>
                          {(e.cues || e.modifications) && <p className="mt-2 text-xs text-muted">{[e.cues, e.modifications].filter(Boolean).join(" · ")}</p>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={(ev) => { ev.stopPropagation(); setActiveSection(blk.section); setLibraryOpen(true); }}
                  className="no-print w-full rounded-xl border border-dashed border-line py-2.5 text-sm text-muted transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  + {tt.addExercise}
                </button>
              </div>
            </section>
          );
        })}

        <div className="no-print relative">
          <button
            type="button"
            onClick={() => setBlockMenu((v) => !v)}
            aria-expanded={blockMenu}
            className="w-full rounded-2xl border border-dashed border-line py-3 text-sm font-medium text-muted transition-colors hover:border-brand-300 hover:text-brand-700"
          >
            + {b.addBlock}
          </button>
          {blockMenu && (
            <div role="menu" aria-label={b.chooseBlockType} className="absolute inset-x-0 bottom-full z-20 mb-2 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg sm:grid-cols-3">
              {SESSION_SECTIONS.map((s) => (
                <button key={s} role="menuitem" type="button" onClick={() => addBlock(s)} className="rounded-lg px-3 py-2 text-start text-sm hover:bg-brand-50">
                  {tt.sections[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workout structure navigator */}
      <aside className="no-print hidden xl:block">
        <div className="sticky top-4 rounded-2xl border border-line bg-surface p-3">
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">{b.workoutStructure}</h3>
          <ol className="space-y-1">
            {blocks.map((blk, i) => (
              <li key={blk.section}>
                <button
                  type="button"
                  onClick={() => jump(blk.section)}
                  className={cx("flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start hover:bg-canvas", blk.section === target && "bg-brand-50")}
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-800">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{tt.sections[blk.section]}</span>
                    <span className="block text-xs text-muted">{blk.items.length} {blk.items.length === 1 ? b.exerciseOne : b.exerciseMany}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      {aiOpen && (
        <AiPanel programId={programId} sessionId={session.id} tt={tt} onClose={() => setAiOpen(false)} onApplied={() => { setAiOpen(false); setSaveState("saved"); router.refresh(); }} />
      )}

      {libraryOpen && (
        <LibraryPanel
          library={library}
          categories={categories}
          title={b.library}
          addingTo={`${b.addingTo}: ${tt.sections[target]}`}
          labels={{ search: b.searchExercises, all: b.allCategories, none: b.noResults, add: b.add, custom: b.customName, close: b.closeLibrary }}
          onAdd={addFromLibrary}
          onAddCustom={addCustom}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </div>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx("rounded px-1.5 py-0.5 text-sm text-muted transition-colors disabled:opacity-30", danger ? "hover:bg-red-50 hover:text-red-700" : "hover:bg-canvas hover:text-ink")}
    >
      {children}
    </button>
  );
}

function ChipEditor({ fieldKey, label, placeholder, initial, onDone, onCancel }: {
  fieldKey: FieldKey; label: string; placeholder: string; initial: string; onDone: (v: string) => void; onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (v: string | null) => {
    if (done.current) return;
    done.current = true;
    if (v == null) onCancel(); else onDone(v);
  };
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs", FIELD_TONES[fieldKey])}>
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</span>
      <input
        autoFocus
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(ev) => setValue(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); finish(value); }
          if (ev.key === "Escape") { ev.preventDefault(); finish(null); }
        }}
        onBlur={() => finish(value)}
        size={Math.max(6, Math.min(18, value.length + 2))}
        className="num min-w-0 rounded bg-white/80 px-1.5 py-0.5 text-[13px] font-semibold text-ink outline-none ring-1 ring-brand-400 focus:ring-2"
      />
    </span>
  );
}

function FieldMenu({ open, onToggle, available, labels, addLabel, searchLabel, emptyLabel, onPick }: {
  open: boolean; onToggle: () => void; available: FieldKey[]; labels: Record<FieldKey, string>; addLabel: string; searchLabel: string; emptyLabel: string; onPick: (k: FieldKey) => void;
}) {
  const [q, setQ] = useState("");
  const list = available.filter((k) => labels[k].toLowerCase().includes(q.trim().toLowerCase()));
  if (available.length === 0) return null;
  return (
    <span className="no-print relative">
      <button
        type="button"
        onClick={() => { setQ(""); onToggle(); }}
        aria-expanded={open}
        className="rounded-lg border border-dashed border-line px-2 py-1 text-xs text-muted transition-colors hover:border-brand-300 hover:text-brand-700"
      >
        + {addLabel}
      </button>
      {open && (
        <div className="absolute start-0 top-full z-20 mt-1 w-52 rounded-xl border border-line bg-surface p-2 shadow-lg">
          <input
            autoFocus
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            onKeyDown={(ev) => { if (ev.key === "Escape") onToggle(); if (ev.key === "Enter" && list[0]) onPick(list[0]); }}
            className="mb-1 w-full rounded-lg border border-brand-300 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-200"
          />
          <ul role="menu">
            {list.length === 0 && <li className="px-2 py-1.5 text-sm text-muted">{emptyLabel}</li>}
            {list.map((k) => (
              <li key={k}>
                <button type="button" role="menuitem" onClick={() => onPick(k)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-canvas">
                  <span className={cx("size-2.5 rounded-full border", FIELD_TONES[k])} aria-hidden />
                  {labels[k]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </span>
  );
}

function LibraryPanel({ library, categories, title, addingTo, labels, onAdd, onAddCustom, onClose }: {
  library: LibraryExercise[]; categories: Record<string, string>; title: string; addingTo: string;
  labels: { search: string; all: string; none: string; add: string; custom: string; close: string };
  onAdd: (e: LibraryExercise) => void; onAddCustom: (name: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [custom, setCustom] = useState("");
  const cats = useMemo(() => [...new Set(library.map((l) => l.category))].sort(), [library]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return library.filter((l) => (!cat || l.category === cat) && (!needle || l.name.toLowerCase().includes(needle))).slice(0, 60);
  }, [library, q, cat]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="no-print fixed inset-y-0 end-0 z-40 flex w-full max-w-md flex-col border-s border-line bg-surface shadow-2xl" role="dialog" aria-label={title}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <p className="text-xs text-brand-700">{addingTo}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={labels.close} className="rounded-lg px-2 py-1 text-lg text-muted hover:bg-canvas">×</button>
      </div>
      <div className="space-y-3 border-b border-line p-3">
        <input
          autoFocus
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <div className="flex flex-wrap gap-1.5">
          <Pill active={cat === ""} onClick={() => setCat("")}>{labels.all}</Pill>
          {cats.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{categories[c] ?? c}</Pill>)}
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
        {shown.length === 0 && <li className="col-span-2 py-6 text-center text-sm text-muted">{labels.none}</li>}
        {shown.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => onAdd(l)} className="group flex h-full w-full flex-col overflow-hidden rounded-xl border border-line bg-surface text-start transition-colors hover:border-brand-400">
              <span className="relative block aspect-video bg-canvas">
                {l.thumb && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote video thumbnail */}
                    <img src={l.thumb} alt="" loading="lazy" onError={hideBroken} className="size-full object-cover" />
                  </>
                )}
                <span className="absolute end-1.5 top-1.5 rounded-md bg-brand-600 px-1.5 py-0.5 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">+ {labels.add}</span>
              </span>
              <span className="p-2 text-xs font-medium leading-snug text-ink"><bdi>{l.name}</bdi></span>
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(ev) => { ev.preventDefault(); onAddCustom(custom); setCustom(""); }}
      >
        <input
          value={custom}
          onChange={(ev) => setCustom(ev.target.value)}
          placeholder={labels.custom}
          aria-label={labels.custom}
          maxLength={160}
          className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">{labels.add}</button>
      </form>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx("rounded-full border px-2.5 py-1 text-xs transition-colors", active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-ink-soft hover:border-brand-300")}
    >
      {children}
    </button>
  );
}
