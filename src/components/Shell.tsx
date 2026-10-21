import type { ReactNode } from "react";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";

const ICON: Record<string, string> = {
  overview: "M3 13h8V3H3zm10 8h8V11h-8zM3 21h8v-6H3zm10-18v6h8V3z",
  players: "M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-6 1.3-6 3.5V19h12v-2.5C14 14.3 10.7 13 8 13zm8 0c-.3 0-.7 0-1.1.1 1.2.9 2.1 2 2.1 3.4V19h5v-2.5c0-2.2-3.3-3.5-6-3.5z",
  squads: "M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6zm0 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 13c-2.2-.4-4-1.8-5-3.6.3-1.6 3.3-2.4 5-2.4s4.7.8 5 2.4c-1 1.8-2.8 3.2-5 3.6z",
  staff: "M15 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2zm9 4c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z",
  settings: "M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.5 7.5 0 0 0-1.7-1L15 3h-4l-.4 2.7a7.5 7.5 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.5 7.5 0 0 0 1.7 1L11 21h4l.4-2.7a7.5 7.5 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
  today: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  progress: "M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8z",
  notes: "M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z",
};

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const { t } = useI18n();
  const { role, club } = useSession();

  const items =
    role === "athlete"
      ? [
          { to: "/today", key: "today", label: t.today },
          { to: "/progress", key: "progress", label: t.progress },
          { to: "/notes", key: "notes", label: t.notesNav },
          { to: "/settings", key: "settings", label: t.settings },
        ]
      : [
          { to: "/overview", key: "overview", label: t.overview },
          { to: "/players", key: "players", label: t.players },
          { to: "/squads", key: "squads", label: t.squads },
          ...(role === "director" ? [{ to: "/staff", key: "staff", label: t.staff }] : []),
          { to: "/settings", key: "settings", label: t.settings },
        ];

  const links = items.map((it) => (
    <a key={it.key} href={"#" + it.to} aria-current={path === it.to || path.startsWith(it.to + "/") ? "page" : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[it.key]} /></svg>
      <span>{it.label}</span>
    </a>
  ));

  return (
    <div className="app">
      <aside className="rail">
        <div>
          <div className="brand">Performance<span>360</span></div>
          <div className="club">{club?.name}</div>
        </div>
        <nav className="nav" aria-label="Main">{links}</nav>
        <div className="foot">{role && <span>{t.role[role]}</span>}</div>
      </aside>
      <div className="main">
        <header className="top">
          <span className="mbrand">P<span>360</span></span>
          <span className="grow muted" style={{ fontSize: 12 }}>{club?.name}</span>
        </header>
        <main className="content">{children}</main>
      </div>
      <nav className="tabbar" aria-label="Main">{links}</nav>
    </div>
  );
}
