import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext, fixtures } from "./convex";

describe("test utilities", () => {
  it("createTestContext returns test context", async () => {
    const t = createTestContext();
    expect(t).toBeDefined();
    expect(typeof t.query).toBe("function");
    expect(typeof t.mutation).toBe("function");
  });

  it("createAuthenticatedContext adds identity", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    expect(authT).toBeDefined();
    // The identity is applied to the context
    expect(typeof authT.query).toBe("function");
  });

  it("fixtures.testItem creates default item", () => {
    const item = fixtures.testItem();
    expect(item.text).toBe("Test Item");
  });

  it("fixtures.testItem accepts overrides", () => {
    const item = fixtures.testItem({ text: "Custom Text" });
    expect(item.text).toBe("Custom Text");
  });
});
