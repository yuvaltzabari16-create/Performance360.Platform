import { createRoot } from "react-dom/client";
import { App } from "./app";
import { AskHost } from "./askhost";
import { LockGate } from "./lockgate";
import { LOCK, SANDBOX } from "./platform";
import { LITE } from "./strings";
import "./styles.css";

const el = document.getElementById("root");
if (el) {
  const tree = LOCK ? <LockGate><App /></LockGate> : <App />;
  const he = (() => { try { return localStorage.getItem("performance360-lite-lang") === "he"; } catch { return false; } })();
  const c = LITE[he ? "he" : "en"].cloud;
  createRoot(el).render(SANDBOX ? <AskHost yes={c.yes} no={c.no}>{tree}</AskHost> : tree);
}
