import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { LEGAL_FORM, LEGAL_NAME } from "@/lib/constants/about";
import { getOrganizationSchema } from "@/lib/structuredData";

/**
 * One legal entity, named identically on every surface that binds or
 * describes it.
 *
 * On 2026-09-22 the Terms bound "PERM Tracker LLC" under the laws of the
 * District of Columbia while the LLC was being formed in Florida, and the
 * About page and the Organization node named no entity at all. The entity is
 * a Florida LLC (Articles filed through Northwest Registered Agent that day),
 * and the three surfaces read one constant.
 */
const PUBLIC = join(__dirname, "..", "(site)", "(public)");
const terms = readFileSync(join(PUBLIC, "terms", "page.tsx"), "utf8");
const about = readFileSync(join(PUBLIC, "about", "page.tsx"), "utf8");

describe("the legal entity", () => {
  it("is a Florida LLC under one name", () => {
    expect(LEGAL_NAME).toBe("PERM Tracker LLC");
    expect(LEGAL_FORM).toMatch(/Florida/);
  });

  it("is the party the Terms bind, under Florida law", () => {
    expect(terms).toContain(LEGAL_NAME);
    expect(terms).toContain("State of Florida");
    expect(terms).toMatch(/courts located in Florida/);
    expect(terms).not.toContain("District of Columbia");
  });

  it("is named on the About page from the constant, not retyped", () => {
    expect(about).toMatch(/Operated by \{LEGAL_NAME\}, \{LEGAL_FORM\}/);
  });

  it("is the Organization node's legalName", () => {
    const org = getOrganizationSchema("https://permtracker.app") as { legalName?: string; name: string };
    expect(org.legalName).toBe(LEGAL_NAME);
    expect(org.name).toBe("PERM Tracker");
  });
});
