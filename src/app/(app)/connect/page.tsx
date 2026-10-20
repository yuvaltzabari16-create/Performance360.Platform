import { Badge, Button, ButtonLink, Card, Field, FlashMessage, Input, PageHeader } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/types";
import { endRelationship } from "../athletes/actions";
import { connectWithCode } from "./actions";

export const metadata = { title: "Connect to a coach" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  const tc = t.connect;
  if (profile.role !== "athlete") {
    return (
      <>
        <PageHeader title={tc.title} />
        <Card><p className="text-sm text-ink-soft">{tc.notAthlete}</p></Card>
      </>
    );
  }

  const code = (sp.code ?? "").toUpperCase().slice(0, 20);
  // Preview only reveals the coach's public name for an active code.
  const preview = /^P360-[A-Z0-9]{6}$/.test(code)
    ? ((await supabase.rpc("preview_coach_code", { p_code: code })).data as { coach_name: string; coach_role: UserRole }[] | null)?.[0]
    : undefined;

  const { data: me } = await supabase.from("athletes").select("id").eq("user_id", user.id).maybeSingle();
  const { data: rels } = me
    ? await supabase.from("coach_athlete_relationships").select("id, coach_id, kind, started_at").eq("athlete_id", me.id).eq("status", "active")
    : { data: [] };
  const ids = (rels ?? []).map((r) => r.coach_id);
  const { data: coaches } = ids.length ? await supabase.from("profiles").select("id, full_name, role").in("id", ids) : { data: [] };

  return (
    <>
      <PageHeader title={tc.title} subtitle={tc.subtitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={tc.codeLabel}>
          {preview ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-muted">{tc.confirmTitle}</div>
                <div className="mt-1 text-lg font-semibold text-ink">{preview.coach_name || "—"}</div>
                <div className="text-sm text-ink-soft">{t.roles[preview.coach_role]}</div>
              </div>
              {sp.transfer ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <div className="font-medium">{tc.transferTitle}</div>
                  <p className="mt-1">{tc.transferBody}</p>
                </div>
              ) : (
                <p className="text-sm text-ink-soft">{tc.confirmBody}</p>
              )}
              <form action={connectWithCode} className="flex gap-2">
                <input type="hidden" name="code" value={code} />
                {sp.transfer && <input type="hidden" name="confirm_transfer" value="1" />}
                <SubmitButton pendingText={t.common.loading}>{sp.transfer ? tc.transferBtn : tc.connectBtn}</SubmitButton>
                <ButtonLink href="/connect" variant="ghost">{t.common.cancel}</ButtonLink>
              </form>
            </div>
          ) : (
            <form action="/connect" className="space-y-3">
              {code && <p className="text-sm text-red-700">{tc.invalid}</p>}
              <Field label={tc.codeLabel}>
                <Input name="code" defaultValue={code} placeholder="P360-XXXXXX" autoCapitalize="characters" autoComplete="off" required pattern="[Pp]360-[A-Za-z0-9]{6}" className="num uppercase tracking-widest" />
              </Field>
              <Button type="submit">{tc.check}</Button>
            </form>
          )}
        </Card>

        <Card title={tc.myConnections}>
          {(rels ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t.dashboard.notConnected}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(rels ?? []).map((r) => {
                const c = coaches?.find((p) => p.id === r.coach_id);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{c?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted">{c?.role ? t.roles[c.role as UserRole] : ""} · {r.started_at.slice(0, 10)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={r.kind === "primary" ? "green" : "blue"}>{r.kind === "primary" ? t.athletes.primary : t.athletes.collaborator}</Badge>
                      <form action={endRelationship}>
                        <input type="hidden" name="relationship_id" value={r.id} />
                        <input type="hidden" name="back" value="/connect" />
                        <ConfirmSubmit variant="ghost" className="px-2 py-1 text-xs" message={t.athletes.endConfirm}>{t.athletes.endConnection}</ConfirmSubmit>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
