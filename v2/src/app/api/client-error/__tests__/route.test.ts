import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the server's shared build folder, holding one chunk.
const shared = mkdtempSync(join(tmpdir(), "pt-shared-"));
mkdirSync(join(shared, "_next", "static", "chunks"), { recursive: true });
writeFileSync(join(shared, "_next", "static", "chunks", "6020-3a9f2417e1cf54eb.js"), "//");
process.env.PT_SHARED_ROOT = shared;

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { POST } from "../route";
import { chunkFileOf, dplOf, groupingKey, parseClientError } from "../parse";

const good = { boundary: "GlobalError", outcome: "redirect-login", name: "Error", message: "Not authenticated", path: "/dashboard?case=G-100-1" };
// Each post comes from its own address unless a test names one, so the per-address cap
// doesn't decide tests about something else.
let nextAddress = 0;
const post = (body: string, address = `198.51.100.${++nextAddress}`) =>
  POST(new Request("https://permtracker.app/api/client-error", { method: "POST", body, headers: { "x-real-ip": address } }));

describe("parseClientError", () => {
  it("keeps the fields it knows, capped, and drops the query string", () => {
    const r = parseClientError({ ...good, message: "x".repeat(900), extra: "never kept" });
    expect(r).toMatchObject({ boundary: "GlobalError", outcome: "redirect-login", path: "/dashboard" });
    expect(r!.message).toHaveLength(300);
    expect(r).not.toHaveProperty("extra");
  });

  it("refuses what isn't a report", () => {
    expect(parseClientError(null)).toBeNull();
    expect(parseClientError({ ...good, boundary: "<script>" })).toBeNull();
    // Only the site's own error screens report here.
    expect(parseClientError({ ...good, boundary: "AnyNameAtAll" })).toBeNull();
    for (const boundary of ["GlobalError", "RouteError", "PublicDataError"]) {
      expect(parseClientError({ ...good, boundary })?.boundary).toBe(boundary);
    }
    expect(parseClientError({ ...good, outcome: "anything" })).toBeNull();
    expect(parseClientError({ ...good, path: "https://elsewhere.test/" })).toBeNull();
  });
});

describe("groupingKey and chunkFileOf", () => {
  const a = "ChunkLoadError: Loading chunk 6020 failed. (missing: https://permtracker.app/_next/static/chunks/6020-3a9f2417e1cf54eb.js?dpl=002b605194d7abfa6fd83958dfd96b25c4c17a0d-416)";
  const b = "ChunkLoadError: Loading chunk 8174 failed. (timeout: https://permtracker.app/_next/static/chunks/8174-19e95477c403f899.js?dpl=dab0676ad2674f73a4e805ce61e9f3b71ff2c509-413)";

  it("gives one kind of error one key, whatever its numbers and addresses", () => {
    expect(groupingKey(a.replace("missing", "timeout"))).toBe(groupingKey(b));
    expect(groupingKey("Not authenticated")).toBe("Not authenticated");
    expect(groupingKey("Not authenticated")).not.toBe(groupingKey("Server Error"));
  });

  it("reads the build a file belongs to from its dpl", () => {
    expect(dplOf("Loading chunk 1 failed. (missing: https://permtracker.app/_next/static/chunks/a.js?dpl=579bd05c-96)")).toBe("579bd05c-96");
    expect(dplOf("Loading chunk 1 failed. (missing: https://permtracker.app/_next/static/chunks/a.js)")).toBeNull();
  });

  it("names the build file a chunk failure points at, and nothing else", () => {
    expect(chunkFileOf(a)).toBe("chunks/6020-3a9f2417e1cf54eb.js");
    expect(chunkFileOf("Loading CSS chunk 12 failed. (https://permtracker.app/_next/static/css/00f4d0273202d067.css)")).toBe("css/00f4d0273202d067.css");
    expect(chunkFileOf("Not authenticated")).toBeNull();
    expect(chunkFileOf("Loading chunk 1 failed. (https://permtracker.app/_next/static/chunks/../../etc/passwd.js)")).toBeNull();
    expect(chunkFileOf("TypeError at https://permtracker.app/_next/static/chunks/6020-3a9f2417e1cf54eb.js:1")).toBeNull();
  });

  it("reads a chunk under a route group or a dynamic segment, encoded or not", () => {
    expect(chunkFileOf("ChunkLoadError: Loading chunk 6750 failed. (error: https://permtracker.app/_next/static/chunks/app/(site)/layout-7aeb3f007142a472.js?dpl=f7796f0-437)"))
      .toBe("chunks/app/(site)/layout-7aeb3f007142a472.js");
    expect(chunkFileOf("ChunkLoadError: Loading chunk 9 failed. (missing: https://permtracker.app/_next/static/chunks/app/(site)/(public)/perm-employers/%5Bslug%5D/page-0a1b2c3d4e5f6a7b.js)"))
      .toBe("chunks/app/(site)/(public)/perm-employers/[slug]/page-0a1b2c3d4e5f6a7b.js");
    expect(chunkFileOf("Loading chunk 1 failed. (https://permtracker.app/_next/static/chunks/app/%2E%2E/%2E%2E/etc/passwd.js)")).toBeNull();
    expect(chunkFileOf("Loading chunk 1 failed. (https://permtracker.app/_next/static/chunks/app/%E0%A4/x.js)")).toBeNull();
  });
});

