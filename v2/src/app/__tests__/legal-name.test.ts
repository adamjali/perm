import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { DISAMBIGUATION, LEGAL_DBA, LEGAL_FORM, LEGAL_NAME, PEOPLE, POSTAL_ADDRESS, TRADE_NAME } from "@/lib/constants/about";
import { TEXT_LEGAL_LINE } from "@convex/lib/textFooter";
import { getOrganizationSchema } from "@/lib/structuredData";

/**
 * The company is named where the law needs a party, and PERM Tracker everywhere else.
 *
 * On 2026-09-22 the Terms bound "PERM Tracker LLC" under the laws of the District of Columbia while the LLC was
 * being formed in Florida. On 2026-10-08 it was renamed ASOLYS LLC (Sunbiz L26000495521, read Oct 30), and on
 * Oct 31 the legal name went onto every footer, licence and package, until the owner's call the same evening:
 * "only put Asolys where actually needed use PERM Tracker wherever possible". It stays in the three binding
 * documents (the Terms, the Privacy Policy and the API terms: their opening and their operator line) and in the
 * Organization's `legalName`. A copyright notice may use the name the public knows (17 U.S.C. 401(b)(3)), and
 * CAN-SPAM asks commercial mail for a postal address, not the legal name.
 */
const V2 = join(__dirname, "..", "..", "..");
const read = (...p: string[]) => readFileSync(join(V2, ...p), "utf8");
const PUBLIC = ["src", "app", "(site)", "(public)"];
const terms = read(...PUBLIC, "terms", "page.tsx");
const privacy = read(...PUBLIC, "privacy", "page.tsx");
const apiTerms = read(...PUBLIC, "api-terms", "page.tsx");
const llms = read("src", "app", "llms.txt", "route.ts");
const emailLayout = read("src", "emails", "components", "EmailLayout.tsx");
const footer = read("src", "components", "layout", "Footer.tsx");
const settings = read("src", "components", "settings", "SupportSection.tsx");

/** The only files outside the constant's own module that may name the company (tests aside). */
const ALLOWED = new Set([
  "src/app/(site)/(public)/terms/page.tsx",
  "src/app/(site)/(public)/privacy/page.tsx",
  "src/app/(site)/(public)/api-terms/page.tsx",
  "src/lib/structuredData.ts",
  "src/lib/constants/about.ts",
  // Python can't import the constant; held equal below.
  "scripts/audit_trust.py",
  // Instructions for the store listing, where the trader's legal name is the law's question.
  "extension/STORE.md",
]);
/**
 * The project's history (moved word for word from the CLAUDE.md files on Nov 7 2026) records the rename and the
 * decision about where the name may appear. It's a record, never shown on the site, as the CLAUDE.md files it came
 * from were never scanned.
 */
const ALLOWED_DIRS = ["docs/notes/"];
const SCAN = ["src", "convex", "scripts", "sdk", "sdk-python", "claude-plugin", "extension", "docs", "workers"];
const SKIP_DIRS = new Set(["node_modules", "_generated", "dist", ".next", "__pycache__", "__fixtures__", "fixtures"]);
const TEXT = /\.(tsx?|mjs|cjs|js|py|md|json|toml|txt)$|(^|\/)LICENSE$/;
// "Asolys" in any capitals, or the two constants by name. DOL's WHD file has columns named LEGAL_NAME and
// legal_name, so the constant counts only in its own capitals and outside quotes.
const NAMES = /[Aa][Ss][Oo][Ll][Yy][Ss]|\bLEGAL_DBA\b|(?<!["'])\bLEGAL_NAME\b(?!["'])/;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* files(full);
    else yield full;
  }
}

