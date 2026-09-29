import { describe, expect, it } from "vitest";

import { isRevokedGrant } from "../googleCalendarActions";

describe("a revoked Google grant is expected, not a fault", () => {
  it("recognises Google's invalid_grant and our own disconnect message", () => {
    expect(isRevokedGrant(new Error("invalid_grant"))).toBe(true);
    expect(isRevokedGrant(new Error("Token refresh failed - Google Calendar has been disconnected. Please reconnect in Settings."))).toBe(true);
  });
  it("still reports everything else", () => {
    expect(isRevokedGrant(new Error("Rate Limit Exceeded"))).toBe(false);
    expect(isRevokedGrant(undefined)).toBe(false);
  });
});