describe("POST /api/client-error", () => {
  beforeEach(() => vi.mocked(Sentry.captureMessage).mockClear());
  afterEach(() => vi.restoreAllMocks());

  const chunkReport = (file: string, kind = "missing") => ({
    ...good,
    boundary: "PublicDataError",
    outcome: "reload",
    name: "ChunkLoadError",
    message: `Loading chunk 1 failed. (${kind}: https://permtracker.app/_next/static/chunks/${file}?dpl=abc-1)`,
  });

  it("files a failed download of a file the server has under one warning", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await post(JSON.stringify(chunkReport("6020-3a9f2417e1cf54eb.js")));
    await post(JSON.stringify(chunkReport("6020-3a9f2417e1cf54eb.js", "timeout")));
    const calls = vi.mocked(Sentry.captureMessage).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [, opts] of calls) {
      expect(opts).toMatchObject({ level: "warning", fingerprint: ["client-error", "chunk-download"] });
    }
  });

  it("keeps a file the server doesn't have as an error of its own", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await post(JSON.stringify(chunkReport("9999-deadbeefdeadbeef.js")));
    const [msg, opts] = vi.mocked(Sentry.captureMessage).mock.calls[0]!;
    expect(msg).toContain("9999-deadbeefdeadbeef.js");
    expect(opts).toMatchObject({ level: "error", tags: expect.objectContaining({ chunk: "not-on-server" }) });
  });

  it("files a pruned file from an older build than the live one under one warning", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_DEPLOYMENT_ID", "live-445");
    try {
      // chunkReport's files carry ?dpl=abc-1, an older build.
      await post(JSON.stringify(chunkReport("9999-deadbeefdeadbeef.js")));
      await post(JSON.stringify(chunkReport("8888-deadbeefdeadbeef.js")));
      const calls = vi.mocked(Sentry.captureMessage).mock.calls;
      expect(calls).toHaveLength(2);
      for (const [, opts] of calls) {
        expect(opts).toMatchObject({
          level: "warning",
          tags: expect.objectContaining({ chunk: "old-build" }),
          fingerprint: ["client-error", "chunk-old-build"],
        });
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("keeps a missing file of the live build itself as an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("NEXT_DEPLOYMENT_ID", "abc-1");
    try {
      await post(JSON.stringify(chunkReport("9999-deadbeefdeadbeef.js")));
      expect(vi.mocked(Sentry.captureMessage).mock.calls[0]![1]).toMatchObject({
        level: "error",
        tags: expect.objectContaining({ chunk: "not-on-server" }),
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("logs one line and sends Sentry the screen and message, never the query", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post(JSON.stringify(good));
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]![1])).toContain('"path":"/dashboard"');
    expect(String(log.mock.calls[0]![1])).not.toContain("G-100-1");
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "GlobalError: Error: Not authenticated",
      expect.objectContaining({ tags: expect.objectContaining({ component: "GlobalError", outcome: "redirect-login" }) }),
    );
  });

  it("tags every report so the server's own Sentry budget leaves it to this route's", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await post(JSON.stringify(good));
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0]![1]).toMatchObject({ tags: expect.objectContaining({ report: "client" }) });
  });

  it("drops what one address sends past its few a minute", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 10; i++) {
      expect((await post(JSON.stringify({ ...good, message: `one ${i}` }), "203.0.113.9")).status).toBe(204);
    }
    expect(log).toHaveBeenCalledTimes(6);
  });

  it("refuses a malformed or oversized body", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(JSON.stringify({ ...good, stack: "x".repeat(5000) }))).status).toBe(413);
  });
});
