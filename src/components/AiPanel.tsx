import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";
import { supabase } from "../lib/supabase";
import type { Squad } from "../lib/types";
import type { WorkoutContent } from "../lib/workout";

export interface AiResult { title: string; focus: string; est_minutes: number; content: WorkoutContent }
interface Msg { role: "user" | "assistant"; text: string; error?: boolean }

/** Chat panel that asks the ai-workout edge function to create or change the workout in the editor. */
export function AiPanel({ current, hasContent, squads, onResult }: {
  current: { title: string; content: WorkoutContent } | null; hasContent: boolean; squads: Squad[];
  onResult: (r: AiResult, mode: "create" | "modify") => void;
}) {
  const { t, lang } = useI18n();
  const { club } = useSession();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"create" | "modify">(hasContent ? "modify" : "create");
  const [squad, setSquad] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setMode(hasContent ? "modify" : "create"); }, [hasContent]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs, busy]);

  async function send(prompt: string) {
    if (!prompt.trim() || busy) return;
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: prompt }]);
    setText("");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-workout", {
        body: { club_id: club!.id, mode, prompt, lang, history, squad_id: squad || null, workout: mode === "modify" ? current : undefined },
      });
      if (error) {
        let code = "def";
        try { code = (await (error as { context?: Response }).context?.json())?.error ?? "def"; } catch { /* not json */ }
        throw new Error(t.aiErr[code] ?? t.aiErr.def);
      }
      const r = data as { reply: string; dropped: number; workout: AiResult };
      onResult(r.workout, mode);
      setMsgs((m) => [...m, { role: "assistant", text: `${r.reply}\n\n${t.aiApplied}${r.dropped ? `\n(${r.dropped} ${t.aiDropped})` : ""}` }]);
      setMode("modify");
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="ai">
      <h2><svg className="spark" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" /></svg>{t.aiAssistant}</h2>
      <div className="ai-log" aria-live="polite">
        {msgs.length === 0 && <p className="muted" style={{ margin: 0 }}>{t.aiIntro}</p>}
        {msgs.map((m, i) => <div key={i} className={"bubble " + m.role + (m.error ? " error" : "")}>{m.text}</div>)}
        {busy && <div className="bubble assistant typing">{t.aiThinking}</div>}
        <div ref={end} />
      </div>
      <div className="seg" role="group">
        <button aria-pressed={mode === "create"} onClick={() => setMode("create")}>{t.aiNew}</button>
        <button aria-pressed={mode === "modify"} disabled={!hasContent} onClick={() => setMode("modify")}>{t.aiChange}</button>
      </div>
      {mode === "modify" && (
        <div className="presets">
          {t.aiPresets.map((p) => <button key={p} disabled={busy} onClick={() => send(p)}>{p}</button>)}
        </div>
      )}
      {squads.length > 0 && (
        <select value={squad} onChange={(e) => setSquad(e.target.value)} aria-label={t.aiSquadCtx}>
          <option value="">{t.aiSquadCtx}: —</option>
          {squads.map((s) => <option key={s.id} value={s.id}>{t.aiSquadCtx}: {s.name}</option>)}
        </select>
      )}
      <textarea value={text} placeholder={t.aiPlaceholder} onChange={(e) => setText(e.target.value)} rows={4}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(text); }} aria-label={t.aiAssistant} />
      <button className="btn" disabled={busy || !text.trim()} onClick={() => send(text)}>{t.send}</button>
    </aside>
  );
}
