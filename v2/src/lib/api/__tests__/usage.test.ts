import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exec = vi.fn();
const rows = vi.fn();
vi.mock("@/lib/turso/client", () => ({ exec: (...a: unknown[]) => exec(...a), rows: (...a: unknown[]) => rows(...a) }));

import { API_PLANS } from "@convex/lib/apiPlans";
import {
  checkAllowance,
  countCall,
  flushUsageForTests,
  resetUsageMemoryForTests,
  resetsIn,
  takeMinute,
  usageFor,
} from "../usage";

const NOW = new Date("2026-10-02T15:30:20Z");

beforeEach(() => {
  resetUsageMemoryForTests();
  exec.mockReset().mockResolvedValue(1);
  rows.mockReset().mockResolvedValue([]);
});
afterEach(() => resetUsageMemoryForTests());

describe("call counting", () => {
  it("writes pending calls in one upsert, adding to what's stored", async () => {
    countCall("acct_a", "KEY00001", NOW);
    countCall("acct_a", "KEY00001", NOW);
    countCall("acct_b", "KEY00002", NOW);
    await flushUsageForTests();
    const upsert = exec.mock.calls.find((c) => String(c[0]).startsWith("INSERT INTO api_usage"));
    expect(upsert).toBeDefined();
    expect(String(upsert![0])).toContain("ON CONFLICT (account, key_id, day) DO UPDATE SET calls = calls + excluded.calls");
    expect(upsert![1]).toEqual(["acct_a", "KEY00001", "2026-10-02", 2, "acct_b", "KEY00002", "2026-10-02", 1]);
  });

  it("keeps the counts when the write fails, and writes them next time", async () => {
    countCall("acct_a", "KEY00001", NOW);
    exec.mockImplementation((sql: string) => (sql.startsWith("INSERT") ? Promise.reject(new Error("down")) : Promise.resolve(0)));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await flushUsageForTests();
    exec.mockReset().mockResolvedValue(1);
    await flushUsageForTests();
    const upsert = exec.mock.calls.find((c) => String(c[0]).startsWith("INSERT INTO api_usage"));
    expect(upsert![1]).toEqual(["acct_a", "KEY00001", "2026-10-02", 1]);
    err.mockRestore();
  });

  it("adds calls not yet written to the stored totals", async () => {
    rows.mockResolvedValue([
      { day: "2026-10-01", calls: 40 },
      { day: "2026-10-02", calls: 5 },
    ]);
    countCall("acct_a", "KEY00001", NOW);
    expect(await usageFor("acct_a", NOW)).toEqual({ today: 6, month: 46 });
  });

  it("reads a missing table as no calls yet", async () => {
    rows.mockRejectedValue(new Error("SQLITE_ERROR: no such table: api_usage"));
    expect(await usageFor("acct_a", NOW)).toEqual({ today: 0, month: 0 });
  });
});

describe("allowances", () => {
  const free = API_PLANS.free;

  it("lets a call through under both limits", async () => {
    rows.mockResolvedValue([{ day: "2026-10-02", calls: free.perDay - 1 }]);
    expect((await checkAllowance("acct_a", free, NOW)).ok).toBe(true);
  });

  it("refuses at the day's limit until midnight UTC", async () => {
    rows.mockResolvedValue([{ day: "2026-10-02", calls: free.perDay }]);
    const v = await checkAllowance("acct_a", free, NOW);
    expect(v).toMatchObject({ ok: false, which: "day", retryAfter: resetsIn(NOW).day });
  });

  it("refuses at the month's limit until the first, before the day's", async () => {
    rows.mockResolvedValue([
      { day: "2026-10-01", calls: free.perMonth },
      { day: "2026-10-02", calls: free.perDay },
    ]);
    const v = await checkAllowance("acct_a", free, NOW);
    expect(v).toMatchObject({ ok: false, which: "month", retryAfter: resetsIn(NOW).month });
  });

  it("counts seconds to the next UTC midnight and the next month", () => {
    expect(resetsIn(NOW)).toEqual({ day: 8 * 3600 + 29 * 60 + 40, month: 29 * 86400 + 8 * 3600 + 29 * 60 + 40 });
  });
});

describe("the minute limit", () => {
  it("allows the plan's calls in a minute, then refuses until the next one", () => {
    for (let i = 0; i < 10; i++) expect(takeMinute("KEY00001", 10, NOW).ok).toBe(true);
    const r = takeMinute("KEY00001", 10, NOW);
    expect(r).toEqual({ ok: false, remaining: 0, reset: 40 });
    expect(takeMinute("KEY00001", 10, new Date("2026-10-02T15:31:00Z")).ok).toBe(true);
  });

  it("keeps keys apart", () => {
    for (let i = 0; i < 10; i++) takeMinute("KEY00001", 10, NOW);
    expect(takeMinute("KEY00002", 10, NOW).ok).toBe(true);
  });
});
