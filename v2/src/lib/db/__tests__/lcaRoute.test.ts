import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { lcaJoins, statementHome } from "../lcaRoute";

/**
 * The routing rule for the LCA filings' own database file, held to the same
 * fixture as scripts/lib_db.py, so the site and the scripts send a statement
 * to the same server.
 */
const fixture = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "scripts/fixtures/lca_routing.json"), "utf8"),
) as { cases: { sql: string; home: "lca" | "main" | null; joins: string[] }[] };

describe("LCA routing, from the shared fixture", () => {
  it("holds its cases", () => {
    expect(fixture.cases.length).toBeGreaterThanOrEqual(15);
  });

  it.each(fixture.cases.map((c) => [c.sql.replace(/\s+/g, " ").slice(0, 70), c] as const))(
    "%s",
    (_name, c) => {
      expect(statementHome(c.sql)).toBe(c.home);
      expect(lcaJoins(c.sql)).toEqual(c.joins);
    },
  );
});
