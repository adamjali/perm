import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../../test-utils/convex";
import { api } from "../_generated/api";

// Usage analytics switched off in Settings: saved on the account, read by the
// same check that silences staff browsers (users.isPostHogExcluded).

describe("usage analytics switch", () => {
  setupSchedulerTests();

  it("an account starts with analytics on", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await authT.mutation(api.users.ensureUserProfile, {});
    await finishScheduledFunctions(t);
    expect(await authT.query(api.users.isPostHogExcluded, {})).toBe(false);
  });

  it("switching off is saved and excludes the account; switching on reverses it", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await authT.mutation(api.users.ensureUserProfile, {});
    await finishScheduledFunctions(t);

    await authT.mutation(api.users.setAnalyticsOff, { off: true });
    expect((await authT.query(api.users.currentUserProfile, {}))?.analyticsOff).toBe(true);
    expect(await authT.query(api.users.isPostHogExcluded, {})).toBe(true);

    await authT.mutation(api.users.setAnalyticsOff, { off: false });
    expect(await authT.query(api.users.isPostHogExcluded, {})).toBe(false);
  });

  it("works for an account whose profile doesn't exist yet", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await authT.mutation(api.users.setAnalyticsOff, { off: true });
    await finishScheduledFunctions(t);
    expect(await authT.query(api.users.isPostHogExcluded, {})).toBe(true);
  });

  it("one account's choice doesn't reach another", async () => {
    const t = createTestContext();
    const a = await createAuthenticatedContext(t, "User A");
    const b = await createAuthenticatedContext(t, "User B");
    await a.mutation(api.users.setAnalyticsOff, { off: true });
    await finishScheduledFunctions(t);
    expect(await b.query(api.users.isPostHogExcluded, {})).toBe(false);
  });

  it("a signed-out caller can't change it", async () => {
    const t = createTestContext();
    await expect(t.mutation(api.users.setAnalyticsOff, { off: true })).rejects.toThrow();
  });
});
