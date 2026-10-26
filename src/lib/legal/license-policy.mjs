// License policy shared by `npm run check:licenses` and the unit tests.
// Plain .mjs so the check script can run with plain Node (no build step).

/** SPDX identifiers that may be used in a commercial product without further review. */
export const ALLOWED_LICENSES = [
  "MIT", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "CC0-1.0", "Unlicense",
  "BlueOak-1.0.0", "Python-2.0",
  "CC-BY-4.0", // requires attribution (shown on the Licenses page)
  "OFL-1.1", // fonts: may be bundled and used, not sold on their own
];

/**
 * Whether an SPDX expression is acceptable: "A OR B" needs one acceptable side,
 * "A AND B" needs both. Parentheses are flattened, which is enough for npm metadata.
 * @param {string} expression
 * @param {string[]} [allowed]
 */
export function isAllowedExpression(expression, allowed = ALLOWED_LICENSES) {
  if (!expression || typeof expression !== "string") return false;
  const flat = expression.replace(/[()]/g, " ").trim();
  return flat.split(/\s+OR\s+/i).some((alt) => alt.split(/\s+AND\s+/i).every((id) => allowed.includes(id.trim())));
}

/** Patterns that mean a font or icon library is being used and must be declared in assets.json. */
export const ASSET_USAGE_PATTERNS = [
  { kind: "font", re: /@font-face/ },
  { kind: "font", re: /next\/font/ },
  { kind: "font", re: /fonts\.(googleapis|gstatic)\.com/ },
  { kind: "font", re: /\.(woff2?|ttf|otf|eot)\b/ },
  { kind: "icon", re: /from\s+["'](lucide-react|@heroicons\/[^"']+|react-icons[^"']*|@fortawesome\/[^"']+|@tabler\/[^"']+|phosphor-react|@phosphor-icons\/[^"']+|bootstrap-icons|material-icons[^"']*|@mui\/icons-material)["']/ },
];

/**
 * Finds font/icon usage in source files.
 * @param {{ path: string, text: string }[]} files
 * @returns {{ path: string, kind: string, match: string }[]}
 */
export function findAssetUsage(files) {
  const hits = [];
  for (const f of files) {
    for (const { kind, re } of ASSET_USAGE_PATTERNS) {
      const m = re.exec(f.text);
      if (m) hits.push({ path: f.path, kind, match: m[0] });
    }
  }
  return hits;
}

/**
 * Checks the declared fonts/icons: each needs a name, source and an allowed license.
 * @param {{ fonts?: any[], icons?: any[] }} manifest
 * @returns {string[]} problems
 */
export function validateManifest(manifest) {
  const problems = [];
  for (const group of ["fonts", "icons"]) {
    for (const item of manifest[group] ?? []) {
      if (!item.name) problems.push(`${group}: entry without a name`);
      if (!item.source) problems.push(`${group}: "${item.name}" has no source`);
      if (item.proprietary) continue; // project-owned artwork
      if (!isAllowedExpression(item.license)) problems.push(`${group}: "${item.name}" has license "${item.license}" which is not allowed`);
    }
  }
  return problems;
}