describe("the legal entity", () => {
  it("is a Florida LLC trading as PERM Tracker", () => {
    expect(LEGAL_NAME).toBe("Asolys LLC");
    expect(LEGAL_FORM).toMatch(/Florida/);
    expect(TRADE_NAME).toBe("PERM Tracker");
    expect(LEGAL_DBA).toBe("Asolys LLC, doing business as PERM Tracker");
  });

  it("is named only in the binding documents and the Organization's legalName", () => {
    const named: string[] = [];
    let scanned = 0;
    const roots = [...SCAN.map((d) => join(V2, d)), join(V2, "..", "LICENSE")];
    for (const root of roots) {
      const list = statSync(root).isDirectory() ? [...files(root)] : [root];
      for (const f of list) {
        const rel = relative(V2, f).split("\\").join("/");
        if (!TEXT.test(rel) || /(^|\/)__tests__\/|\.test\.|(^|\/)test_[^/]+\.py$/.test(rel)) continue;
        scanned += 1;
        if (NAMES.test(readFileSync(f, "utf8")) && !ALLOWED.has(rel) && !ALLOWED_DIRS.some((d) => rel.startsWith(d))) named.push(rel);
      }
    }
    // A scan that read nothing would pass anything.
    expect(scanned).toBeGreaterThan(1500);
    expect(named).toEqual([]);
  });

  it("never names the old entity, not even split across lines", () => {
    for (const [name, src] of Object.entries({ terms, privacy, apiTerms, emailLayout, footer, settings, llms })) {
      expect(src.replace(/\s+/g, " "), name).not.toMatch(/PERM Tracker LLC/);
    }
  });

  it("is the party the Terms bind, under Florida law", () => {
    // "operated by" then a line break: without {" "} the page read "operated byAsolys LLC".
    expect(terms).toMatch(/operated by\{" "\}\s*\{LEGAL_DBA\}/);
    expect(terms.replace(/\s+/g, " ")).toMatch(/hold harmless PERM Tracker and its operators/);
    expect(terms.replace(/\s+/g, " ")).toMatch(/agreement between you and us regarding the Service/);
    expect(terms).toContain("State of Florida");
    expect(terms).toMatch(/courts located in Florida/);
    expect(terms).not.toContain("District of Columbia");
  });

  it("is the operator all three legal pages name, at the address filed with Florida", () => {
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
    expect(apiTerms).toMatch(/provided by \{LEGAL_DBA\}/);
    expect(apiTerms).toMatch(/Operator: \{`\$\{LEGAL_DBA\}, \$\{LEGAL_FORM\}`\}/);
    expect(apiTerms).toMatch(/Mailing address: \{POSTAL_ADDRESS\}/);
  });

  it("is the Organization node's legalName, under the brand's name", () => {
    const org = getOrganizationSchema("https://permtracker.app") as { legalName?: string; name: string };
    expect(org.legalName).toBe(LEGAL_NAME);
    expect(org.name).toBe(TRADE_NAME);
  });

  it("leaves the brand on everything else", () => {
    expect(footer).toContain("&copy; {year} PERM Tracker");
    expect(settings).toContain("&copy; {`${currentYear} PERM Tracker`}");
    expect(emailLayout).toContain("&copy; {`${new Date().getFullYear()} PERM Tracker`}");
    expect(emailLayout).toContain("{`PERM Tracker, ${POSTAL_ADDRESS}`}");
    expect(llms).toContain("- Run by: PERM Tracker.");
    for (const f of [["..", "LICENSE"], ["sdk", "LICENSE"], ["sdk-python", "LICENSE"], ["claude-plugin", "LICENSE"]]) {
      expect(read(...f), f.join("/")).toContain("Copyright (c) 2026 PERM Tracker");
    }
    expect(JSON.parse(read("sdk", "package.json")).author).toMatch(/^PERM Tracker /);
    expect(read("sdk-python", "pyproject.toml")).toContain('name = "PERM Tracker"');
    expect(JSON.parse(read("claude-plugin", ".claude-plugin", "plugin.json")).author.name).toBe(TRADE_NAME);
    expect(JSON.parse(read("claude-plugin", ".claude-plugin", "marketplace.json")).owner.name).toBe(TRADE_NAME);
  });

  it("is the name the morning trust check looks for on the binding documents", () => {
    // Python can't import the constant, so audit_trust.py types it; this holds the two equal.
    const py = read("scripts", "audit_trust.py");
    expect(py.match(/^LEGAL_NAME = "([^"]+)"$/m)?.[1]).toBe(LEGAL_NAME);
    expect(py).toMatch(/^LEGAL_PAGES = \("\/terms", "\/privacy", "\/api-terms"\)$/m);
  });

  it("ends every plain-text email with the sender and its postal address", () => {
    expect(TEXT_LEGAL_LINE).toBe(`${TRADE_NAME}, ${POSTAL_ADDRESS}`);
    const sources = ["caseAlerts", "bulletinAlerts", "queueAlerts", "employerAlerts", "pipelineMatches", "alertOutbox",
      "digestSignup", "emailPrefs", "firmClaims", "webhookDelivery", "supportEmail"];
    for (const f of sources) {
      const src = read("convex", `${f}.ts`);
      const signoffs = (src.match(/^\s*"PERM Tracker",\s*$/gm) ?? []).length;
      const lines = (src.match(/TEXT_LEGAL_LINE/g) ?? []).length - 1; // less the import
      expect(lines, f).toBeGreaterThanOrEqual(Math.max(signoffs, 1));
    }
  });

  it("tells the site apart from others with similar names without naming a person", () => {
    // schema.org disambiguatingDescription: the domain, the place and the source, which no similarly named
    // site can claim together.
    expect(DISAMBIGUATION).toContain("permtracker.app");
    expect(DISAMBIGUATION).toContain("Florida");
    expect(DISAMBIGUATION).toMatch(/Department of Labor's own case records/);
    for (const p of PEOPLE) expect(DISAMBIGUATION).not.toContain(p.name.split(" ")[0]);
    const org = getOrganizationSchema("https://permtracker.app") as { disambiguatingDescription?: string };
    expect(org.disambiguatingDescription).toBe(DISAMBIGUATION);
    expect(llms).toMatch(/^\s+DISAMBIGUATION,$/m);
  });
});
