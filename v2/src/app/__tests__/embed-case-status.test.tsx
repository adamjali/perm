import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const referer = { value: null as string | null };
vi.mock("next/headers", () => ({
  headers: async () => new Headers(referer.value ? { referer: referer.value } : {}),
}));

const lookupForEmbed = vi.fn();
vi.mock("@/lib/turso/embedLookup", () => ({
  lookupForEmbed: (...a: unknown[]) => lookupForEmbed(...a),
}));

import Page from "../embed/case-status/page";
import type { EmbedCaseAnswer } from "@/lib/turso/embedLookup";

/**
 * The embedded lookup's page: which site it charges, and that every answer
 * says where it came from, a spent cap included.
 */

const CN = "G-100-26125-868956";
const answer = (over: Partial<EmbedCaseAnswer>): EmbedCaseAnswer => ({
  caseNumber: CN,
  program: "perm",
  found: true,
  status: "ANALYST REVIEW",
  filingDate: "2026-05-05",
  decisionDate: null,
  employerName: "ACME ROBOTICS LLC",
  jobTitle: "Software Developer",
  source: "dol-now",
  checkedAt: "2026-09-26T15:00:00Z",
  capped: false,
  ...over,
});

async function html(sp: { case?: string; site?: string }) {
  return renderToStaticMarkup(await Page({ searchParams: Promise.resolve(sp) }));
}

beforeEach(() => {
  referer.value = null;
  lookupForEmbed.mockReset().mockResolvedValue(answer({}));
});

describe("/embed/case-status", () => {
  it("charges the embedding site named by the Referer and carries it into the form", async () => {
    referer.value = "https://www.lawfirm.example/perm-help/";
    const out = await html({ case: CN, site: "spoof.example" });
    expect(lookupForEmbed).toHaveBeenCalledWith(CN, "lawfirm.example");
    expect(out).toContain('name="site" value="lawfirm.example"');
  });

  it("asks nothing on an empty form", async () => {
    const out = await html({});
    expect(lookupForEmbed).not.toHaveBeenCalled();
    expect(out).toContain("DOL case number");
  });

  it("says a live answer came from DOL, and links the full record", async () => {
    const out = await html({ case: CN });
    expect(out).toContain("Analyst Review");
    expect(out).toContain("Read from DOL just now.");
    expect(out).toContain(`href="/perm-case-status?case=${CN}"`);
  });

  it("says when a spent cap means the answer is the stored record", async () => {
    lookupForEmbed.mockResolvedValue(answer({ source: "stored", capped: true, checkedAt: "2026-09-26T08:30:00Z" }));
    const out = await html({ case: CN });
    expect(out).toContain("Live checks from this site are used up for today, so this is PERM Tracker&#x27;s record, last checked with DOL Sep 26, 2026.");
  });

  it("tells a typo from a miss", async () => {
    lookupForEmbed.mockResolvedValue(null);
    expect(await html({ case: "hello" })).toContain("isn&#x27;t a DOL case number");
    lookupForEmbed.mockResolvedValue(answer({ found: false, status: null, source: null, capped: true }));
    expect(await html({ case: CN })).toContain("live checks with DOL from this site are used up for today");
  });
});
