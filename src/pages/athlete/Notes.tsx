import { ErrorBox, Loading } from "../../components/ui";
import { displayName, loadNotes } from "../../lib/data";
import { fmtDay } from "../../lib/dates";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";
import { must, supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { useAsync } from "../../lib/useAsync";

export function AthleteNotes() {
  const { t, lang } = useI18n();
  const { myPlayer } = useSession();
  const q = useAsync(async () => {
    if (!myPlayer) return { notes: [], authors: new Map<string, Profile>() };
    const notes = await loadNotes(myPlayer.id); // RLS returns only notes shared with the athlete
    const ids = [...new Set(notes.map((n) => n.author_id))];
    const profs = ids.length ? (must(await supabase.from("profiles").select("id, full_name, locale").in("id", ids)) as Profile[]) : [];
    return { notes, authors: new Map(profs.map((p) => [p.id, p])) };
  }, [myPlayer?.id]);

  if (!myPlayer) return <><h1>{t.notesNav}</h1><div className="panel"><p className="empty">{t.notLinkedAthlete}</p></div></>;
  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBox message={q.error} onRetry={q.reload} />;

  return (
    <>
      <h1>{t.sharedNotes}</h1>
      <section className="panel">
        {q.data!.notes.length === 0 ? <p className="empty">{t.noSharedNotes}</p> : q.data!.notes.map((n) => (
          <div key={n.id} className="note">
            <span className="muted" style={{ fontSize: 12 }}>{displayName(q.data!.authors.get(n.author_id))} · {fmtDay(n.created_at.slice(0, 10), lang)}</span>
            <p dir="auto">{n.body}</p>
          </div>
        ))}
      </section>
    </>
  );
}
