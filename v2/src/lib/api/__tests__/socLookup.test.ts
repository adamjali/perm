import { beforeEach, describe, expect, it, vi } from "vitest";

// The keyless SOC lookup: a malformed query is refused before any limit or read, a known title
// answers with its codes and shares, nothing matched is a 404 that names the finder, and a table
// not loaded yet is a 503, never an empty 200.

const countCall = vi.fn();
const findSoc = vi.fn();
const getSocCodes = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ exec: vi.fn(), rows: vi.fn() }));
vi.mock("@/lib/db/socTitles", () => ({
  findSoc: (...a: unknown[]) => findSoc(...a),
  getSocCodes: (...a: unknown[]) => getSocCodes(...a),
}));
vi.mock("../usage", async (importOriginal) => {
  const real = await importOriginal<typeof import("../usage")>();
  return { ...real, countCall: (...a: unknown[]) => countCall(...a) };
});

import { resetUsageMemoryForTests } from "../usage";
import { GET } from "@/app/v1/lookup/soc/route";

function req(url: string): Request {
  const h: Record<string, string> = { "x-real-ip": "203.0.113.9" };
  return { url, method: "GET", headers: { get: (n: string) => h[n.toLowerCase()] ?? null } } as unknown as Request;
}
const get = (q: string | null) =>
  GET(req(`https://permtracker.app/v1/lookup/soc${q === null ? "" : `?q=${encodeURIComponent(q)}`}`));

const CODES = { spans: { perm: { from: "2023-10-01", to: "2026-06-30" } }, pageMin: 50, codes: new Map() };
const DS = {
  query: "data scientist",
  code: null,
  titles: [
    {
      key: "data scientist",
      title: "Data Scientist",
      total: 1000,
      slug: "data-scientist",
      codes: [{ soc: "15-2051", codeTitle: "Data Scientists", filings: 861, share: 0.86123, perm: 1, pwd: 2, lca: 3, onet: true, slug: null, zone: 4, spellings: [], becameCodes: [] }],
    },
  ],
  codes: [],
};

beforeEach(() => {
  resetUsageMemoryForTests();
  countCall.mockReset();
  findSoc.mockReset().mockResolvedValue(DS);
  getSocCodes.mockReset().mockResolvedValue(CODES);
});

describe("GET /v1/lookup/soc", () => {
  it("answers a title with its codes and shares, dated and pointed at the finder", async () => {
    const res = await get("data scientist");
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.titles[0]).toEqual({
      title: "Data Scientist",
      filings: 1000,
      codes: [{ soc: "15-2051", title: "Data Scientists", filings: 861, share: 0.861, onetLists: true, became: [] }],
    });
    expect(j.meta).toMatchObject({ asOf: "2026-06-30", url: "https://permtracker.app/soc-codes?q=data%20scientist" });
    expect(countCall).toHaveBeenCalledExactlyOnceWith("anonymous", "soc");
  });

  it("refuses a missing or oversized query before any read, and doesn't count it", async () => {
    for (const q of [null, "x", "y".repeat(81)]) expect((await get(q)).status).toBe(400);
    expect(findSoc).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("says nothing matched with a 404, and a table not loaded with a 503", async () => {
    findSoc.mockResolvedValue({ query: "zzqx", code: null, titles: [], codes: [] });
    expect((await get("zzqx")).status).toBe(404);
    getSocCodes.mockResolvedValue(null);
    expect((await get("data scientist")).status).toBe(503);
  });
});
