import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { POST } from "../route";
import { parseClientError } from "../parse";

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

describe("POST /api/client-error", () => {
  afterEach(() => vi.restoreAllMocks());

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
