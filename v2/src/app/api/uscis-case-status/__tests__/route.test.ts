import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_INPUT_LENGTH,
  PER_IP_PER_MINUTE,
  makeUscisCaseStatusHandler,
  resetIpBuckets,
} from "@/lib/uscis/routeHandler";

/**
 * The route's guards, in the order they run. The handler is built through the
 * factory with an injected lookup, so no test here touches Turso or USCIS;
 * the route file itself is one line of wiring and is asserted by shape below.
 */

const lookup = vi.fn();
let enabled = true;
const NOW = new Date("2026-09-22T18:00:00Z");

const handler = makeUscisCaseStatusHandler({
  lookup: (r, n) => lookup(r, n),
  enabled: () => enabled,
  now: () => NOW,
});

function get(receipt: string | null, ip = "203.0.113.5"): Request {
  const url = new URL("https://permtracker.app/api/uscis-case-status");
  if (receipt !== null) url.searchParams.set("receipt", receipt);
  return new Request(url, { headers: { "x-forwarded-for": ip } });
}

const STORED = {
  receipt: "EAC9999103403",
  formType: "I-140",
  statusText: "Case Was Received",
  statusDesc: "d",
  submittedAt: null,
  modifiedAt: null,
  history: [],
  seenAt: NOW.getTime(),
  firstSeenAt: NOW.getTime(),
  lastChangeAt: NOW.getTime(),
};

beforeEach(() => {
  lookup.mockReset();
  enabled = true;
  resetIpBuckets();
});

describe("GET /api/uscis-case-status", () => {
  it("refuses an over-long input with 400 BEFORE looking at its shape, and never calls the lookup", async () => {
    const res = await handler(get("E".repeat(100_000)));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ reason: "length" });
    expect(lookup).not.toHaveBeenCalled();
    expect(MAX_INPUT_LENGTH).toBe(20);
  });

  it("refuses a wrong shape with 400 (never 429) and the shared sentence", async () => {
    for (const bad of ["", "G-100-26125-868956", "EAC123", "Microsoft"]) {
      const res = await handler(get(bad));
      expect(res.status, bad).toBe(400);
      const body = await res.json();
      expect(body.reason).toBe("shape");
      expect(body.error).toMatch(/three letters and ten digits/);
    }
    expect((await handler(get(null))).status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("answers 503 'pending' with no lookup while the keys are absent", async () => {
    enabled = false;
    const res = await handler(get("EAC9999103403"));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ reason: "disabled" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("normalises the receipt before the lookup and answers no-store", async () => {
    lookup.mockResolvedValue({ kind: "ok", status: STORED, source: "stored" });
    const res = await handler(get(" eac-9999-103403 "));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(lookup).toHaveBeenCalledWith("EAC9999103403", NOW);
    await expect(res.json()).resolves.toMatchObject({ receipt: "EAC9999103403", source: "stored", stale: false });
  });

  it("distinguishes a budget refusal (429, reason budget) from a shape refusal (400)", async () => {
    lookup.mockResolvedValue({ kind: "budget" });
    const res = await handler(get("EAC9999103403"));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ reason: "budget" });
  });

  it.each([
    [{ kind: "not_found" }, 404, "not_found"],
    [{ kind: "invalid" }, 400, "shape"],
    [{ kind: "rate_limited", where: "uscis" }, 429, "uscis_rate"],
    [{ kind: "rate_limited", where: "local" }, 429, "local_rate"],
    [{ kind: "unauthorized" }, 503, "unauthorized"],
    [{ kind: "unavailable", httpStatus: 503 }, 503, "unavailable"],
    [{ kind: "disabled" }, 503, "disabled"],
  ])("maps %o to %s", async (result, status, reason) => {
    lookup.mockResolvedValue(result);
    const res = await handler(get("EAC9999103403"));
    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toMatchObject({ reason });
  });

  it("returns a stale stored row as 200 with stale:true and the failure named", async () => {
    lookup.mockResolvedValue({ kind: "stale", status: STORED, failure: "unavailable" });
    const res = await handler(get("EAC9999103403"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ stale: true, failure: "unavailable", source: "stored" });
  });

  it("limits one address to PER_IP_PER_MINUTE lookups, charged before the lookup", async () => {
    lookup.mockResolvedValue({ kind: "ok", status: STORED, source: "stored" });
    for (let i = 0; i < PER_IP_PER_MINUTE; i++) expect((await handler(get("EAC9999103403"))).status).toBe(200);
    const res = await handler(get("EAC9999103403"));
    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toMatchObject({ reason: "ip" });
    expect(lookup).toHaveBeenCalledTimes(PER_IP_PER_MINUTE);
    // A different address is unaffected.
    expect((await handler(get("EAC9999103403", "198.51.100.9"))).status).toBe(200);
  });
});

describe("the route file", () => {
  it("exports only GET (and the dynamic flag), so route type generation cannot reject it", async () => {
    const mod = await import("../route");
    const names = Object.keys(mod).sort();
    expect(names).toEqual(["GET", "dynamic"]);
  });
});
