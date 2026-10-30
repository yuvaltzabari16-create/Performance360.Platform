import { LogoMark } from "./logo";
import { type ReactNode } from "react";
import { AppCtx, type Ctx, type Screen } from "./ctx";
import { Athletes, AthleteDetail, Overview } from "./screens-core";
import { Assistant, LibraryScreen, Settings, Training } from "./screens-more";

export const NAV: Screen["name"][] = ["overview", "athletes", "training", "library", "assistant", "settings"];

/** Sidebar, banners and the current screen. Shared by the single file and the shared artifact. */
export function Shell({ ctx, screen, setScreen, banners }: { ctx: Ctx; screen: Screen; setScreen: (s: Screen) => void; banners?: ReactNode }) {
  const { L } = ctx;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <aside className="side no-print">
          <div className="brand"><LogoMark />{L.title}</div>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => <button key={n} aria-current={screen.name === n ? "page" : undefined} onClick={() => setScreen({ name: n })}>{L.nav[n]}</button>)}
          </nav>
          <p className="muted small">{L.tagline}</p>
        </aside>
        <main className="main">
          {banners}
          {screen.name === "overview" && <Overview />}
          {screen.name === "athletes" && (screen.athleteId ? <AthleteDetail id={screen.athleteId} /> : <Athletes />)}
          {screen.name === "training" && <Training programId={screen.programId} />}
          {screen.name === "library" && <LibraryScreen />}
          {screen.name === "assistant" && <Assistant />}
          {screen.name === "settings" && <Settings />}
        </main>
      </div>
    </AppCtx.Provider>
  );
}
