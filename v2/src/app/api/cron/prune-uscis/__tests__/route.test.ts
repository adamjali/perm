import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prune = vi.fn<(now: Date) => Promise<number>>();
vi.mock("@/lib/turso/uscisCaseStatus", () => ({ pruneUscisCaseStatus: (now: Date) => prune(now) }));

const { GET } = await import("../route");

const SECRET = "cron-secret-for-tests";

function call(auth?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  return GET(new Request("https://permtracker.app/api/cron/prune-uscis", { headers }));
}

describe("GET /api/cron/prune-uscis", () => {
  beforeEach(() => {
    prune.mockReset();
    prune.mockResolvedValue(3);
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("refuses no header, a wrong secret, and an unconfigured secret with 401, and prunes nothing", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(`Bearer ${SECRET}`)).status).toBe(401);
    expect(prune).not.toHaveBeenCalled();
  });

  it("prunes as of now and reports the count", async () => {
    const before = Date.now();
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 3 });
    expect(prune).toHaveBeenCalledTimes(1);
    const now = prune.mock.calls[0]![0];
    expect(now).toBeInstanceOf(Date);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("reports a failed prune as 500, never as success", async () => {
    prune.mockRejectedValueOnce(new Error("turso down"));
    const res = await call(`Bearer ${SECRET}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "prune failed" });
  });
});
