#!/usr/bin/env node
// Builds Performance360 Lite into ONE html file (script, styles and the exercise library inline):
//   npm run build:lite   ->   dist-lite/performance360-lite.html
// The page makes no network requests and works when opened straight from disk.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="235 255 715 715"><path d="M309 715A303 303 0 1 1 886 690" fill="none" stroke="#0b5a38" stroke-width="53" stroke-linecap="round"/><path d="M848 775A303 303 0 0 1 415 855" fill="none" stroke="#40ae4f" stroke-width="53"/><path d="M355 811L454 803L378 908Z" fill="#40ae4f"/><rect x="472" y="625" width="69" height="91" rx="16" fill="#0b5a38"/><rect x="559" y="561" width="69" height="155" rx="16" fill="#0b5a38"/><rect x="647" y="496" width="69" height="220" rx="16" fill="#40ae4f"/></svg>';
const ICON = `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`;

/** Bundles the app once; `lock` puts the passcode screen in front of it (the website build). */
async function bundle(lock, sandbox = false) {
  const result = await build({
    entryPoints: [join(root, "lite/src/main.tsx")],
    bundle: true, minify: true, write: false, format: "iife", target: "es2020", jsx: "automatic", charset: "utf8",
    outdir: join(root, "dist-lite"), legalComments: "none",
    alias: { "@": join(root, "src") },
    define: { "process.env.NODE_ENV": '"production"', __LOCK__: lock ? "true" : "false", __SANDBOX__: sandbox ? "true" : "false" },
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
  if (sandbox) {
    // A page fragment for the Artifact tool, which adds the document skeleton and its own security policy.
    return `<title>Performance360 Lite</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}body{padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:0}</style>\n<div id="root"></div>\n<noscript>Performance360 Lite needs JavaScript.</noscript>\n<script>${js}</script>\n`;
  }
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Performance360 Lite</title>
<link rel="icon" href="${ICON}">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<noscript>Performance360 Lite needs JavaScript.</noscript>
<script>${js}</script>
</body>
</html>
`;
}

// The file you open from disk has no passcode screen; the copy for a website (site-lite/index.html) has one.
const plain = await bundle(false);
const locked = await bundle(true);
mkdirSync(join(root, "dist-lite"), { recursive: true });
const out = join(root, "dist-lite/performance360-lite.html");
writeFileSync(out, plain);
mkdirSync(join(root, "site-lite"), { recursive: true });
writeFileSync(join(root, "site-lite/index.html"), locked);
const sandbox = await bundle(true, true);
mkdirSync(join(root, "dist-artifact"), { recursive: true });
writeFileSync(join(root, "dist-artifact/performance360-lite.html"), sandbox);
console.log(`built ${out} (${(plain.length / 1024).toFixed(0)} KB) and site-lite/index.html with the passcode screen (${(locked.length / 1024).toFixed(0)} KB)`);
