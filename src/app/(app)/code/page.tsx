import Link from "next/link";
import { Badge, Card, FlashMessage, PageHeader, Stat, Table, Td } from "@/components/ui";
import { ConfirmSubmit, CopyButton, ShareButton } from "@/components/ui/client";
import { requireProfessional } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { regenerateCode, revokeCode } from "./actions";

export const metadata = { title: "Personal Code" };

export default async function CodePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, t } = await requireProfessional();
  const [{ data: code }, { data: rels }] = await Promise.all([
    supabase.from("coach_codes").select("code, status, created_at").eq("coach_id", user.id).eq("status", "active").maybeSingle(),
    supabase
      .from("coach_athlete_relationships")
      .select("id, kind, source, started_at, athletes(id, full_name)")
      .eq("coach_id", user.id)
      .eq("status", "active")
      .in("source", ["code", "transfer"])
      .order("started_at", { ascending: false })
      .limit(100),
  ]);
  const link = code ? `${await siteUrl()}/join/${code.code}` : null;
  const tc = t.code;

  return (
    <>
      <PageHeader title={tc.title} subtitle={tc.subtitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={tc.yourCode} action={code && <Badge tone="green">{tc.statusActive}</Badge>}>
          {code && link ? (
            <div className="space-y-5">
              <div className="num rounded-xl border border-brand-200 bg-brand-50 px-6 py-5 text-center text-3xl font-semibold tracking-[0.2em] text-brand-800 sm:text-4xl">
                {code.code}
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={code.code} label={`${t.common.copy} ${tc.yourCode.toLowerCase()}`} copiedLabel={t.common.copied} />
                <CopyButton value={link} label={`${t.common.copy} ${tc.inviteLink.toLowerCase()}`} copiedLabel={t.common.copied} />
                <ShareButton title="Performance360" text={`${tc.shareText} ${code.code}`} url={link} label={t.common.share} fallbackLabel={t.common.copied} />
              </div>
              <div>
                <div className="text-xs text-muted">{tc.inviteLink}</div>
                <div className="num mt-1 break-all text-sm text-ink">{link}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">{tc.noCode}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
            <form action={regenerateCode}>
              <ConfirmSubmit variant="secondary" message={tc.regenerateConfirm}>{tc.regenerate}</ConfirmSubmit>
            </form>
            {code && (
              <form action={revokeCode}>
                <ConfirmSubmit variant="danger" message={tc.revokeConfirm}>{tc.revoke}</ConfirmSubmit>
              </form>
            )}
          </div>
        </Card>
        <Stat label={tc.connected} value={rels?.length ?? 0} />
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-ink">{tc.connected}</h2>
      {(rels ?? []).length === 0 ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <Table head={[t.common.name, t.common.status, tc.connectedOn]}>
          {(rels ?? []).map((r) => {
            const ath = r.athletes as unknown as { id: string; full_name: string } | null;
            return (
              <tr key={r.id}>
                <Td>{ath ? <Link className="font-medium hover:text-brand-700" href={`/athletes/${ath.id}`}>{ath.full_name}</Link> : "—"}</Td>
                <Td><Badge tone={r.kind === "primary" ? "green" : "blue"}>{r.kind === "primary" ? t.athletes.primary : t.athletes.collaborator}</Badge></Td>
                <Td><span className="num">{r.started_at.slice(0, 10)}</span></Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
