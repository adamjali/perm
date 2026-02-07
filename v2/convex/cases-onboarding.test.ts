import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../test-utils/convex";
import { api } from "./_generated/api";

describe("cases.hasAnyCases", () => {
  setupSchedulerTests();

  it("returns false when unauthenticated", async () => {
    const t = createTestContext();
    const result = await t.query(api.cases.hasAnyCases, {});
    expect(result).toBe(false);
  });

  it("returns false when user has no cases", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "User 1");

    const result = await authT.query(api.cases.hasAnyCases, {});
    expect(result).toBe(false);
  });

  it("returns true when user has an active case", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "User 1");

    await authT.mutation(api.cases.create, {
      employerName: "Test Corp",
      positionTitle: "Engineer",
    });
    await finishScheduledFunctions(t);

    const result = await authT.query(api.cases.hasAnyCases, {});
    expect(result).toBe(true);
  });

  it("returns false when all user's cases are soft-deleted", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "User 1");

    const caseId = await authT.mutation(api.cases.create, {
      employerName: "Test Corp",
      positionTitle: "Engineer",
    });
    await finishScheduledFunctions(t);

    await authT.mutation(api.cases.remove, { id: caseId });
    await finishScheduledFunctions(t);

    const result = await authT.query(api.cases.hasAnyCases, {});
    expect(result).toBe(false);
  });

  it("returns true when user has mix of active and deleted cases", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "User 1");

    const caseId1 = await authT.mutation(api.cases.create, {
      employerName: "Corp A",
      positionTitle: "Engineer",
    });
    await finishScheduledFunctions(t);

    await authT.mutation(api.cases.create, {
      employerName: "Corp B",
      positionTitle: "Designer",
    });
    await finishScheduledFunctions(t);

    // Soft-delete only the first case
    await authT.mutation(api.cases.remove, { id: caseId1 });
    await finishScheduledFunctions(t);

    const result = await authT.query(api.cases.hasAnyCases, {});
    expect(result).toBe(true);
  });
});
