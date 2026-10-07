import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DISAMBIGUATION, LEGAL_FORM, LEGAL_NAME, PEOPLE, POSTAL_ADDRESS } from "@/lib/constants/about";
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
 *
 * On 2026-09-30, the day the filed Articles were read (Sunbiz L26000495521,
 * filed 09/23/2026), the Terms and the Privacy Policy still named the
 * operator "PERM Tracker, Washington, DC 20001", and the policy never named
 * the entity at all. USCIS reads that policy before it grants API access.
 */
const PUBLIC = join(__dirname, "..", "(site)", "(public)");
const terms = readFileSync(join(PUBLIC, "terms", "page.tsx"), "utf8");
const about = readFileSync(join(PUBLIC, "about", "page.tsx"), "utf8");
const privacy = readFileSync(join(PUBLIC, "privacy", "page.tsx"), "utf8");
const llms = readFileSync(join(__dirname, "..", "llms.txt", "route.ts"), "utf8");
const emailLayout = readFileSync(join(__dirname, "..", "..", "emails", "components", "EmailLayout.tsx"), "utf8");

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

  it("is the operator both legal pages name, at the address filed with Florida", () => {
    // The principal and mailing address on the filed Articles.
    expect(POSTAL_ADDRESS).toBe("7901 4th St N, Ste 300, St. Petersburg, FL 33702");
    for (const page of [terms, privacy]) {
      expect(page).toMatch(/<strong>Operator:<\/strong> \{`\$\{LEGAL_NAME\}, \$\{LEGAL_FORM\}`\}/);
      expect(page).toMatch(/<strong>Mailing address:<\/strong> \{POSTAL_ADDRESS\}/);
      expect(page).not.toMatch(/Washington, DC|DC 20001/);
    }
    expect(privacy).toMatch(/operated by \{LEGAL_NAME\}/);
  });

  it("owns the copyright every email carries", () => {
    expect(emailLayout).toMatch(/&copy; \{`\$\{new Date\(\)\.getFullYear\(\)\} \$\{LEGAL_NAME\}`\}/);
  });

  it("is what tells the site apart from others with similar names", () => {
    // schema.org disambiguatingDescription: the domain, the company and the
    // source, which no similarly named site can claim; no person is named.
    expect(DISAMBIGUATION).toContain("permtracker.app");
    expect(DISAMBIGUATION).toContain(LEGAL_NAME);
    expect(DISAMBIGUATION).toMatch(/Department of Labor's own case records/);
    for (const p of PEOPLE) expect(DISAMBIGUATION).not.toContain(p.name.split(" ")[0]);
    const org = getOrganizationSchema("https://permtracker.app") as { disambiguatingDescription?: string };
    expect(org.disambiguatingDescription).toBe(DISAMBIGUATION);
    expect(llms).toMatch(/^\s+DISAMBIGUATION,$/m);
  });
});
