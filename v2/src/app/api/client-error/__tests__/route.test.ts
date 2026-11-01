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
import { chunkFileOf, groupingKey, parseClientError } from "../parse";

const good = { boundary: "GlobalError", outcome: "redirect-login", name: "Error", message: "Not authenticated", path: "/dashboard?case=G-100-1" };
const post = (body: string) => POST(new Request("https://permtracker.app/api/client-error", { method: "POST", body }));

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

  it("names the build file a chunk failure points at, and nothing else", () => {
    expect(chunkFileOf(a)).toBe("chunks/6020-3a9f2417e1cf54eb.js");
    expect(chunkFileOf("Loading CSS chunk 12 failed. (https://permtracker.app/_next/static/css/00f4d0273202d067.css)")).toBe("css/00f4d0273202d067.css");
    expect(chunkFileOf("Not authenticated")).toBeNull();
    expect(chunkFileOf("Loading chunk 1 failed. (https://permtracker.app/_next/static/chunks/../../etc/passwd.js)")).toBeNull();
    expect(chunkFileOf("TypeError at https://permtracker.app/_next/static/chunks/6020-3a9f2417e1cf54eb.js:1")).toBeNull();
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

  it("refuses a malformed or oversized body", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(JSON.stringify({ ...good, stack: "x".repeat(5000) }))).status).toBe(413);
  });
});
