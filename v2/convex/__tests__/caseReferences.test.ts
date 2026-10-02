import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../../test-utils/convex";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildDefaultProfile } from "../lib/userDefaults";

/**
 * Deleting cases, one at a time or in bulk, clears every record that points
 * at them: the custom case order, the timeline selection, dismissed
 * deadlines, a conversation's related case, chat citations and duplicate
 * links. References to the cases that stay are left alone.
 */
describe("deleting cases clears what points at them", () => {
  setupSchedulerTests();

  async function seed() {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "Owner");
    const make = async (employerName: string) => {
      const id = await user.mutation(api.cases.create, {
        employerName,
        beneficiaryIdentifier: employerName,
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);
      return id;
    };
    const gone = await make("Gone Co");
    const gone2 = await make("Gone Two");
    const kept = await make("Kept Co");
    const copy = await make("Copy Co");
    const userId = user.userId;
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.patch(copy, { duplicateOf: gone, markedAsDuplicateAt: now });
      await ctx.db.insert("userCaseOrder", {
        userId,
        caseIds: [gone, kept, gone2, copy],
        filters: {},
        baseSortMethod: "deadline",
        baseSortOrder: "asc",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("timelinePreferences", {
        userId,
        selectedCaseIds: [gone, kept, gone2],
        timeRange: 6,
        createdAt: now,
        updatedAt: now,
      });
      const dismissedDeadlines = [gone, kept, gone2].map((caseId) => ({
        caseId,
        deadlineType: "pwd_expiration",
        dismissedAt: now,
      }));
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();
      if (profile) await ctx.db.patch(profile._id, { dismissedDeadlines });
      else await ctx.db.insert("userProfiles", { ...buildDefaultProfile(userId), dismissedDeadlines });
      const about = (relatedCaseId: Id<"cases">) =>
        ctx.db.insert("conversations", {
          userId,
          title: "Chat",
          isArchived: false,
          metadata: { relatedCaseId },
          createdAt: now,
          updatedAt: now,
        });
      const chat = await about(gone);
      await about(kept);
      await ctx.db.insert("conversationMessages", {
        conversationId: chat,
        role: "assistant",
        content: "See the cases.",
        metadata: {
          citations: [
            { caseId: gone, field: "a" },
            { caseId: kept, field: "b" },
            { field: "c" },
            { caseId: gone2, field: "d" },
          ],
        },
        createdAt: now,
      });
    });
    return { t, user, userId, gone, gone2, kept, copy };
  }

  async function references(
    t: Awaited<ReturnType<typeof seed>>["t"],
    userId: Id<"users">,
    copy: Id<"cases">,
  ) {
    return t.run(async (ctx) => {
      const order = await ctx.db
        .query("userCaseOrder")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();
      const timeline = await ctx.db
        .query("timelinePreferences")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .first();
      const conversations = await ctx.db
        .query("conversations")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .collect();
      const messages = await ctx.db.query("conversationMessages").collect();
      const copyDoc = await ctx.db.get(copy);
      return {
        order: order?.caseIds,
        timeline: timeline?.selectedCaseIds,
        dismissed: profile?.dismissedDeadlines.map((d) => d.caseId),
        related: conversations.map((c) => c.metadata?.relatedCaseId ?? null),
        citations: messages.flatMap((m) => m.metadata?.citations?.map((c) => c.field) ?? []),
        duplicateOf: copyDoc?.duplicateOf ?? null,
        markedAsDuplicateAt: copyDoc?.markedAsDuplicateAt ?? null,
      };
    });
  }

  it("remove clears the deleted case's references and keeps the others", async () => {
    const { t, user, userId, gone, gone2, kept, copy } = await seed();
    await user.mutation(api.cases.remove, { id: gone });
    await finishScheduledFunctions(t);

    expect(await references(t, userId, copy)).toEqual({
      order: [kept, gone2, copy],
      timeline: [kept, gone2],
      dismissed: [kept, gone2],
      related: [null, kept],
      citations: ["b", "c", "d"],
      duplicateOf: null,
      markedAsDuplicateAt: null,
    });
  });

  it("bulkRemove clears every deleted case's references and keeps the others", async () => {
    const { t, user, userId, gone, gone2, kept, copy } = await seed();
    const result = await user.mutation(api.cases.bulkRemove, { ids: [gone, gone2] });
    await finishScheduledFunctions(t);

    expect(result.successCount).toBe(2);
    expect(await references(t, userId, copy)).toEqual({
      order: [kept, copy],
      timeline: [kept],
      dismissed: [kept],
      related: [null, kept],
      citations: ["b", "c"],
      duplicateOf: null,
      markedAsDuplicateAt: null,
    });
  });
});
