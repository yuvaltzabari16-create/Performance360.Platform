#!/usr/bin/env node
// Builds the shared Performance360 page for publishing as a claude.ai Artifact:
//   npm run build:artifact   ->   dist-artifact/performance360.html
// The file is a page fragment (title, styles, script): the Artifact tool wraps it in the document skeleton.
// It talks to the artifact's own store through the `db` and `user` capabilities, never to another server.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const result = await build({
  entryPoints: [join(root, "lite/src/artifact-main.tsx")],
  bundle: true, minify: true, write: false, format: "iife", target: "es2020", jsx: "automatic", charset: "utf8",
  outdir: join(root, "dist-artifact"), legalComments: "none",
  alias: { "@": join(root, "src") },
  define: { "process.env.NODE_ENV": '"production"', __ARTIFACT__: "true" },
  logLevel: "warning",
});

let js = "";
let css = "";
for (const f of result.outputFiles) {
  if (f.path.endsWith(".js")) js = f.text;
  else if (f.path.endsWith(".css")) css = f.text;
}
js = js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

// Side gutter that also clears a system bar at the phone's side (the page declares viewport-fit-sides: cover).
const gutter = "body{padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:0}";
const html = `<title>Performance360</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}${gutter}</style>
<div id="root"></div>
<noscript>Performance360 needs JavaScript.</noscript>
<script>${js}</script>
`;
mkdirSync(join(root, "dist-artifact"), { recursive: true });
const out = join(root, "dist-artifact/performance360.html");
writeFileSync(out, html);
console.log(`built ${out} (${(html.length / 1024).toFixed(0)} KB)`);
