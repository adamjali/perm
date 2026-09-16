import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { PolicyNotice } from "@/lib/turso/policyNotices";

vi.mock("@/lib/turso/policyNotices", () => ({ listPolicyNotices: vi.fn() }));
// Reads Turso for the freshness line; not what this file is about.
vi.mock("@/components/data/DataProvenance", () => ({
  DataProvenance: () => <div data-testid="provenance" />,
}));

import { listPolicyNotices } from "@/lib/turso/policyNotices";
import { POLICY_SHOTS } from "@/lib/policyShots";
import PolicyChangesPage from "../(site)/(public)/policy-changes/page";

function n(over: Partial<PolicyNotice> & { documentNumber: string; publicationDate: string }): PolicyNotice {
  return {
    type: "Rule",
    title: `Document ${over.documentNumber}`,
    abstract: "Lead sentence of the abstract. The rest of the abstract follows here.",
    url: `https://www.federalregister.gov/d/${over.documentNumber}`,
    agencies: ["Homeland Security Department"],
    topics: ["H-1B"],
    effectiveOn: null,
    commentsCloseOn: null,
    commentUrl: null,
    citation: null,
    action: null,
    dates: null,
    correctionOf: null,
    pdfUrl: null,
    ...over,
  };
}

/** A year past any of the fixture dates, so "in effect" and "closed" are stable whatever day the suite runs. */
const FIXTURE: PolicyNotice[] = [
  n({ documentNumber: "2026-16231", publicationDate: "2026-08-10", effectiveOn: "2026-09-09", citation: "91 FR 51360", action: "Final rule.", dates: "This rule is effective on September 9, 2026." }),
  n({ documentNumber: "2026-17324", publicationDate: "2026-08-25", type: "Proposed Rule", commentsCloseOn: "2026-09-24", commentUrl: "http://www.regulations.gov/commenton/USCIS-2026-0298-0001" }),
  n({ documentNumber: "C1-2026-17324", publicationDate: "2026-09-10", type: "Proposed Rule", correctionOf: "2026-17324", abstract: "", title: "Document 2026-17324" }),
  n({ documentNumber: "2026-05683", publicationDate: "2026-03-24", type: "Notice", topics: ["PERM"] }),
  n({ documentNumber: "oflc-2026-08-14-b4a68ec3", publicationDate: "2026-08-14", type: "OFLC announcement", agencies: ["Office of Foreign Labor Certification"], topics: ["perm", "disclosure-data"], title: "OFLC Releases Public Disclosure Data for Q3", url: "https://www.dol.gov/agencies/eta/foreign-labor/news" }),
  n({ documentNumber: "oflc-2026-08-14-2efc7ff2", publicationDate: "2026-08-14", type: "OFLC announcement", agencies: ["Office of Foreign Labor Certification"], topics: ["h-2b"], title: "OFLC Releases the H-2B Foreign Labor Recruiter List", url: "https://www.dol.gov/agencies/eta/foreign-labor/news" }),
  ...Array.from({ length: 10 }, (_, i) =>
    n({ documentNumber: `oflc-2019-0${i}`, publicationDate: `2019-0${(i % 9) + 1}-10`, type: "OFLC announcement", agencies: ["Office of Foreign Labor Certification"], topics: ["perm"], title: `Older OFLC announcement ${i}`, url: "https://www.dol.gov/agencies/eta/foreign-labor/news" }),
  ),
];

async function render(): Promise<string> {
  return renderToStaticMarkup(await PolicyChangesPage());
}

/** Pixel size from a WebP's own header (VP8, VP8L or VP8X chunk). */
function webpSize(buf: Buffer): { w: number; h: number } {
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (chunk === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
  }
  return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
}

