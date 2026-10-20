import Link from "next/link";
import { Card, EmptyState, FlashMessage, PageHeader, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getMyAthleteId, requireProfile } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import type { Message } from "@/lib/types";
import { sendMessage } from "./actions";

export const metadata = { title: "Messages" };

interface Thread {
  key: string;
  athleteId: string;
  coachId: string;
  name: string;
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireProfile();
  const tm = t.messages;
  const isAthlete = profile.role === "athlete";

  // Active connections only: a professional's access ends with the connection.
  let threads: Thread[] = [];
  if (isAthlete) {
    const myAthleteId = await getMyAthleteId();
    if (myAthleteId) {
      const { data: rels } = await supabase
        .from("coach_athlete_relationships")
        .select("coach_id")
        .eq("athlete_id", myAthleteId)
        .eq("status", "active");
      const coachIds = (rels ?? []).map((r) => r.coach_id as string);
      const { data: people } = coachIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", coachIds)
        : { data: [] as { id: string; full_name: string; email: string }[] };
      threads = coachIds.map((cid) => {
        const p = (people ?? []).find((x) => x.id === cid);
        return { key: cid, athleteId: myAthleteId, coachId: cid, name: p?.full_name || p?.email || "—" };
      });
    }
  } else {
    const { data: rels } = await supabase
      .from("coach_athlete_relationships")
      .select("athlete_id, athletes(full_name)")
      .eq("coach_id", user.id)
      .eq("status", "active");
    threads = (rels ?? []).map((r) => {
      const a = r.athletes as unknown as { full_name: string } | null;
      return { key: r.athlete_id as string, athleteId: r.athlete_id as string, coachId: user.id, name: a?.full_name ?? "—" };
    });
    threads.sort((x, y) => x.name.localeCompare(y.name));
  }

  const wanted = isAthlete ? sp.coach : sp.athlete;
  const active = threads.find((th) => th.key === wanted) ?? (threads.length === 1 ? threads[0] : undefined);

  // Unread counts per thread (messages from the other party).
  const { data: unreadRows } = await supabase
    .from("messages")
    .select("athlete_id, coach_id")
    .is("read_at", null)
    .neq("sender_id", user.id)
    .limit(2000);
  const unread = new Map<string, number>();
  (unreadRows ?? []).forEach((m) => {
    const k = (isAthlete ? m.coach_id : m.athlete_id) as string;
    unread.set(k, (unread.get(k) ?? 0) + 1);
  });

  let messages: Message[] = [];
  if (active && isUuid(active.athleteId) && isUuid(active.coachId)) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("athlete_id", active.athleteId)
      .eq("coach_id", active.coachId)
      .order("created_at", { ascending: true })
      .limit(500);
    messages = (data ?? []) as Message[];
    if (messages.some((m) => m.sender_id !== user.id && !m.read_at)) {
      await supabase.rpc("mark_thread_read", { p_athlete: active.athleteId, p_coach: active.coachId });
      unread.delete(active.key);
    }
  }

  const param = isAthlete ? "coach" : "athlete";

  return (
    <>
      <PageHeader title={tm.title} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      {threads.length === 0 ? (
        <EmptyState title={tm.empty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <nav aria-label={tm.conversations} className="min-w-0">
            <ul className="space-y-1">
              {threads.map((th) => (
                <li key={th.key}>
                  <Link
                    href={`/messages?${param}=${th.key}`}
                    aria-current={active?.key === th.key ? "page" : undefined}
                    className={cx(
                      "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm",
                      active?.key === th.key ? "bg-brand-50 font-medium text-brand-800" : "hover:bg-canvas",
                    )}
                  >
                    <span className="truncate">{th.name}</span>
                    {(unread.get(th.key) ?? 0) > 0 && (
                      <span className="num rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">
                        {unread.get(th.key)}
                        <span className="sr-only"> {tm.unread}</span>
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {active ? (
            <Card title={active.name}>
              <p className="mb-3 text-xs text-muted">{tm.accessNote}</p>
              <ol className="mb-4 max-h-[55dvh] space-y-3 overflow-y-auto" aria-live="polite">
                {messages.length === 0 && <li className="text-sm text-muted">{tm.noMessages}</li>}
                {messages.map((m) => {
                  const mine = m.sender_id === user.id;
                  return (
                    <li key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                      <div className={cx("max-w-[85%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-brand-600 text-white" : "bg-canvas text-ink")}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cx("mt-1 text-[11px]", mine ? "text-white/75" : "text-muted")}>
                          {mine ? tm.you : active.name} · {new Date(m.created_at).toLocaleString(profile.locale === "he" ? "he-IL" : "en-GB", { dateStyle: "short", timeStyle: "short" })}
                          {mine && ` · ${m.read_at ? tm.read : tm.delivered}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <form action={sendMessage} className="space-y-2">
                <input type="hidden" name="athlete_id" value={active.athleteId} />
                <input type="hidden" name="coach_id" value={active.coachId} />
                <label htmlFor="message-body" className="sr-only">{tm.placeholder}</label>
                <Textarea id="message-body" name="body" rows={3} maxLength={4000} required placeholder={tm.placeholder} />
                <SubmitButton pendingText={t.common.saving}>{tm.send}</SubmitButton>
              </form>
            </Card>
          ) : (
            <Card><p className="text-sm text-muted">{tm.choose}</p></Card>
          )}
        </div>
      )}
    </>
  );
}
