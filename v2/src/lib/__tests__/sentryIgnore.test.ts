import { describe, expect, it } from "vitest";

import { CLIENT_IGNORE_ERRORS } from "../sentryIgnore";

/** Sentry's own rule (@sentry/core utils/eventUtils.js and utils/string.js): every possible message, any entry. */
function dropped(type: string, value: string): boolean {
  const possible = [value, `${type}: ${value}`];
  return possible.some((m) => CLIENT_IGNORE_ERRORS.some((p) => p.test(m)));
}

describe("the browser errors Sentry drops", () => {
  it("drops each browser's own words for a request the connection didn't finish", () => {
    expect(dropped("TypeError", "Failed to fetch")).toBe(true);
    expect(dropped("TypeError", "Failed to fetch (permtracker.app)")).toBe(true);
    expect(dropped("TypeError", "NetworkError when attempting to fetch resource.")).toBe(true);
    expect(dropped("TypeError", "Load failed")).toBe(true);
    expect(dropped("TypeError", "network error")).toBe(true);
    expect(dropped("AbortError", "The user aborted a request.")).toBe(true);
    expect(dropped("ChunkLoadError", "Loading chunk 6020 failed.")).toBe(true);
    expect(dropped("Error", "Rejected")).toBe(true);
  });

  it("keeps errors of ours that only contain those words", () => {
    expect(dropped("Error", "Failed to fetch the employer's filings")).toBe(false);
    expect(dropped("Error", "Request Rejected by the server")).toBe(false);
    expect(dropped("Error", "Image load failed for the tour picture")).toBe(false);
    expect(dropped("Error", "Server Action handler threw")).toBe(false);
    expect(dropped("TypeError", "Cannot read properties of undefined (reading 'call')")).toBe(false);
  });

  it("drops the auth helper's refusal only as the whole message", () => {
    expect(dropped("Error", "not authenticated")).toBe(true);
    expect(dropped("Error", "[CONVEX Q(cases:list)] [Request ID: 1] Server Error\nUncaught Error: not authenticated\n    at getCurrentUserId")).toBe(true);
    expect(dropped("Error", "The token was not authenticated by Google, so calendar sync stopped")).toBe(false);
  });

  it("is anchored: no entry is a bare string Sentry would match anywhere", () => {
    for (const p of CLIENT_IGNORE_ERRORS) expect(p).toBeInstanceOf(RegExp);
  });
});
