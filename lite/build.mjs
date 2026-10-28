#!/usr/bin/env node
// Builds Performance360 Lite into ONE html file (script, styles and the exercise library inline):
//   npm run build:lite   ->   dist-lite/performance360-lite.html
// The page makes no network requests and works when opened straight from disk.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  entryPoints: [join(root, "lite/src/main.tsx")],
  bundle: true, minify: true, write: false, format: "iife", target: "es2020", jsx: "automatic", charset: "utf8",
  outdir: join(root, "dist-lite"), legalComments: "none",
  alias: { "@": join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

let js = "";
let css = "";
for (const f of result.outputFiles) {
  if (f.path.endsWith(".js")) js = f.text;
  else if (f.path.endsWith(".css")) css = f.text;
}
// Keep the inline script from ending the tag early or opening an HTML comment.
js = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Performance360 Lite</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>Performance360 Lite needs JavaScript.</noscript>
<script>${js}</script>
</body>
</html>
`;
mkdirSync(join(root, "dist-lite"), { recursive: true });
const out = join(root, "dist-lite/performance360-lite.html");
writeFileSync(out, html);
// A copy under a fixed name for static hosting (Netlify publishes the site-lite folder).
mkdirSync(join(root, "site-lite"), { recursive: true });
writeFileSync(join(root, "site-lite/index.html"), html);
console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
