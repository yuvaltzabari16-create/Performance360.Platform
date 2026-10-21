import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Avatar, ErrorBox, Loading, useAction } from "../components/ui";
import { displayName, editablePlayerIds, loadClub } from "../lib/data";
import { fmtDay, isoDate } from "../lib/dates";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";
import { must, supabase } from "../lib/supabase";
import type { Message, Profile } from "../lib/types";
import { useAsync } from "../lib/useAsync";

/** Local calendar day / clock time of a timestamp (not the UTC date in the string). */
const localDay = (ts: string) => isoDate(new Date(ts));
const clock = (ts: string, lang: string) => new Date(ts).toLocaleTimeString(lang === "he" ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" });

async function markRead(playerId: string, userId: string) {
  await supabase.from("message_reads").upsert({ player_id: playerId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "player_id,user_id" });
}

/** Coaches see a list of their athletes' threads; athletes go straight to their own thread with the staff. */
export function Messages({ playerId }: { playerId: string | null }) {
  const { role, myPlayer } = useSession();
  if (role === "athlete") {
    return myPlayer ? <AthleteMessages playerId={myPlayer.id} /> : <NotLinked />;
  }
  return <StaffMessages playerId={playerId} />;
}

function NotLinked() {
  const { t } = useI18n();
  return <><h1>{t.messages}</h1><div className="panel"><p className="empty">{t.notLinkedAthlete}</p></div></>;
}

function AthleteMessages({ playerId }: { playerId: string }) {
  const { t } = useI18n();
  return (
    <>
      <h1>{t.messages}</h1>
      <section className="panel thread-panel">
        <div className="who"><span className="av staff-av" aria-hidden="true">P</span><span className="nm">{t.messageStaff}</span></div>
        <Thread playerId={playerId} />
      </section>
    </>
  );
}

function StaffMessages({ playerId }: { playerId: string | null }) {
  const { t, lang } = useI18n();
  const { club, role, userId } = useSession();
  const [term, setTerm] = useState("");
  const q = useAsync(async () => {
    const [c, msgs, reads] = await Promise.all([
      loadClub(club!.id),
      supabase.from("messages").select("*").eq("club_id", club!.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("message_reads").select("*").eq("user_id", userId!),
    ]);
    return { ...c, msgs: must(msgs) as Message[], reads: must(reads) as { player_id: string; last_read_at: string }[] };
  }, [club?.id, userId, playerId]);

  const threads = useMemo(() => {
    if (!q.data) return [];
    const editable = editablePlayerIds(q.data, role, userId);
    const last = new Map<string, Message>();
    for (const m of q.data.msgs) if (!last.has(m.player_id)) last.set(m.player_id, m);
    const read = new Map(q.data.reads.map((r) => [r.player_id, r.last_read_at]));
    const n = term.trim().toLowerCase();
    return q.data.players
      .filter((p) => editable.has(p.id) && (!n || p.full_name.toLowerCase().includes(n)))
      .map((p) => {
        const m = last.get(p.id);
        const unread = !!m && m.sender_id !== userId && (!read.get(p.id) || m.created_at > read.get(p.id)!);
        return { p, m, unread };
      })
      .sort((a, b) => (b.m?.created_at ?? "").localeCompare(a.m?.created_at ?? "") || a.p.full_name.localeCompare(b.p.full_name));
  }, [q.data, role, userId, term]);

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return null;
  const current = playerId ? q.data.players.find((p) => p.id === playerId) : null;
  const today = isoDate();

  return (
    <>
      <h1>{t.messages}</h1>
      <div className={"msgs" + (current ? " has-thread" : "")}>
        <section className="panel thread-list">
          <input type="search" placeholder={t.search} value={term} onChange={(e) => setTerm(e.target.value)} aria-label={t.search} />
          <div className="list">
            {threads.map(({ p, m, unread }) => (
              <a key={p.id} href={`#/messages/${p.id}`} className="li thread-row" aria-current={p.id === playerId ? "true" : undefined}>
                <span className="who" style={{ minWidth: 0, flex: 1 }}>
                  <Avatar name={p.full_name} />
                  <span style={{ minWidth: 0 }}>
                    <span className="nm">{p.full_name}</span>
                    <span className="mt preview" dir="auto">{m ? `${m.sender_id === userId ? t.you2 + ": " : ""}${m.body}` : "—"}</span>
                  </span>
                </span>
                <span className="row" style={{ gap: 6, flex: "none" }}>
                  {m && <span className="muted" style={{ fontSize: 11 }}>{localDay(m.created_at) === today ? clock(m.created_at, lang) : fmtDay(localDay(m.created_at), lang)}</span>}
                  {unread && <span className="unread-dot" aria-label="unread" />}
                </span>
              </a>
            ))}
          </div>
        </section>
        <section className="panel thread-panel">
          {current ? (
            <>
              <div className="spread">
                <a className="back mobile-back" href="#/messages">{lang === "he" ? "→" : "←"} {t.conversations}</a>
                <a className="who" href={`#/players/${current.id}`}><Avatar name={current.full_name} /><span className="nm">{current.full_name}</span></a>
              </div>
              <Thread playerId={current.id} profiles={q.data.profiles} onRead={q.reload} />
            </>
          ) : <p className="empty">{t.selectConversation}</p>}
        </section>
      </div>
    </>
  );
}

/** One conversation. Polls every 15 s while open and marks it read. */
function Thread({ playerId, profiles, onRead }: { playerId: string; profiles?: Map<string, Profile>; onRead?: () => void }) {
  const { t, lang } = useI18n();
  const { userId } = useSession();
  const act = useAction();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const q = useAsync(async () => {
    const msgs = must(await supabase.from("messages").select("*").eq("player_id", playerId).order("created_at", { ascending: false }).limit(200)) as Message[];
    const ids = [...new Set(msgs.map((m) => m.sender_id))].filter((id) => !profiles?.has(id));
    const extra = ids.length ? (must(await supabase.from("profiles").select("id, full_name, locale").in("id", ids)) as Profile[]) : [];
    return { msgs: msgs.reverse(), names: new Map([...(profiles ?? new Map()), ...extra.map((p) => [p.id, p] as const)]) };
  }, [playerId]);

  useEffect(() => {
    const id = window.setInterval(() => q.reload(), 15000);
    return () => window.clearInterval(id);
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = q.data?.msgs.length ?? 0;
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
    if (userId && q.data) markRead(playerId, userId).then(() => onRead?.()).catch(() => {});
  }, [count, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const ok = await act(async () => { must(await supabase.from("messages").insert({ player_id: playerId, body: body.trim() })); });
    setBusy(false);
    if (ok) { setBody(""); q.reload(); }
  }

  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;
  if (!q.data) return <Loading />;
  let lastDay = "";
  return (
    <>
      <div className="thread" aria-live="polite">
        {q.data.msgs.length === 0 && <p className="empty">{t.noMessages}</p>}
        {q.data.msgs.map((m) => {
          const day = localDay(m.created_at);
          const showDay = day !== lastDay; lastDay = day;
          const mine = m.sender_id === userId;
          return (
            <div key={m.id} className="msgwrap">
              {showDay && <div className="dayline"><span>{fmtDay(day, lang, { weekday: "short", day: "numeric", month: "short" })}</span></div>}
              <div className={"msg " + (mine ? "mine" : "theirs")}>
                {!mine && <span className="sender">{displayName(q.data!.names.get(m.sender_id))}</span>}
                <span className="body" dir="auto">{m.body}</span>
                <span className="time">{clock(m.created_at, lang)}</span>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={send}>
        <textarea value={body} rows={2} maxLength={4000} placeholder={t.writeMessage} aria-label={t.writeMessage}
          onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
        <button className="btn" disabled={busy || !body.trim()}>{t.send}</button>
      </form>
    </>
  );
}
