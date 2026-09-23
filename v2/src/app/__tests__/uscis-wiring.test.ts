import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source-level gates for the USCIS page's wiring: the things that are true
 * across three files and would each fail silently if one drifted.
 *
 *   1. The DOL lookup page RECOGNISES a USCIS receipt and redirects it to the
 *      USCIS page, and does so BEFORE the DOL shape checks, or a receipt is
 *      reported as a bad PERM number.
 *   2. The DOL form hints the same thing before the round trip.
 *   3. The USCIS page links the privacy anchor the coordinator created, and
 *      that anchor exists.
 *   4. The storage table holds ONLY the columns section 18 names. A column
 *      the policy does not mention is a policy that is wrong, and nothing
 *      else would catch it.
 */

const ROOT = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const DOL_PAGE = "(site)/(public)/perm-case-status/page.tsx";
const USCIS_PAGE = "(site)/(public)/uscis-case-status/page.tsx";
const PRIVACY = "(site)/(public)/privacy/page.tsx";
const DOL_FORM = "../components/tools/CaseLookupForm.tsx";
const STORAGE = "../lib/turso/uscisCaseStatus.ts";

/** The page function's body only, so a mention elsewhere cannot satisfy an ordering assertion. */
function pageBody(src: string): string {
  const start = src.indexOf("export default async function");
  expect(start).toBeGreaterThan(0);
  return src.slice(start);
}

describe("the DOL page routes a USCIS receipt away", () => {
  const src = read(DOL_PAGE);
  const body = pageBody(src);

  it("imports the receipt normaliser and Next's redirect", () => {
    expect(src).toMatch(/import \{[^}]*normaliseReceipt[^}]*\} from "@\/lib\/uscis\/receipt"/);
    expect(src).toMatch(/import \{ redirect \} from "next\/navigation"/);
  });

  it("redirects a receipt to /uscis-case-status BEFORE any DOL shape check", () => {
    const redirectAt = body.indexOf("redirect(`/uscis-case-status?receipt=");
    const pwdAt = body.indexOf("normalisePwdCaseNumber(");
    const permAt = body.indexOf("normaliseCaseNumber(");
    expect(redirectAt).toBeGreaterThan(0);
    expect(pwdAt).toBeGreaterThan(redirectAt);
    expect(permAt).toBeGreaterThan(redirectAt);
  });

  it("offers the USCIS page on a half-typed receipt", () => {
    expect(body).toMatch(/looksLikeReceipt\(typed\)/);
    expect(body).toContain('href="/uscis-case-status"');
  });

  it("the DOL form says the same before submit", () => {
    const form = read(DOL_FORM);
    expect(form).toMatch(/looksLikeReceipt\(value\)/);
    expect(form).toMatch(/USCIS receipt number/);
  });
});

describe("the USCIS page and the privacy policy agree", () => {
  it("links the policy anchor, and the anchor exists", () => {
    const page = read(USCIS_PAGE);
    const privacy = read(PRIVACY);
    expect(page).toContain('href="/privacy#uscis-case-status"');
    expect(privacy).toContain('id="uscis-case-status"');
  });

  it("points back at the DOL page for a DOL number", () => {
    const page = read(USCIS_PAGE);
    expect(page).toContain("/perm-case-status?case=");
  });

  it("stores only the columns section 18 names", () => {
    const storage = read(STORAGE);
    const ddl = /CREATE TABLE IF NOT EXISTS uscis_case_status \(([\s\S]*?)\)`/.exec(storage);
    expect(ddl).not.toBeNull();
    const columns = ddl![1]!
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter((c): c is string => Boolean(c) && c !== ")");
    // The policy: receipt number, form type, status text (USCIS's short and
    // long text, and the two dates USCIS returns with it), the dated history,
    // and the time of the lookup (first, last, last change, last read).
    const allowed = new Set([
      "receipt",
      "form_type",
      "status_text",
      "status_desc",
      "submitted_at",
      "modified_at",
      "history_json",
      "seen_at",
      "first_seen_at",
      "last_change_at",
      "last_read_at",
    ]);
    const extra = columns.filter((c) => !allowed.has(c));
    expect(extra, "a column the privacy policy does not name").toEqual([]);
    expect(columns).toContain("receipt");
    expect(columns).toContain("form_type");
    expect(columns).toContain("history_json");
  });

  it("retention in code is the twelve months the policy states", () => {
    const storage = read(STORAGE);
    expect(storage).toMatch(/RETENTION_MS = 365 \* 24 \* 60 \* 60 \* 1000/);
    const privacy = read(PRIVACY);
    const section = privacy.slice(privacy.indexOf('id="uscis-case-status"'));
    expect(section).toMatch(/twelve months after the last lookup/);
  });
});
