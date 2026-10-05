import { beforeEach, describe, expect, it, vi } from "vitest";

// The keyless lookup the browser extension calls. Its safety is in the order:
// a malformed name is refused before any limit or read and never counted; one
// address meets its own minute limit; every keyless caller shares a pool; and
// only this site and Chrome extensions get CORS, so a web page can't spend it.

const countCall = vi.fn();
const lookupEmployer = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/turso/client", () => ({ exec: vi.fn(), rows: vi.fn() }));
vi.mock("@/lib/api/employerLookup", () => ({ lookupEmployer: (...a: unknown[]) => lookupEmployer(...a) }));
vi.mock("../usage", async (importOriginal) => {
  const real = await importOriginal<typeof import("../usage")>();
  return { ...real, countCall: (...a: unknown[]) => countCall(...a) };
});

import { resetUsageMemoryForTests } from "../usage";
import { KEYLESS_PER_ADDRESS_PER_MINUTE, allowedOrigin } from "../keyless";
import { GET, OPTIONS } from "@/app/v1/lookup/employer/route";

const EXT = "chrome-extension://abcdefghijklmnopabcdefghijklmnop";
const meta = { source: "DOL", asOf: "2026-06-30", url: "https://permtracker.app/perm-employers/google-llc" };

/**
 * A request-shaped object: happy-dom's Request drops `Origin`, which the
 * fetch spec forbids a page to set, while a server receives it as sent.
 */
function req(url: string, headers: Record<string, string>): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { url, method: "GET", headers: { get: (n: string) => lower[n.toLowerCase()] ?? null } } as unknown as Request;
}

function get(name: string | null, headers: Record<string, string> = {}) {
  const q = name === null ? "" : `?name=${encodeURIComponent(name)}`;
  return GET(req(`https://permtracker.app/v1/lookup/employer${q}`, { "x-real-ip": "203.0.113.9", ...headers }));
}

beforeEach(() => {
  resetUsageMemoryForTests();
  countCall.mockReset();
  lookupEmployer.mockReset().mockResolvedValue({ ok: true, data: { match: "exact" }, meta });
});

describe("GET /v1/lookup/employer", () => {
  it("answers without a key, counts it under the extension, and lets a browser keep it ten minutes", async () => {
    const res = await get("Google", { origin: EXT });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { match: "exact" }, meta });
    expect(lookupEmployer).toHaveBeenCalledExactlyOnceWith("Google");
    expect(countCall).toHaveBeenCalledExactlyOnceWith("anonymous", "extension");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=600");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(EXT);
  });

  it("refuses a missing or oversized name before any read, and doesn't count it", async () => {
    for (const name of [null, "x", "y".repeat(121)]) {
      const res = await get(name);
      expect(res.status).toBe(400);
    }
    expect(lookupEmployer).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("holds one address to its minute, and leaves another address alone", async () => {
    for (let i = 0; i < KEYLESS_PER_ADDRESS_PER_MINUTE; i++) expect((await get("Google")).status).toBe(200);
    const over = await get("Google");
    expect(over.status).toBe(429);
    expect(Number(over.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await get("Google", { "x-real-ip": "198.51.100.4" })).status).toBe(200);
  });

  it("gives CORS to this site and Chrome extensions only", async () => {
    expect((await get("Google", { origin: "https://evil.example" })).headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(allowedOrigin("https://permtracker.app")).toBe("https://permtracker.app");
    expect(allowedOrigin(EXT)).toBe(EXT);
    expect(allowedOrigin("chrome-extension://short")).toBeNull();
    expect(allowedOrigin("moz-extension://abcdefghijklmnopabcdefghijklmnop")).toBeNull();
    const pre = OPTIONS(req("https://permtracker.app/v1/lookup/employer", { origin: EXT }));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe(EXT);
  });

  it("says plainly when the read failed, without counting", async () => {
    lookupEmployer.mockRejectedValue(new Error("db down"));
    const res = await get("Google");
    expect(res.status).toBe(500);
    expect(countCall).not.toHaveBeenCalled();
  });
});
