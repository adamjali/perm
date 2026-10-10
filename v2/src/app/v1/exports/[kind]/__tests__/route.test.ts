import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_PLANS } from "@convex/lib/apiPlans";

const authenticate = vi.fn();
const takeMinute = vi.fn();
const checkAllowance = vi.fn();
const countCall = vi.fn();
const runExport = vi.fn();
const exportRowsUsed = vi.fn();
const chargeExportRows = vi.fn();
vi.mock("@/lib/api/auth", () => ({ authenticate: (...a: unknown[]) => authenticate(...a) }));
vi.mock("@/lib/api/usage", () => ({
  takeMinute: (...a: unknown[]) => takeMinute(...a),
  checkAllowance: (...a: unknown[]) => checkAllowance(...a),
  countCall: (...a: unknown[]) => countCall(...a),
  resetsIn: () => ({ day: 3600, month: 86400 }),
}));
vi.mock("@/lib/api/exports", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api/exports")>();
  return { ...real, runExport: (...a: unknown[]) => runExport(...a) };
});
vi.mock("@/lib/api/exportQuota", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api/exportQuota")>();
  return {
    ...real,
    exportRowsUsed: (...a: unknown[]) => exportRowsUsed(...a),
    chargeExportRows: (...a: unknown[]) => chargeExportRows(...a),
  };
});

import { GET } from "../route";

const caller = {
  kind: "key" as const,
  keyId: "KEY00001",
  account: "acct_aaaaaaaaaaaaaaaaaaaa",
  plan: API_PLANS.plus,
  accountPlan: "free" as const,
  paywall: false,
  scopes: ["read", "export"],
  sandbox: false,
  expiresAt: null,
};
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `e-${i}`, name: `E ${i}` }));
const ok = (n: number, truncated = false) => ({
  ok: true,
  kind: "employers",
  rows: rows(n),
  csv: "kind\r\n",
  cap: 1000,
  truncated,
  note: null,
  meta: { source: "DOL", asOf: null, url: "https://permtracker.app/perm-employers" },
});
const call = () =>
  GET(new Request("https://permtracker.app/v1/exports/employers?q=acme", { headers: { authorization: "Bearer x" } }), {
    params: Promise.resolve({ kind: "employers" }),
  });

beforeEach(() => {
  authenticate.mockReset().mockResolvedValue({ ok: true, caller });
  takeMinute.mockReset().mockReturnValue({ ok: true, remaining: 29, reset: 40 });
  checkAllowance.mockReset().mockResolvedValue({ ok: true, today: 3, month: 30 });
  countCall.mockReset();
  runExport.mockReset().mockResolvedValue(ok(1000));
  exportRowsUsed.mockReset().mockResolvedValue(0);
  chargeExportRows.mockReset().mockResolvedValue(undefined);
});

describe("GET /v1/exports/{kind}: the day's export rows", () => {
  it("counts the rows an export returned toward the day", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(chargeExportRows).toHaveBeenCalledWith(caller.account, 1000);
    expect(res.headers.get("X-Export-Rows-Left-Today")).toBe(String(API_PLANS.plus.exportRowsPerDay - 1000));
  });

  it("sizes an export to what's left today, and says so when that cut it short", async () => {
    exportRowsUsed.mockResolvedValue(API_PLANS.plus.exportRowsPerDay - 250);
    runExport.mockResolvedValue(ok(250, true));
    const res = await call();
    expect(runExport.mock.calls[0]?.[2]).toMatchObject({ exportRows: 250 });
    const body = (await res.json()) as { data: { note: string } };
    expect(body.data.note).toMatch(/250 export rows left today/);
  });

  it("refuses once the day's rows are taken, reads nothing and counts nothing", async () => {
    exportRowsUsed.mockResolvedValue(API_PLANS.plus.exportRowsPerDay);
    const res = await call();
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("export_daily_limit");
    expect(body.error.message).toMatch(/20,000 rows for today/);
    expect(runExport).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
    expect(chargeExportRows).not.toHaveBeenCalled();
  });

  it("refuses when today's count can't be read, rather than export without one", async () => {
    exportRowsUsed.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(503);
    expect(runExport).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("leaves a sandbox key's sample exports uncounted", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { ...caller, sandbox: true } });
    const res = await call();
    expect(res.status).toBe(200);
    expect(exportRowsUsed).not.toHaveBeenCalled();
    expect(chargeExportRows).not.toHaveBeenCalled();
  });
});
