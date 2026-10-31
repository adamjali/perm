import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DISAMBIGUATION, LEGAL_DBA, LEGAL_FORM, LEGAL_NAME, PEOPLE, POSTAL_ADDRESS, SABRINA, TRADE_NAME, TRADE_NAME_NOTE } from "@/lib/constants/about";
import { TEXT_LEGAL_LINE } from "@convex/lib/textFooter";
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
 *
 * On 2026-10-08 the LLC was renamed ASOLYS LLC (Articles of Amendment; Sunbiz
 * read Oct 30). The Terms had the old name typed twice, once split across two
 * lines where a search for it found nothing; the binding surfaces now read the
 * constant, and "PERM Tracker" is the trade name (TRADE_NAME_NOTE).
 *
 * On 2026-10-31 the Terms read "operated byAsolys LLC" (a line break the source
 * check couldn't see), the morning page check still looked for "PERM Tracker LLC"
 * and failed every page, and the API terms, Accessibility, Editorial standards,
 * llms.txt, the licences, the packages and the plain-text emails named the
 * company the old way or not at all. Every one reads LEGAL_DBA now.
 */
const PUBLIC = join(__dirname, "..", "(site)", "(public)");
const terms = readFileSync(join(PUBLIC, "terms", "page.tsx"), "utf8");
const about = readFileSync(join(PUBLIC, "about", "page.tsx"), "utf8");
const privacy = readFileSync(join(PUBLIC, "privacy", "page.tsx"), "utf8");
const llms = readFileSync(join(__dirname, "..", "llms.txt", "route.ts"), "utf8");
const emailLayout = readFileSync(join(__dirname, "..", "..", "emails", "components", "EmailLayout.tsx"), "utf8");
const footer = readFileSync(join(__dirname, "..", "..", "components", "layout", "Footer.tsx"), "utf8");
const methodology = readFileSync(join(PUBLIC, "methodology", "page.tsx"), "utf8");
const trackers = readFileSync(join(__dirname, "..", "..", "lib", "compare", "trackers.ts"), "utf8");
const apiTerms = readFileSync(join(PUBLIC, "api-terms", "page.tsx"), "utf8");
const accessibility = readFileSync(join(PUBLIC, "accessibility", "page.tsx"), "utf8");
const editorial = readFileSync(join(PUBLIC, "editorial-standards", "page.tsx"), "utf8");
const settings = readFileSync(join(__dirname, "..", "..", "components", "settings", "SupportSection.tsx"), "utf8");
const articleSeo = readFileSync(join(__dirname, "..", "..", "lib", "content", "seo.ts"), "utf8");
const V2 = join(__dirname, "..", "..", "..");
const read = (...p: string[]) => readFileSync(join(V2, ...p), "utf8");

describe("the legal entity", () => {
  it("is a Florida LLC under one name", () => {
    expect(LEGAL_NAME).toBe("Asolys LLC");
    expect(LEGAL_FORM).toMatch(/Florida/);
  });

  it("trades as PERM Tracker, said in one sentence on About and in the footer", () => {
    expect(TRADE_NAME).toBe("PERM Tracker");
    expect(TRADE_NAME_NOTE).toBe(
      `PERM Tracker is a trade name of Asolys LLC, a Florida company managed by immigration attorney ${SABRINA.name}.`,
    );
    expect(about).toContain("{TRADE_NAME_NOTE}");
    expect(footer).toContain("{TRADE_NAME_NOTE}");
  });

  it("never names the old entity on a binding or public surface, not even split across lines", () => {
    for (const [name, src] of Object.entries({ terms, privacy, about, methodology, trackers, emailLayout, footer, apiTerms, accessibility, editorial, settings })) {
      expect(src.replace(/\s+/g, " "), name).not.toMatch(/PERM Tracker LLC/);
    }
  });

  it("is said one way wherever a party is named", () => {
    expect(LEGAL_DBA).toBe("Asolys LLC, doing business as PERM Tracker");
  });

  it("is the party the Terms bind, under Florida law", () => {
    // "operated by" then a line break: without {" "} the page read "operated byAsolys LLC".
    expect(terms).toMatch(/operated by\{" "\}\s*\{LEGAL_DBA\}/);
    expect(terms).toMatch(/hold harmless \{LEGAL_DBA\}/);
    expect(terms).toMatch(/entire\s+agreement between you and \{LEGAL_NAME\}/);
    expect(terms.replace(/\s+/g, " ")).not.toMatch(/hold harmless PERM Tracker|between you and PERM Tracker/);
    expect(terms).toContain("State of Florida");
    expect(terms).toMatch(/courts located in Florida/);
    expect(terms).not.toContain("District of Columbia");
  });

  it("is named on the About page from the constant, not retyped", () => {
    expect(about).toMatch(/\{TRADE_NAME_NOTE\} \{LEGAL_NAME\} is the party named in the/);
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
      expect(page).toMatch(/<strong>Operator:<\/strong> \{`\$\{LEGAL_DBA\}, \$\{LEGAL_FORM\}`\}/);
      expect(page).toMatch(/<strong>Mailing address:<\/strong> \{POSTAL_ADDRESS\}/);
      expect(page).not.toMatch(/Washington, DC|DC 20001/);
    }
    expect(privacy).toMatch(/operated by \{LEGAL_NAME\}/);
    expect(privacy).toMatch(/doing business as \{TRADE_NAME\}/);
    expect(privacy).toMatch(/controller of the personal information/);
  });

  it("is named the same way on every other page and file that names an operator", () => {
    expect(apiTerms).toMatch(/provided by \{LEGAL_DBA\}/);
    expect(apiTerms).toMatch(/Operator: \{`\$\{LEGAL_DBA\}, \$\{LEGAL_FORM\}`\}/);
    expect(apiTerms).toMatch(/Mailing address: \{POSTAL_ADDRESS\}/);
    expect(accessibility).toContain("Operated by {LEGAL_DBA}.");
    expect(editorial).toContain("{LEGAL_DBA}, runs the site");
    expect(llms).toContain("- Run by: ${LEGAL_DBA}, ${LEGAL_FORM}.");
    expect(footer).toContain("&copy; {year} {LEGAL_DBA}");
    expect(settings).toContain("${LEGAL_DBA}");
    expect(articleSeo).toMatch(/"@id": SCHEMA_IDS\.organization\(BASE_URL\)/);
    expect(articleSeo).toMatch(/legalName: LEGAL_NAME/);
    for (const f of [["..", "LICENSE"], ["sdk", "LICENSE"], ["sdk-python", "LICENSE"], ["claude-plugin", "LICENSE"]]) {
      expect(read(...f), f.join("/")).toContain(`Copyright (c) 2026 ${LEGAL_DBA}`);
    }
    expect(JSON.parse(read("sdk", "package.json")).author).toContain(LEGAL_DBA);
    expect(read("sdk-python", "pyproject.toml")).toContain(`name = "${LEGAL_DBA}"`);
    expect(JSON.parse(read("claude-plugin", ".claude-plugin", "plugin.json")).author.name).toBe(LEGAL_DBA);
    expect(JSON.parse(read("claude-plugin", ".claude-plugin", "marketplace.json")).owner.name).toBe(LEGAL_DBA);
  });

  it("is the name the morning trust check looks for", () => {
    // Python can't import the constant, so audit_trust.py types it; this holds the two equal.
    const py = read("scripts", "audit_trust.py").match(/^LEGAL_NAME = "([^"]+)"$/m)?.[1];
    expect(py).toBe(LEGAL_NAME);
  });

  it("ends every plain-text email with the company and its address", () => {
    expect(TEXT_LEGAL_LINE).toBe(`${LEGAL_DBA}, ${POSTAL_ADDRESS}`);
    const files = ["caseAlerts", "bulletinAlerts", "queueAlerts", "employerAlerts", "pipelineMatches", "alertOutbox",
      "digestSignup", "emailPrefs", "firmClaims", "webhookDelivery", "supportEmail"];
    for (const f of files) {
      const src = read("convex", `${f}.ts`);
      const signoffs = (src.match(/^\s*"PERM Tracker",\s*$/gm) ?? []).length;
      const lines = (src.match(/TEXT_LEGAL_LINE/g) ?? []).length - 1; // less the import
      expect(lines, f).toBeGreaterThanOrEqual(Math.max(signoffs, 1));
    }
  });

  it("owns the copyright every email carries", () => {
    expect(emailLayout).toMatch(/&copy; \{`\$\{new Date\(\)\.getFullYear\(\)\} \$\{LEGAL_NAME\}`\}/);
    expect(emailLayout).toContain("{`${LEGAL_DBA}, ${POSTAL_ADDRESS}`}");
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
