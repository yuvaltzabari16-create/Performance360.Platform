import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MATRIX_ROLES } from "./permissions-matrix";
import { sectionsFor } from "./permissions";
import { rolesDoc } from "./roles-doc";

const file = resolve(__dirname, "../../docs/ROLES.md");

describe("docs/ROLES.md", () => {
  it("matches src/lib/permissions.ts (run `npm run docs:roles` after changing permissions)", () => {
    if (process.env.UPDATE_ROLES_DOC === "1") writeFileSync(file, rolesDoc());
    expect(readFileSync(file, "utf8")).toBe(rolesDoc());
  });

  it("never lets anyone but athletes see 'Connect to a coach', and never lets athletes see staff sections", () => {
    for (const r of MATRIX_ROLES) {
      const s = sectionsFor(r.role, r.orgRole);
      expect(s.includes("connect")).toBe(r.role === "athlete");
      if (r.role === "athlete") for (const staff of ["athletes", "teams", "team", "code"] as const) expect(s).not.toContain(staff);
    }
  });
});
