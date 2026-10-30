import { useEffect, useRef, useState } from "react";
import { useApp } from "./ctx";
import { replaceById, type Athlete } from "./model";
import { claudeNs } from "./platform";
import { fill } from "./strings";

interface Profile { id: string; name: string }
interface UserNs { search(q: string): Promise<Profile[]>; profiles(ids: readonly string[]): Promise<Record<string, Profile>> }

/**
 * Lets a coach link an athlete to a person's Claude account. Only the account id is stored; the name shown here is
 * looked up each time, so it is never saved in the data.
 */
export function LinkAccount({ athlete }: { athlete: Athlete }) {
  const { update, L } = useApp();
  const t = L.cloud.link;
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Profile[]>([]);
  const [name, setName] = useState("");
  const user = useRef<UserNs | null>(null);

  useEffect(() => { void (claudeNs()?.use("user") as Promise<UserNs | null> | undefined)?.then((u) => { user.current = u; }); }, []);
  useEffect(() => {
    let live = true;
    setName("");
    const id = athlete.userId;
    if (!id) return;
    void (async () => {
      const u = user.current ?? (await (claudeNs()?.use("user") as Promise<UserNs | null> | undefined));
      const ps = await u?.profiles([id]);
      if (live) setName(ps?.[id]?.name || t.someone);
    })();
    return () => { live = false; };
  }, [athlete.userId, t.someone]);

  async function search(text: string) {
    setQ(text);
    const u = user.current ?? (await (claudeNs()?.use("user") as Promise<UserNs | null> | undefined));
    setHits(text.trim() ? (await u?.search(text.trim())) ?? [] : []);
  }
  const set = (userId: string | null) => update((st) => ({ ...st, athletes: replaceById(st.athletes, { ...athlete, userId }) }));

  return (
    <div className="card">
      <h2>{t.title}</h2>
      <p className="muted small">{t.help}</p>
      {athlete.userId ? (
        <div className="row"><span>{fill(t.linked, { name: name || "…" })}</span><button className="btn" onClick={() => set(null)}>{t.unlink}</button></div>
      ) : (
        <>
          <p>{t.none}</p>
          <input aria-label={t.search} placeholder={t.search} value={q} onChange={(e) => { void search(e.target.value); }} />
          {q.trim() && hits.length === 0 && <p className="muted small">{t.noResults}</p>}
          <ul className="list">{hits.map((h) => (
            <li key={h.id} className="row between"><span>{h.name}</span><button className="btn" onClick={() => { set(h.id); setQ(""); setHits([]); }}>{t.pick}</button></li>
          ))}</ul>
        </>
      )}
    </div>
  );
}
