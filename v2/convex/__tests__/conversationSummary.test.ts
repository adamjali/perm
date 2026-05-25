import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
} from "../../test-utils/convex";
import { api } from "../_generated/api";
import {
  RECENT_MESSAGES_TO_KEEP,
  SUMMARY_TRIGGER_MESSAGE_COUNT,
  SUMMARIZATION_LOCK_TTL_MS,
} from "../conversationSummary";

async function seedConversation(
  asUser: Awaited<ReturnType<typeof createAuthenticatedContext>>,
  messageCount: number,
  messageContent: string = "hello",
) {
  const conversationId = await asUser.mutation(api.conversations.create, {});

  for (let i = 0; i < messageCount; i++) {
    if (i % 2 === 0) {
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: `${messageContent} user ${i}`,
      });
    } else {
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: `${messageContent} assistant ${i}`,
      });
    }
  }

  return conversationId;
}

describe("conversationSummary", () => {
  describe("needsSummarization", () => {
    it("returns false for conversations under the message count floor", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(
        asUser,
        SUMMARY_TRIGGER_MESSAGE_COUNT,
      );

      const needs = await asUser.query(
        api.conversationSummary.needsSummarization,
        { conversationId },
      );
      expect(needs).toBe(false);
    });

    it("returns false when token count is low even if message count exceeds floor", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      // 15 tiny messages: above the floor (12) but well below the 8000-token trigger
      const conversationId = await seedConversation(asUser, 15, "hi");

      const needs = await asUser.query(
        api.conversationSummary.needsSummarization,
        { conversationId },
      );
      expect(needs).toBe(false);
    });

    it("returns true when token count exceeds trigger", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      // ~4000 chars per message × 15 = ~60k chars → ~17k tokens (well over 8k)
      const bigContent = "x".repeat(4000);
      const conversationId = await seedConversation(asUser, 15, bigContent);

      const needs = await asUser.query(
        api.conversationSummary.needsSummarization,
        { conversationId },
      );
      expect(needs).toBe(true);
    });

    it("returns false for non-owner", async () => {
      const t = createTestContext();
      const asOwner = await createAuthenticatedContext(t, "Owner");
      const conversationId = await seedConversation(
        asOwner,
        15,
        "x".repeat(4000),
      );

      const asStranger = await createAuthenticatedContext(t, "Stranger");
      const needs = await asStranger.query(
        api.conversationSummary.needsSummarization,
        { conversationId },
      );
      expect(needs).toBe(false);
    });

    it("returns false while a fresh summarizing lock is held", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(
        asUser,
        15,
        "x".repeat(4000),
      );

      // Claim the lock
      const claimed = await asUser.mutation(
        api.conversationSummary.beginSummarizing,
        { conversationId },
      );
      expect(claimed).toBe(true);

      const needs = await asUser.query(
        api.conversationSummary.needsSummarization,
        { conversationId },
      );
      expect(needs).toBe(false);
    });
  });

  describe("beginSummarizing", () => {
    it("acquires lock on first call", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 5);

      const claimed = await asUser.mutation(
        api.conversationSummary.beginSummarizing,
        { conversationId },
      );
      expect(claimed).toBe(true);
    });

    it("blocks concurrent acquisitions", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 5);

      const first = await asUser.mutation(
        api.conversationSummary.beginSummarizing,
        { conversationId },
      );
      const second = await asUser.mutation(
        api.conversationSummary.beginSummarizing,
        { conversationId },
      );
      expect(first).toBe(true);
      expect(second).toBe(false);
    });

    it("returns false for non-owner", async () => {
      const t = createTestContext();
      const asOwner = await createAuthenticatedContext(t, "Owner");
      const conversationId = await seedConversation(asOwner, 5);

      const asStranger = await createAuthenticatedContext(t, "Stranger");
      const claimed = await asStranger.mutation(
        api.conversationSummary.beginSummarizing,
        { conversationId },
      );
      expect(claimed).toBe(false);
    });
  });

  describe("finishSummarizing", () => {
    it("releases a held lock so needsSummarization can return true again", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(
        asUser,
        15,
        "x".repeat(4000),
      );

      await asUser.mutation(api.conversationSummary.beginSummarizing, {
        conversationId,
      });
      expect(
        await asUser.query(api.conversationSummary.needsSummarization, {
          conversationId,
        }),
      ).toBe(false);

      await asUser.mutation(api.conversationSummary.finishSummarizing, {
        conversationId,
      });
      expect(
        await asUser.query(api.conversationSummary.needsSummarization, {
          conversationId,
        }),
      ).toBe(true);
    });

    it("no-op when no summary exists", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 5);

      // Should not throw (Convex serializes void returns as null over the wire)
      await expect(
        asUser.mutation(api.conversationSummary.finishSummarizing, {
          conversationId,
        }),
      ).resolves.toBeNull();
    });
  });

  describe("saveSummary", () => {
    it("saves summary with facts and clears the lock", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 15);

      await asUser.mutation(api.conversationSummary.beginSummarizing, {
        conversationId,
      });

      await asUser.mutation(api.conversationSummary.saveSummary, {
        conversationId,
        content: "a concise prose summary",
        facts: JSON.stringify({ cases: ["X-1"], dates: { pwd: "2024-06-15" } }),
        tokenCount: 50,
        messageCountAtSummary: 5,
      });

      const ctx = await asUser.query(
        api.conversationSummary.getContextMessages,
        { conversationId },
      );
      expect(ctx.summary).toBe("a concise prose summary");
      expect(ctx.facts).toBeTruthy();
      const parsedFacts = JSON.parse(ctx.facts!);
      expect(parsedFacts.cases).toEqual(["X-1"]);
      expect(ctx.messageCountAtSummary).toBe(5);
    });

    it("saves summary without facts (backward compat)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 10);

      await asUser.mutation(api.conversationSummary.saveSummary, {
        conversationId,
        content: "summary without facts",
        tokenCount: 30,
        messageCountAtSummary: 3,
      });

      const ctx = await asUser.query(
        api.conversationSummary.getContextMessages,
        { conversationId },
      );
      expect(ctx.summary).toBe("summary without facts");
      expect(ctx.facts).toBeNull();
    });

    it("rejects non-owner saves", async () => {
      const t = createTestContext();
      const asOwner = await createAuthenticatedContext(t, "Owner");
      const conversationId = await seedConversation(asOwner, 10);

      const asStranger = await createAuthenticatedContext(t, "Stranger");
      await expect(
        asStranger.mutation(api.conversationSummary.saveSummary, {
          conversationId,
          content: "malicious",
          tokenCount: 5,
          messageCountAtSummary: 3,
        }),
      ).rejects.toThrow(/access denied|you do not own/i);
    });
  });

  describe("getContextMessages", () => {
    // Contract (since I14): returns ONLY the summary/facts envelope + counts.
    // No server-side "recent messages" window — the client message array is the
    // source of truth for the verbatim tail (compacted in the chat route).
    it("returns null summary + null facts + zero counts for non-existent conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 0);

      const ctx = await asUser.query(
        api.conversationSummary.getContextMessages,
        { conversationId },
      );
      expect(ctx.summary).toBeNull();
      expect(ctx.facts).toBeNull();
      expect(ctx.totalMessageCount).toBe(0);
      expect(ctx.messageCountAtSummary).toBe(0);
      // recentMessages was removed from the contract — must not be present.
      expect("recentMessages" in ctx).toBe(false);
    });

    it("reports totalMessageCount but exposes no recent-messages window", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 20);

      const ctx = await asUser.query(
        api.conversationSummary.getContextMessages,
        { conversationId },
      );
      expect(ctx.totalMessageCount).toBe(20);
      expect("recentMessages" in ctx).toBe(false);
    });

    it("returns the persisted summary + facts envelope to the owner", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 14);
      await asUser.mutation(api.conversationSummary.saveSummary, {
        conversationId,
        content: "prior context",
        facts: JSON.stringify({ cases: [{ id: "X-1" }] }),
        tokenCount: 7,
        messageCountAtSummary: 4,
      });

      const ctx = await asUser.query(
        api.conversationSummary.getContextMessages,
        { conversationId },
      );
      expect(ctx.summary).toBe("prior context");
      expect(ctx.facts).toBe(JSON.stringify({ cases: [{ id: "X-1" }] }));
      expect(ctx.messageCountAtSummary).toBe(4);
    });

    it("returns empty payload for non-owner", async () => {
      const t = createTestContext();
      const asOwner = await createAuthenticatedContext(t, "Owner");
      const conversationId = await seedConversation(asOwner, 10);
      await asOwner.mutation(api.conversationSummary.saveSummary, {
        conversationId,
        content: "secret summary",
        tokenCount: 5,
        messageCountAtSummary: 3,
      });

      const asStranger = await createAuthenticatedContext(t, "Stranger");
      const ctx = await asStranger.query(
        api.conversationSummary.getContextMessages,
        { conversationId },
      );
      expect(ctx.summary).toBeNull();
      expect(ctx.totalMessageCount).toBe(0);
    });
  });

  describe("getMessagesToSummarize", () => {
    it("returns existingFacts alongside messages", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 20);

      // Seed a summary with facts
      await asUser.mutation(api.conversationSummary.saveSummary, {
        conversationId,
        content: "existing summary",
        facts: JSON.stringify({ cases: ["X-1"] }),
        tokenCount: 20,
        messageCountAtSummary: 5,
      });

      const result = await asUser.query(
        api.conversationSummary.getMessagesToSummarize,
        { conversationId },
      );
      expect(result.existingSummary).toBe("existing summary");
      expect(result.existingFacts).toBeTruthy();
      expect(JSON.parse(result.existingFacts!).cases).toEqual(["X-1"]);
    });

    it("returns empty slice when not enough new messages accumulated", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t);
      const conversationId = await seedConversation(asUser, 12);

      // Summarize everything up to totalCount - RECENT_MESSAGES_TO_KEEP
      await asUser.mutation(api.conversationSummary.saveSummary, {
        conversationId,
        content: "summary",
        tokenCount: 10,
        messageCountAtSummary: 12 - RECENT_MESSAGES_TO_KEEP,
      });

      const result = await asUser.query(
        api.conversationSummary.getMessagesToSummarize,
        { conversationId },
      );
      expect(result.messages).toHaveLength(0);
    });
  });

  describe("SUMMARIZATION_LOCK_TTL_MS", () => {
    it("is 60 seconds", () => {
      expect(SUMMARIZATION_LOCK_TTL_MS).toBe(60_000);
    });
  });
});
