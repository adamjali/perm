import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The record of an employer with no PERM page. It reads the nightly
 * employer_other_index, falls back to the Oct 3 seasonal table until that
 * exists, reads a missing table as "no such employer" (a 404, not a 500), and
 * throws anything else, so a real employer never reads as a 404.
 */

vi.mock("server-only", () => ({}));
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
vi.mock("../client", () => ({ one, rows, exec: vi.fn() }));

const { otherEmployerRecord, getOtherEmployerSlugWindow, countOtherEmployerRanks } = await import("../otherEmployers");

beforeEach(() => {
  one.mockReset();
  rows.mockReset();
});

const row = {
  slug: "acme-robotics-llc", name: "Acme Robotics LLC", cases: "4", perm: "0", lca: "4", pwd: "0",
  h2a: "0", h2b: "0", cw1: "0", first_filed: "2024-09-01", last_changed: "2026-09-27",
};

describe("otherEmployerRecord", () => {
  it("reads the nightly index by the exact slug", async () => {
    one.mockResolvedValue(row);
    expect(await otherEmployerRecord("acme-robotics-llc")).toEqual({
      slug: "acme-robotics-llc", name: "Acme Robotics LLC", cases: 4, perm: 0, lca: 4, pwd: 0,
      h2a: 0, h2b: 0, cw1: 0, firstFiled: "2024-09-01", lastChanged: "2026-09-27",
    });
    expect(String(one.mock.calls[0]?.[0])).toContain("FROM employer_other_index WHERE slug = ?");
    expect(one.mock.calls[0]?.[1]).toEqual(["acme-robotics-llc"]);
  });

  it("answers from the Oct 3 seasonal table until the new one exists", async () => {
    one
      .mockRejectedValueOnce(new Error("SQLITE_ERROR: no such table: employer_other_index"))
      .mockResolvedValueOnce({ slug: "green-acres", name: "Green Acres Farm LLC", cases: "2", h2a: "2", h2b: "0", cw1: "0" });
    const r = await otherEmployerRecord("green-acres");
    expect(r).toMatchObject({ slug: "green-acres", cases: 2, h2a: 2, lca: 0, pwd: 0, perm: 0 });
    expect(String(one.mock.calls[1]?.[0])).toContain("FROM seasonal_employer_index WHERE slug = ?");
  });

  it("is null when neither table exists, so the slug stays a 404", async () => {
    one.mockRejectedValue(new Error("no such table"));
    await expect(otherEmployerRecord("nobody-1")).resolves.toBeNull();
  });

  it("throws any other failure, so a real employer never reads as a 404", async () => {
    one.mockRejectedValue(new Error("turso query deadline (20000ms, attempt 2)"));
    await expect(otherEmployerRecord("acme-robotics-llc-2")).rejects.toThrow(/deadline/);
  });
});

describe("the sitemap reads", () => {
  it("take a rank window, never an offset", async () => {
    rows.mockResolvedValue([{ slug: "a", last_changed: "2026-10-01" }]);
    expect(await getOtherEmployerSlugWindow(2, 5000)).toEqual([{ slug: "a", lastChanged: "2026-10-01" }]);
    expect(String(rows.mock.calls[0]?.[0])).toMatch(/FROM employer_other_index WHERE rank > \? AND rank <= \?/);
    expect(rows.mock.calls[0]?.[1]).toEqual([10000, 15000]);
  });

  it("count the family by its highest rank", async () => {
    one.mockResolvedValue({ n: "182132" });
    expect(await countOtherEmployerRanks()).toBe(182132);
  });
});