describe("/policy-changes", () => {
  beforeEach(() => {
    vi.mocked(listPolicyNotices).mockResolvedValue(FIXTURE);
    // The page reads the clock for "days left" and "in effect since". Pinned
    // past every fixture date so the assertions below hold on any day the
    // suite runs, and restored per file so the clock never reaches a neighbour.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-15T17:00:00Z"));
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it("keeps a heading outline with no skipped level, document titles as h3 inside their summary", async () => {
    const html = await render();
    const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
    expect(html).toMatch(/<summary[^>]*>[\s\S]*?<h3[^>]*>Document 2026-16231<\/h3>/);
  });

  it("collapses every row: no <details> renders open", async () => {
    const html = await render();
    expect((html.match(/<details/g) ?? []).length).toBeGreaterThan(5);
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
  });

  it("states the date that matters on the row: in effect, and comments closed", async () => {
    const html = await render();
    expect(html).toContain("In effect since Sep 9, 2026");
    expect(html).toContain("Comments closed Sep 24, 2026");
    // The DATES paragraph is kept verbatim in the body, and the citation with it.
    expect(html).toContain("This rule is effective on September 9, 2026.");
    expect(html).toContain("91 FR 51360");
  });

  it("folds a correction into the document it corrects instead of listing it", async () => {
    const html = await render();
    expect(html).not.toContain('id="doc-C1-2026-17324"');
    expect(html).toContain("corrected Sep 10, 2026");
    expect(html).toContain("Correction of Sep 10, 2026");
  });

  it("lists OFLC announcements on this site's programs and only COUNTS the H-2 ones", async () => {
    const html = await render();
    expect(html).toContain("OFLC Releases Public Disclosure Data for Q3");
    expect(html).not.toContain("H-2B Foreign Labor Recruiter List");
    expect(html).toContain("1 more on H-2A, H-2B and CW-1");
    // Eight rows lead (the 2026 one and seven from 2019); the other three
    // 2019 announcements are still in the DOM, folded under their year.
    expect((html.match(/Older OFLC announcement \d/g) ?? []).length).toBe(10);
    expect(html).toMatch(/<summary[^>]*>[\s\S]*?2019[\s\S]*?3 announcements/);
  });

  it("draws the strip with one mark per document in the window and a today line", async () => {
    const html = await render();
    expect(html).toContain("<title>Proposed Rule, Aug 25, 2026: Document 2026-17324 </title>");
    // Not links: an 11px square on a phone is no tap target, so the marks
    // name their document and the list below is the navigation. Scoped to
    // the strip's own <svg>; the page has other svgs and other links.
    const strip = html.match(/<svg[^>]*role="img"[\s\S]*?<\/svg>/)?.[0] ?? "";
    expect(strip.length).toBeGreaterThan(500);
    expect(strip).not.toContain("<a ");
    expect(html).toMatch(/>today\s*<\/text>/);
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Documents from /);
  });

  it("every capture in the manifest is a real file whose pixel size the page declares", () => {
    const entries = Object.entries(POLICY_SHOTS);
    expect(entries.length).toBeGreaterThan(10);
    for (const [num, { w, h }] of entries) {
      const file = join(process.cwd(), "public/images/policy", `${num}.webp`);
      expect(existsSync(file), `${num}.webp is missing`).toBe(true);
      const buf = readFileSync(file);
      expect(buf.toString("ascii", 8, 12)).toBe("WEBP");
      expect(webpSize(buf), num).toEqual({ w, h });
    }
  });

  it("renders a figure only for a document that has a capture", async () => {
    const html = await render();
    // 2026-16231 is a real capture; the fixture's proposed rule number is real too,
    // so both get a figure, and the notice keeps one only if its file exists.
    // next/image rewrites the src through its loader (URL-encoded), so match
    // the file name rather than the path.
    const has = (num: string) => html.includes(`${num}.webp`);
    expect(has("2026-16231")).toBe(num_in_manifest("2026-16231"));
    expect(has("oflc-2026-08-14-b4a68ec3")).toBe(false);
  });

  it("leaves no word glued to the next across an element boundary", async () => {
    const html = await render();
    // A word character, one closing tag, one opening tag, a word character:
    // the shape the rendered audit counts. Two closing tags in a row are
    // covered by the rendered audit against the dev server.
    const glued = html.match(/[A-Za-z0-9]<\/[a-z0-9]+><[a-z][^>]*>[A-Za-z0-9]/g) ?? [];
    expect(glued, glued.slice(0, 5).join(" | ")).toEqual([]);
  });

  it("renders the empty state, with the Register's own search, when nothing is held", async () => {
    vi.mocked(listPolicyNotices).mockResolvedValue([]);
    const html = await render();
    expect(html).toContain("No documents are held yet");
    expect(html).not.toContain('aria-label="Documents from');
  });
});

function num_in_manifest(num: string): boolean {
  return num in POLICY_SHOTS;
}
