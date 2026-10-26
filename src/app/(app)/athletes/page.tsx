import Link from "next/link";
import { Badge, ButtonLink, EmptyState, FlashMessage, Input, PageHeader, Select, Table, Td, Avatar } from "@/components/ui";
import { requireSection } from "@/lib/auth";
import { ageFromDob } from "@/lib/metrics";
import { containsPattern, sanitizeSearchTerm } from "@/lib/security/query";
import { missingGuardianConsent } from "@/lib/minors";
import type { Athlete } from "@/lib/types";

export const metadata = { title: "Athletes" };

const PAGE_SIZE = 50;

export default async function AthletesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, org, t } = await requireSection("athletes");
  const readOnly = org?.org_role === "director"; // the director reads the roster; coaches manage it
  const status = sp.status === "archived" ? "archived" : "active";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sport = (sp.sport ?? "").slice(0, 80);
  const team = (sp.team ?? "").slice(0, 120);
  const sort = sp.sort === "recent" ? "recent" : "name";
  const page = Math.max(1, Number(sp.page) || 1);

  let query = supabase
    .from("athletes")
    .select("id, full_name, email, sport, team_name, position, date_of_birth, guardian_consent_at, status, user_id, competitive_level, updated_at", { count: "exact" })
    .eq("status", status);
  if (q) {
    // Only plain text reaches the filter string: PostgREST syntax and LIKE wildcards are stripped/escaped.
    const safe = containsPattern(sanitizeSearchTerm(q));
    if (safe !== "%%") query = query.or(`full_name.ilike.${safe},sport.ilike.${safe},team_name.ilike.${safe},position.ilike.${safe},email.ilike.${safe}`);
  }
  if (sport) query = query.eq("sport", sport);
  if (team) query = query.eq("team_name", team);
  query = sort === "recent" ? query.order("updated_at", { ascending: false }) : query.order("full_name");
  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const athletes = (data ?? []) as Athlete[];

  // Facet values for filters, from the coach's own accessible records.
  const { data: facets } = await supabase.from("athletes").select("sport, team_name").eq("status", status).limit(1000);
  const sports = [...new Set((facets ?? []).map((f) => f.sport).filter(Boolean))].sort() as string[];
  const teams = [...new Set((facets ?? []).map((f) => f.team_name).filter(Boolean))].sort() as string[];
  const total = count ?? 0;
  const hasFilters = Boolean(q || sport || team);

  const qs = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q, sport, team, status, sort, ...overrides } as Record<string, string | number | undefined>;
    Object.entries(merged).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
    return `/athletes?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title={t.athletes.title}
        actions={
          !readOnly ? (
            <>
              <ButtonLink href="/export/athletes" variant="secondary" prefetch={false}>{t.common.exportCsv}</ButtonLink>
              <ButtonLink href="/code" variant="secondary">{t.nav.code}</ButtonLink>
              <ButtonLink href="/athletes/new">{t.athletes.add}</ButtonLink>
            </>
          ) : (
            <ButtonLink href="/export/athletes" variant="secondary" prefetch={false}>{t.common.exportCsv}</ButtonLink>
          )
        }
      />
      <FlashMessage error={sp.error} ok={sp.ok} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]" action="/athletes">
        <Input name="q" defaultValue={q} placeholder={t.athletes.searchPlaceholder} aria-label={t.common.search} />
        <Select name="sport" defaultValue={sport} aria-label={t.athletes.sport}>
          <option value="">{t.athletes.sport}: {t.common.all}</option>
          {sports.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select name="team" defaultValue={team} aria-label={t.athletes.team}>
          <option value="">{t.athletes.team}: {t.common.all}</option>
          {teams.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select name="status" defaultValue={status} aria-label={t.common.status}>
          <option value="active">{t.common.active}</option>
          <option value="archived">{t.common.archived}</option>
        </Select>
        <div className="flex gap-2">
          <Select name="sort" defaultValue={sort} aria-label="Sort">
            <option value="name">A–Z</option>
            <option value="recent">{t.common.date}</option>
          </Select>
          <button className="rounded-xl border border-line bg-surface/90 px-4 text-sm hover:border-brand-200 hover:bg-surface" type="submit">{t.common.filter}</button>
        </div>
      </form>

      {athletes.length === 0 ? (
        <EmptyState
          title={hasFilters ? t.exercises.empty : t.athletes.empty}
          body={hasFilters ? undefined : t.athletes.emptyHelp}
          action={!hasFilters && !readOnly && <ButtonLink href="/athletes/new">{t.athletes.add}</ButtonLink>}
        />
      ) : (
        <>
          <Table head={[t.common.name, t.athletes.sport, t.athletes.team, t.athletes.position, t.athletes.age, ""]}>
            {athletes.map((a) => (
              <tr key={a.id} className="hover:bg-canvas/60">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={a.full_name} />
                    <div className="min-w-0">
                      <Link href={`/athletes/${a.id}`} className="font-semibold text-ink hover:text-brand-700">{a.full_name}</Link>
                      {missingGuardianConsent(a as Athlete, new Date().toISOString().slice(0, 10)) && <span className="ms-2 align-middle"><Badge tone="red">{t.minors.missingBadge}</Badge></span>}
                      {a.email && <div className="text-xs text-muted">{a.email}</div>}
                    </div>
                  </div>
                </Td>
                <Td>{a.sport ?? "—"}</Td>
                <Td>{a.team_name ?? "—"}</Td>
                <Td>{a.position ?? "—"}</Td>
                <Td><span className="num">{ageFromDob(a.date_of_birth) ?? "—"}</span></Td>
                <Td>{a.user_id ? <Badge tone="green">{t.athletes.linked}</Badge> : <Badge>{t.athletes.notLinked}</Badge>}</Td>
              </tr>
            ))}
          </Table>
          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
              <span className="num">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t.common.of} {total}</span>
              <div className="flex gap-2">
                {page > 1 && <ButtonLink variant="secondary" href={qs({ page: page - 1 })}>‹</ButtonLink>}
                {page * PAGE_SIZE < total && <ButtonLink variant="secondary" href={qs({ page: page + 1 })}>›</ButtonLink>}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
