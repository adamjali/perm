import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMBASSIES, embassyForPost, embassyVisasUrl, noticeRange, shortExcerpt } from "@/lib/consular/embassies";

vi.mock("server-only", () => ({}));
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ rows, one: vi.fn(), exec: vi.fn() }));

const { getEmbassyNotices } = await import("../consularPosts");

describe("the embassies this site reads", () => {
  it("names twenty, each speaking for consulates keyed as the consulate pages are", () => {
    expect(EMBASSIES).toHaveLength(20);
    for (const e of EMBASSIES) {
      expect(e.posts.length).toBeGreaterThan(0);
      for (const p of e.posts) expect(p).toBe(p.trim().toLowerCase());
    }
  });

  it("finds a consulate's embassy, and none for a consulate it doesn't read", () => {
    expect(embassyForPost("manila")?.code).toBe("ph");
    expect(embassyForPost("Ciudad Juarez")?.code).toBe("mx");
    expect(embassyForPost("reykjavik")).toBeNull();
  });

  it("links the category page whose feed is read", () => {
    expect(embassyVisasUrl(embassyForPost("manila")!)).toBe("https://ph.usembassy.gov/category/visas/");
  });

  it("an embassy's range holds its own numbers and no other's", () => {
    const [lo, hi] = noticeRange(embassyForPost("manila")!);
    const inside = (n: string) => n >= lo && n < hi;
    expect(inside("embassy-ph-august-18-consular-operations-update")).toBe(true);
    // "ph" must not take "phx" or the code before it.
    expect(inside("embassy-phx-notice")).toBe(false);
    expect(inside("embassy-pk-notice")).toBe(false);
  });
});

describe("shortExcerpt", () => {
  const manila =
    "The U.S. Embassy canceled all U.S. citizen services and visa appointments scheduled tomorrow, August 18, 2026, due to the ongoing impact of heavy rainfall on Embassy facilities and surrounding areas. For U.S. citizens and visa applicants who have scheduled appointments tomorrow at the Embassy, please check your registered email address.";

  it("keeps whole sentences that fit", () => {
    expect(shortExcerpt(manila)).toBe(
      "The U.S. Embassy canceled all U.S. citizen services and visa appointments scheduled tomorrow, August 18, 2026, due to the ongoing impact of heavy rainfall on Embassy facilities and surrounding areas.",
    );
  });

  it("doesn't end a sentence at an abbreviation's period (U.S. Embassy)", () => {
    expect(shortExcerpt(manila).endsWith("U.S.")).toBe(false);
    const mid = `Appointments for applicants are rescheduled while the building is repaired after the storm by the U.S. Embassy staff ${"and contractors ".repeat(12)}today.`;
    expect(shortExcerpt(mid).endsWith("U.S.")).toBe(false);
    expect(shortExcerpt(mid).endsWith("...")).toBe(true);
  });

  it("cuts at a word with an ellipsis when no sentence ends in time, and leaves a short text alone", () => {
    const long = "word ".repeat(80).trim();
    const got = shortExcerpt(long);
    expect(got.endsWith("word...")).toBe(true);
    expect(got.length).toBeLessThanOrEqual(263);
    expect(shortExcerpt("Limited visa processing is available.")).toBe("Limited visa processing is available.");
  });
});

describe("getEmbassyNotices", () => {
  beforeEach(() => {
    rows.mockReset();
  });

  it("reads one embassy's newest notices by the key's range", async () => {
    rows.mockResolvedValue([
      { title: "Consular Operations Update", html_url: "https://ph.usembassy.gov/x/", publication_date: "2026-11-03", abstract: "  Interviews resume Monday. " },
      { title: "Notice", html_url: "https://ph.usembassy.gov/y/", publication_date: "2026-10-01", abstract: "" },
    ]);
    const got = await getEmbassyNotices("manila");
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toContain("document_number >= ? AND document_number < ?");
    expect(sql).toContain("ORDER BY publication_date DESC");
    expect(args).toEqual(["embassy-ph-", "embassy-ph.", 5]);
    expect(got?.embassy.name).toBe("U.S. Embassy in the Philippines");
    expect(got?.notices).toEqual([
      { title: "Consular Operations Update", url: "https://ph.usembassy.gov/x/", day: "2026-11-03", excerpt: "Interviews resume Monday." },
      { title: "Notice", url: "https://ph.usembassy.gov/y/", day: "2026-10-01", excerpt: null },
    ]);
  });

  it("asks nothing for a consulate with no embassy feed", async () => {
    expect(await getEmbassyNotices("reykjavik")).toBeNull();
    expect(rows).not.toHaveBeenCalled();
  });

  it("a missing table is no notices, any other failure throws", async () => {
    rows.mockRejectedValueOnce(new Error("SQLITE_ERROR: no such table: policy_notices"));
    expect((await getEmbassyNotices("lagos"))?.notices).toEqual([]);
    rows.mockRejectedValueOnce(new Error("database query deadline"));
    await expect(getEmbassyNotices("lagos")).rejects.toThrow("database query deadline");
  });
});
