#!/usr/bin/env node
// Verifies fonts, icons and npm dependencies against the license policy.
//   npm run check:licenses
// Fails (exit 1) on: an undeclared font/icon library in the source, a declared asset with a
// disallowed license, or a production dependency whose license is unknown or not allowed.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findAssetUsage, isAllowedExpression, validateManifest } from "../src/lib/legal/license-policy.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "src/lib/legal/assets.json"), "utf8"));
const problems = [...validateManifest(manifest)];

/** Collects source files (ts, tsx, css) under src/. */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.ts$/.test(name) && !p.includes("license-policy")) out.push({ path: relative(root, p), text: readFileSync(p, "utf8") });
  }
  return out;
}

// 1. Font/icon libraries must be declared. The declared entries today use no files or packages,
//    so any hit means something new appeared and needs a manifest entry plus a review.
for (const hit of findAssetUsage(walk(join(root, "src")))) {
  problems.push(`${hit.path}: uses a ${hit.kind} resource (${hit.match}). Add it to src/lib/legal/assets.json with its license, then allow it in the policy.`);
}

// 2. Production dependencies, from the lockfile.
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const exceptions = manifest.reviewedExceptions ?? [];
const counts = {};
const listed = [];
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.dev) continue;
  const name = path.replace(/^.*node_modules\//, "");
  const license = pkg.license ?? "(none)";
  counts[license] = (counts[license] ?? 0) + 1;
  listed.push({ name, version: pkg.version, license });
  if (isAllowedExpression(license)) continue;
  if (exceptions.some((e) => name.startsWith(e.match))) continue;
  problems.push(`dependency ${name}: license "${license}" is unknown or not allowed`);
}

// Refresh the list shown on the public Licenses page.
listed.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(join(root, "src/lib/legal/dependency-licenses.json"), JSON.stringify({ byLicense: counts, packages: listed }, null, 2) + "\n");
console.log("Production dependency licenses:", counts);
if (problems.length) {
  console.error("\nLicense check FAILED:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log("License check passed.");
