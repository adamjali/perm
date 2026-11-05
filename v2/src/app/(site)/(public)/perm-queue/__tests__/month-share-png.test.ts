/**
 * The month's share picture: a real PNG at its stated size, the six-hour
 * window the page keeps, a 404 where the page 404s, and no answer at all
 * (a throw, so the last good picture stays) when the census can't be read.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const census = vi.hoisted(() => ({ get: vi.fn(), backlog: vi.fn(), line: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/liveCensus", () => ({ getLiveCensus: census.get }));
vi.mock("@/lib/db/backlog", () => ({ getMonthBacklog: census.backlog }));
vi.mock("@/lib/db/permLine", () => ({ getPermLine: census.line }));

import { GET, dynamic, revalidate, generateStaticParams } from "../[month]/share.png/route";

const call = (month: string) => GET(new Request(`https://permtracker.app/perm-queue/${month}/share.png`), { params: Promise.resolve({ month }) });

const RENDER_MS = 60_000;

describe("GET /perm-queue/<month>/share.png", () => {
  beforeEach(() => {
    census.get.mockReset();
    census.backlog.mockReset();
    census.line.mockReset();
    census.get.mockResolvedValue({ asOf: "2026-11-05", matrix: [], totalCases: 0, noFilingDate: 0, source: "", computedAt: 0 });
    census.line.mockResolvedValue({ month: "2026-01", total: 15000, decided: 9000, asOf: "2026-11-05" });
    census.backlog.mockResolvedValue({
      month: "2026-02",
      total: 20000,
      decided: 8200,
      statuses: [
        { status: "CERTIFIED", count: 7000, isFinal: true },
        { status: "DENIED", count: 200, isFinal: true },
        { status: "WITHDRAWN", count: 1000, isFinal: true },
        { status: "ANALYST REVIEW", count: 11000, isFinal: false },
        { status: "APPLICATION ON HOLD", count: 800, isFinal: false },
      ],
    });
  });

  it("keeps the page's own window, built on first request", async () => {
    expect(dynamic).toBe("force-static");
    expect(revalidate).toBe(21600);
    expect(generateStaticParams()).toEqual([]);
  });

  it(
    "draws the month as a 1200 by 630 PNG that browsers re-check and Cloudflare keeps six hours",
    async () => {
      const res = await call("2026-02");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      // s-maxage is what nginx turns into max-age=0 for browsers ($pt_browser_cc).
      expect(res.headers.get("Cache-Control")).toContain("s-maxage=21600");
      expect(res.headers.get("Cache-Control")).not.toContain("immutable");
      const bytes = Buffer.from(await res.arrayBuffer());
      const meta = await sharp(bytes).metadata();
      expect(meta.format).toBe("png");
      expect([meta.width, meta.height]).toEqual([1200, 630]);
      // Flat colour: small enough to post anywhere.
      expect(bytes.byteLength).toBeLessThan(300_000);
      expect(census.backlog).toHaveBeenCalledWith("2026-02");
    },
    RENDER_MS,
  );

  it("answers 404 for a month that isn't one, before reading anything", async () => {
    const res = await call("2026-13");
    expect(res.status).toBe(404);
    expect(census.backlog).not.toHaveBeenCalled();
  });

  it("answers 404 for a month with no cases, as the page does", async () => {
    census.backlog.mockResolvedValue({ month: "2031-01", total: 0, decided: 0, statuses: [] });
    expect((await call("2031-01")).status).toBe(404);
    census.backlog.mockResolvedValue(null);
    expect((await call("2031-02")).status).toBe(404);
  });

  it("throws rather than caching an undated picture when the census can't be read", async () => {
    census.get.mockResolvedValue(null);
    await expect(call("2026-02")).rejects.toThrow(/census/);
  });
});
