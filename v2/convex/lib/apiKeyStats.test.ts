import { describe, expect, it } from "vitest";

import { keyCounts } from "./apiKeyStats";

const NOW = Date.UTC(2026, 9, 9, 12);
const H = 3_600_000;

describe("keyCounts", () => {
  it("counts working keys by scope, live and sandbox apart, an old key by the default scopes", () => {
    const counts = keyCounts(
      [
        { scopes: ["read", "export"] },
        {},
        { scopes: ["read", "webhooks"], sandbox: true },
        { scopes: ["read"], revokedAt: NOW - H },
        { scopes: ["read"], expiresAt: NOW - H },
        { scopes: ["read", "live_lookup"], graceUntil: NOW + H },
        { scopes: ["read"], graceUntil: NOW - H },
      ],
      NOW,
    );
    expect(counts).toEqual({
      live: 3,
      sandbox: 1,
      byScope: { read: 4, export: 2, live_lookup: 2, webhooks: 2, cases_read: 0 },
    });
  });

  it("is all zeros with no keys", () => {
    expect(keyCounts([], NOW)).toEqual({
      live: 0,
      sandbox: 0,
      byScope: { read: 0, export: 0, live_lookup: 0, webhooks: 0, cases_read: 0 },
    });
  });
});
