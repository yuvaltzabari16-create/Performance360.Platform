import { archiveSquad, createSquad, saveSquadCoaches } from "@/app/(app)/team/actions";
import { Button, Card, Field, Input } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import type { Dictionary } from "@/lib/i18n/en";

interface Props {
  t: Dictionary;
  squads: { id: string; name: string }[];
  coaches: { id: string; name: string }[];
  assigned: { squad_id: string; user_id: string }[];
  counts: (readonly [string, number])[];
  canManage: boolean;
}

/** Squads of the team: who coaches which squad. Managed by the director and the head of performance. */
export function SquadsCard({ t, squads, coaches, assigned, counts, canManage }: Props) {
  const ts = t.team.squads;
  const countOf = (id: string) => counts.find(([k]) => k === id)?.[1] ?? 0;
  return (
    <section className="mt-8" aria-label={ts.title} data-testid="squads">
      <h2 className="mb-3 text-sm font-semibold text-ink">{ts.title}</h2>
      <Card>
        <p className="mb-4 text-sm text-ink-soft">{ts.help}</p>
        {squads.length === 0 ? <p className="text-sm text-muted">{ts.none}</p> : (
          <ul className="divide-y divide-line">
            {squads.map((q) => (
              <li key={q.id} className="space-y-3 py-4 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><span className="font-medium"><bdi>{q.name}</bdi></span> <span className="ms-2 text-xs text-muted">{ts.athletes.replace("{n}", String(countOf(q.id)))}</span></div>
                  {canManage && (
                    <form action={archiveSquad}>
                      <input type="hidden" name="squad_id" value={q.id} />
                      <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs text-red-700" message={ts.archiveConfirm}>{ts.archive}</ConfirmSubmit>
                    </form>
                  )}
                </div>
                {coaches.length === 0 ? <p className="text-xs text-muted">{ts.noCoaches}</p> : canManage ? (
                  <form action={saveSquadCoaches} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <input type="hidden" name="squad_id" value={q.id} />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">{ts.coaches}</span>
                    {coaches.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 text-sm">
                        <input type="hidden" name="coach" value={c.id} />
                        <input type="checkbox" name="on" value={c.id} defaultChecked={assigned.some((a) => a.squad_id === q.id && a.user_id === c.id)} />
                        <bdi>{c.name}</bdi>
                      </label>
                    ))}
                    <SubmitButton variant="secondary" className="px-2.5 py-1.5 text-xs">{t.common.save}</SubmitButton>
                  </form>
                ) : (
                  <p className="text-sm text-ink-soft"><span className="text-xs font-medium uppercase tracking-wide text-muted">{ts.coaches}: </span><bdi>{coaches.filter((c) => assigned.some((a) => a.squad_id === q.id && a.user_id === c.id)).map((c) => c.name).join(", ") || "—"}</bdi></p>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <form action={createSquad} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <Field label={ts.name} className="min-w-48 flex-1"><Input name="name" maxLength={60} required /></Field>
            <Button type="submit">{ts.create}</Button>
          </form>
        )}
      </Card>
    </section>
  );
}
