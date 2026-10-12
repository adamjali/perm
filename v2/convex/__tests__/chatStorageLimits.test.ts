/**
 * What the chat's storage holds, and what a delete leaves (Oct 12 2026).
 *
 * Every read of a conversation's messages used to collect the whole table
 * slice, message parts had no length limit, a deleted conversation's title and
 * summary stayed in the audit log for good, and its cached tool answers stayed
 * behind. Each rule below is said where it bites (convex/lib/chatLimits.ts).
 */
import { describe, it, expect } from "vitest";
import { ConvexError } from "convex/values";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../../test-utils/convex";
import { api } from "../_generated/api";
import { CHAT_LIMITS } from "../lib/chatLimits";

const codeOf = async (p: Promise<unknown>): Promise<string | undefined> => {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof ConvexError ? (e.data as { code?: string }).code : String(e);
  }
};

describe("chat storage limits", () => {
  setupSchedulerTests();

  it("refuses a message longer than the composer allows", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    const conversationId = await asUser.mutation(api.conversations.create, {});
    expect(
      await codeOf(
        asUser.mutation(api.conversationMessages.createUserMessage, {
          conversationId,
          content: "x".repeat(CHAT_LIMITS.userMessageChars + 1),
        }),
      ),
    ).toBe("message_too_long");
  });

  it("refuses a new question in a full conversation", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    const conversationId = await asUser.mutation(api.conversations.create, {});
    await t.run(async (ctx) => {
      for (let i = 0; i < CHAT_LIMITS.messagesPerConversation; i++) {
        await ctx.db.insert("conversationMessages", { conversationId, role: "user", content: `m${i}`, createdAt: i });
      }
    });
    expect(
      await codeOf(
        asUser.mutation(api.conversationMessages.createUserMessage, { conversationId, content: "one more" }),
      ),
    ).toBe("conversation_full");
  });

  it("keeps each part of a reply to its limit, saying where it was cut", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    const conversationId = await asUser.mutation(api.conversations.create, {});
    await asUser.mutation(api.conversationMessages.createAssistantMessage, {
      conversationId,
      content: "a".repeat(CHAT_LIMITS.assistantMessageChars + 50),
      toolCalls: [{ tool: "queryCases", arguments: "{}", result: "r".repeat(CHAT_LIMITS.toolResultChars + 50), status: "success" }],
    });
    const [saved] = await asUser.query(api.conversationMessages.list, { conversationId });
    expect(saved!.content.startsWith("a".repeat(CHAT_LIMITS.assistantMessageChars))).toBe(true);
    expect(saved!.content).toMatch(/\[cut at 60,000 characters\]$/);
    expect(saved!.toolCalls![0]!.result).toMatch(/\[cut at 40,000 characters\]$/);
  });

  it("deletes a conversation's cached tool answers, and logs no words from it", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    const conversationId = await asUser.mutation(api.conversations.create, { title: "Acme Corp worker Jane" });
    await t.run(async (ctx) => {
      await ctx.db.patch(conversationId, {
        summary: { content: "Discussed Jane's PWD", tokenCount: 5, messageCountAtSummary: 2, lastSummarizedAt: 1 },
      });
      await ctx.db.insert("toolCache", {
        conversationId,
        toolName: "query_cases",
        queryHash: "h",
        queryParams: "{}",
        result: '{"cases":[{"employerName":"Acme Corp"}]}',
        createdAt: 1,
        expiresAt: Date.now() + 60_000,
      });
    });

    await asUser.mutation(api.conversations.deleteConversation, { id: conversationId });

    const { cached, audit } = await t.run(async (ctx) => ({
      cached: await ctx.db.query("toolCache").collect(),
      audit: await ctx.db.query("auditLogs").collect(),
    }));
    expect(cached).toHaveLength(0);
    const logged = JSON.stringify(audit);
    expect(logged).not.toContain("Acme");
    expect(logged).not.toContain("Jane");
    expect(audit.length).toBeGreaterThan(0);
  });

  it("deletes every conversation, past one transaction's batch", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 23; i++) {
        await ctx.db.insert("conversations", {
          userId: asUser.userId,
          title: `c${i}`,
          isArchived: false,
          createdAt: i,
          updatedAt: i,
        });
      }
    });
    await asUser.mutation(api.conversations.deleteAll, {});
    await finishScheduledFunctions(t);
    const left = await t.run(async (ctx) => ctx.db.query("conversations").collect());
    expect(left).toHaveLength(0);
  });

  it("lists conversations newest first", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    await t.run(async (ctx) => {
      for (const [title, updatedAt] of [["old", 1], ["newest", 3], ["middle", 2]] as const) {
        await ctx.db.insert("conversations", { userId: asUser.userId, title, isArchived: false, createdAt: 1, updatedAt });
      }
    });
    const list = await asUser.query(api.conversations.list, {});
    expect(list.map((c) => c.title)).toEqual(["newest", "middle", "old"]);
  });
});

describe("chat quota", () => {
  it("answers ok until the hourly bucket is spent, then says how long to wait", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t);
    for (let i = 0; i < 20; i++) {
      expect(await asUser.mutation(api.chatQuota.takeTurn, {})).toEqual({ ok: true });
    }
    const refused = await asUser.mutation(api.chatQuota.takeTurn, {});
    expect(refused).toMatchObject({ ok: false, window: "hour" });
    expect((refused as { retryAfterMs: number }).retryAfterMs).toBeGreaterThan(0);
  });

  it("counts each account on its own", async () => {
    const t = createTestContext();
    const first = await createAuthenticatedContext(t, "First");
    const second = await createAuthenticatedContext(t, "Second");
    for (let i = 0; i < 20; i++) await first.mutation(api.chatQuota.takeTurn, {});
    expect(await second.mutation(api.chatQuota.takeTurn, {})).toEqual({ ok: true });
  });
});
