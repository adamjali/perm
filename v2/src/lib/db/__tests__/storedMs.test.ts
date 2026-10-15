import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../client", () => ({ rows: vi.fn(), one: vi.fn(), exec: vi.fn() }));

const { easternDate, storedMs } = await import("../predictions");

describe("storedMs", () => {
  it("reads integer milliseconds handed back as a string, as libSQL does", () => {
    const ms = Date.UTC(2026, 9, 9, 15, 0, 0);
    expect(storedMs(String(ms))).toBe(ms);
    expect(easternDate(storedMs(String(ms))!)).toBe("2026-10-09");
  });

  it("reads a number, an ISO time, and gives null for nothing or nonsense", () => {
    expect(storedMs(1_760_000_000_000)).toBe(1_760_000_000_000);
    expect(storedMs("2026-10-09T15:00:00Z")).toBe(Date.UTC(2026, 9, 9, 15));
    expect(storedMs(null)).toBeNull();
    expect(storedMs("")).toBeNull();
    expect(storedMs("not a time")).toBeNull();
  });
});
