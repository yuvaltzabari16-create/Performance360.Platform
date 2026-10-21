// Builds the self-contained demo (published as a Claude artifact) from the real app source.
// Usage: node demo/build.mjs [esbuild-module-path]   -> writes dist-demo/performance360-demo.html
// Differences from the production build: Supabase is replaced by demo/backend.js (sample data in localStorage),
// React comes from cdnjs (UMD 18.3.1), VITE_DEMO=1 switches on the role switcher and YouTube link-outs.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const esbuild = require(process.argv[2] ?? "esbuild");
const out = resolve(root, "dist-demo");
mkdirSync(out, { recursive: true });

await esbuild.build({
  entryPoints: [resolve(root, "src/main.tsx")],
  bundle: true, minify: true, format: "iife", target: "es2020",
  outfile: resolve(out, "app.js"),
  jsx: "transform", jsxFactory: "window.React.createElement", jsxFragment: "window.React.Fragment",
  tsconfigRaw: { compilerOptions: { jsx: "react", jsxFactory: "window.React.createElement", jsxFragmentFactory: "window.React.Fragment" } },
  loader: { ".json": "json", ".css": "css" },
  alias: {
    "@supabase/supabase-js": resolve(root, "demo/backend.js"),
    "react": resolve(root, "demo/react-shim.cjs"),
    "react-dom/client": resolve(root, "demo/react-dom-shim.cjs"),
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": '"demo"',
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": '"demo"',
    "import.meta.env.VITE_DEMO": '"1"',
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "warning",
});

const css = readFileSync(resolve(out, "app.css"), "utf8");
const js = readFileSync(resolve(out, "app.js"), "utf8").replace(/<\/script/gi, "<\\/script");
const html = `<title>Performance360</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600&family=Rubik:wght@400;500;600;700&family=IBM+Plex+Sans+Hebrew:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(resolve(out, "performance360-demo.html"), html);
console.log("wrote dist-demo/performance360-demo.html", (html.length / 1024).toFixed(0) + " KB");
