import { afterEach, describe, expect, it, vi } from "vitest";
import { logClientError } from "../recovery";

// The error screens reload or redirect within a second; this report is the
// record that survives (Oct 31 2026).
describe("logClientError", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends one beacon with the screen, the outcome and the path, once per error", async () => {
    const beacon = vi.fn((_url: string, _body: Blob) => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beacon });
    const err = new Error("Not authenticated (unique a)");
    logClientError("GlobalError", err, "redirect-login");
    logClientError("GlobalError", err, "redirect-login");
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]![0]).toBe("/api/client-error");
    const sent = JSON.parse(await beacon.mock.calls[0]![1].text());
    expect(sent).toMatchObject({ boundary: "GlobalError", outcome: "redirect-login", message: "Not authenticated (unique a)" });
    expect(typeof sent.path).toBe("string");
  });

  it("falls back to fetch when the beacon is refused, and never throws", () => {
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: () => false });
    const f = vi.fn(() => Promise.resolve(new Response(null)));
    vi.stubGlobal("fetch", f);
    expect(() => logClientError("RouteError", new Error("boom (unique b)"), "shown")).not.toThrow();
    expect(f).toHaveBeenCalledWith("/api/client-error", expect.objectContaining({ method: "POST", keepalive: true }));
  });
});
