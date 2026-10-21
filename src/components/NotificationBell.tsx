import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { areaLabel } from "../lib/injuries";
import { navigate } from "../lib/router";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { AppNotification } from "../lib/types";

/** Notification text is built here from kind + data, so it follows the viewer's language. */
function render(n: AppNotification, t: ReturnType<typeof useI18n>["t"]) {
  const d = n.data ?? {};
  const fill = (tpl: string) => tpl
    .replace("{player}", String(d.player ?? ""))
    .replace("{title}", String(d.title ?? ""))
    .replace("{stage}", t.rtpStages[Number(d.stage)] ?? "")
    .replace("{area}", n.kind === "pain_reported" ? (d.area ? ` — ${areaLabel(String(d.area), t.areas)}` : "") : areaLabel(String(d.area ?? ""), t.areas));
  const title = fill(t.notif[n.kind] ?? n.kind);
  const detail = typeof d.preview === "string" ? d.preview : n.kind === "injury_new" && d.severity ? t.severities[String(d.severity)] : null;
  return { title, detail };
}

function ago(ts: string, lang: string, justNow: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return justNow;
  const rtf = new Intl.RelativeTimeFormat(lang === "he" ? "he" : "en", { numeric: "auto" });
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  return rtf.format(-Math.round(s / 86400), "day");
}

const ICON = {
  message_from_athlete: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z",
  message_from_staff: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z",
  injury_new: "M12 21s-7-4.4-9.3-9C1 8.5 3 5 6.5 5c2 0 3.5 1.2 4.5 2.6h2C14 6.2 15.5 5 17.5 5 21 5 23 8.5 21.3 12 19 16.6 12 21 12 21z",
  injury_stage: "M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8z",
  pain_reported: "M12 2 1 21h22zm0 5 7.5 12h-15zm-1 4v4h2v-4zm0 5v2h2v-2z",
  workout_assigned: "M3 5h12v2H3zm0 6h12v2H3zm0 6h8v2H3z",
} as Record<string, string>;

/** Bell with unread badge; polls every 60 s and on navigation. */
export function NotificationBell() {
  const { t, lang } = useI18n();
  const { userId } = useSession();
  const [list, setList] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(40);
    if (data) setList(data as AppNotification[]);
  }, [userId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    window.addEventListener("hashchange", load);
    return () => { window.clearInterval(id); window.removeEventListener("hashchange", load); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const unread = list.filter((n) => !n.read_at).length;

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.read_at) {
      setList((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    const now = new Date().toISOString();
    setList((l) => l.map((x) => ({ ...x, read_at: x.read_at ?? now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", userId!).is("read_at", null);
  }

  return (
    <div className="bell" ref={box}>
      <button className="btn icon bell-btn" aria-label={`${t.notifications}${unread ? ` (${unread})` : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1z" /></svg>
        {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label={t.notifications}>
          <div className="spread bell-head">
            <b>{t.notifications}</b>
            {unread > 0 && <button className="link" style={{ fontSize: 12 }} onClick={readAll}>{t.markAllRead}</button>}
          </div>
          {list.length === 0 && <p className="empty" style={{ padding: 12 }}>{t.noNotifications}</p>}
          <div className="bell-list">
            {list.map((n) => {
              const r = render(n, t);
              return (
                <button key={n.id} className={"bell-item" + (n.read_at ? "" : " unread")} onClick={() => openItem(n)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[n.kind] ?? ICON.workout_assigned} /></svg>
                  <span className="bell-text">
                    <span className="bell-title">{r.title}</span>
                    {r.detail && <span className="bell-detail" dir="auto">{r.detail}</span>}
                    <span className="bell-time">{ago(n.created_at, lang, t.justNow)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
