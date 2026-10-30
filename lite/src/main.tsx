import { createRoot } from "react-dom/client";
import { App } from "./app";
import { LockGate } from "./lockgate";
import { LOCK } from "./platform";
import "./styles.css";

const el = document.getElementById("root");
if (el) createRoot(el).render(LOCK ? <LockGate><App /></LockGate> : <App />);
