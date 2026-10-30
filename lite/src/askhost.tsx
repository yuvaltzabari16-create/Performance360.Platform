import { useEffect, useState, type ReactNode } from "react";
import { registerAsker } from "./platform";

interface Question { text: string; done: (v: boolean) => void }

/** Yes/no dialog shown inside the page, for hosts that block the browser's own confirm. */
export function AskHost({ children, yes, no }: { children: ReactNode; yes: string; no: string }) {
  const [q, setQ] = useState<Question | null>(null);
  useEffect(() => {
    registerAsker((text) => new Promise<boolean>((resolve) => setQ({ text, done: (v) => { setQ(null); resolve(v); } })));
    return () => registerAsker(null);
  }, []);
  return (
    <>
      {children}
      {q && (
        <div role="dialog" aria-modal="true" aria-label={q.text} className="ask-backdrop">
          <div className="card ask">
            <p>{q.text}</p>
            <div className="row"><button className="btn danger" autoFocus onClick={() => q.done(true)}>{yes}</button><button className="btn" onClick={() => q.done(false)}>{no}</button></div>
          </div>
        </div>
      )}
    </>
  );
}
