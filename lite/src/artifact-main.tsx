import { createRoot } from "react-dom/client";
import { ArtifactApp } from "./artifact-app";
import "./styles.css";

const el = document.getElementById("root");
if (el) createRoot(el).render(<ArtifactApp />);
