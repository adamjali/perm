import { afterEach, describe, expect, it, vi } from "vitest";

import { softFail } from "../softRead";

describe("softFail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the page's fallback and records the failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await Promise.reject(new Error("database is busy")).catch(softFail("testRead-a", null));
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("testRead-a failed");
    expect(String(warn.mock.calls[0]![0])).toContain("database is busy");
  });

  it("records one read's failures once per ten minutes, and each read on its own", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) await Promise.reject(new Error("x")).catch(softFail("testRead-b", []));
    await Promise.reject(new Error("y")).catch(softFail("testRead-c", 0));
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("passes a successful read through untouched", async () => {
    expect(await Promise.resolve(7).catch(softFail("testRead-d", 0))).toBe(7);
  });
});
