import { describe, expect, it } from "vitest";

import { createTestContext, setupSchedulerTests } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { RETENTION_DAYS } from "../retention";

const DAY = 86_400_000;

describe("operational log retention", () => {
  setupSchedulerTests();

  async function seed(t: ReturnType<typeof createTestContext>) {
    await t.run(async (ctx) => {
      await ctx.db.insert("systemErrors", { source: "cron", operation: "x", message: "m", resolved: false, createdAt: Date.now() });
      await ctx.db.insert("apiUsage", { provider: "tavily", date: "2026-09-29", count: 3 });
      await ctx.db.insert("marketingEvents", {
        svixId: "msg_1", email: "a@example.com", contactId: "c1", eventType: "contact.created",
        unsubscribed: false, occurredAt: Date.now(), rawPayload: "{}",
      });
    });
  }

  const counts = (t: ReturnType<typeof createTestContext>) =>
    t.run(async (ctx) => ({
      systemErrors: (await ctx.db.query("systemErrors").collect()).length,
      apiUsage: (await ctx.db.query("apiUsage").collect()).length,
      marketingEvents: (await ctx.db.query("marketingEvents").collect()).length,
    }));

  it("keeps everything inside its horizon", async () => {
    const t = createTestContext();
    await seed(t);
    await t.mutation(internal.retention.pruneOperationalLogs, { now: Date.now() + 30 * DAY });
    expect(await counts(t)).toEqual({ systemErrors: 1, apiUsage: 1, marketingEvents: 1 });
  });

  it("deletes each table's rows once they pass that table's own horizon", async () => {
    const t = createTestContext();
    await seed(t);
    const past = (d: number) => Date.now() + (d + 1) * DAY;
    await t.mutation(internal.retention.pruneOperationalLogs, { now: past(RETENTION_DAYS.apiUsage) });
    expect(await counts(t)).toEqual({ systemErrors: 1, apiUsage: 0, marketingEvents: 1 });
    await t.mutation(internal.retention.pruneOperationalLogs, { now: past(RETENTION_DAYS.systemErrors) });
    expect(await counts(t)).toEqual({ systemErrors: 0, apiUsage: 0, marketingEvents: 1 });
    await t.mutation(internal.retention.pruneOperationalLogs, { now: past(RETENTION_DAYS.marketingEvents) });
    expect(await counts(t)).toEqual({ systemErrors: 0, apiUsage: 0, marketingEvents: 0 });
  });
});
