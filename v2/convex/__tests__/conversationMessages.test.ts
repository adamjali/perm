/**
 * Conversation Messages CRUD Tests
 *
 * Comprehensive tests for the conversation messages module:
 * - createUserMessage: Create user messages with role='user'
 * - createAssistantMessage: Create assistant messages with metadata and auto-title
 * - list: List messages in chronological order with user isolation
 * - count: Count messages in a conversation
 * - getMostRecent: Get most recently updated non-archived conversation
 *
 * @see /convex/conversationMessages.ts - Message implementations
 * @see /convex/conversations.ts - Parent conversation implementations
 */

import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  advanceTime,
} from "../../test-utils/convex";
import { api } from "../_generated/api";

// ============================================================================
// CONVERSATION MESSAGES TESTS
// ============================================================================

describe("conversationMessages", () => {
  // Set up fake timers for scheduler tests (needed for time-based ordering)
  setupSchedulerTests();

  // ============================================================================
  // createUserMessage TESTS
  // ============================================================================

  describe("createUserMessage", () => {
    it("creates a user message with role='user'", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation first
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      // Create a user message
      const messageId = await asUser.mutation(
        api.conversationMessages.createUserMessage,
        {
          conversationId,
          content: "Hello, this is a test message",
        }
      );

      // Verify the message was created with correct role
      const messages = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });

      expect(messages.length).toBe(1);
      expect(messages[0]._id).toBe(messageId);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Hello, this is a test message");
    });

    it("updates conversation lastActiveAt and updatedAt", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      // Get initial timestamps
      const beforeConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      const beforeUpdatedAt = beforeConversation!.updatedAt;
      const beforeLastActiveAt = beforeConversation!.metadata?.lastActiveAt ?? 0;

      // Advance time to ensure different timestamp
      advanceTime(1000);

      // Create a user message
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Test message",
      });

      // Verify timestamps were updated
      const afterConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(afterConversation!.updatedAt).toBeGreaterThan(beforeUpdatedAt);
      expect(afterConversation!.metadata?.lastActiveAt ?? 0).toBeGreaterThan(
        beforeLastActiveAt
      );
    });

    it("throws for non-owned conversation", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      // User 2 tries to create a message in User 1's conversation
      await expect(
        asUser2.mutation(api.conversationMessages.createUserMessage, {
          conversationId,
          content: "Trying to post in someone else's conversation",
        })
      ).rejects.toThrow("Access denied: you do not own this conversation");
    });
  });

  // ============================================================================
  // createAssistantMessage TESTS
  // ============================================================================

  describe("createAssistantMessage", () => {
    it("creates an assistant message with role='assistant'", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation first
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      // Create an assistant message
      const messageId = await asUser.mutation(
        api.conversationMessages.createAssistantMessage,
        {
          conversationId,
          content: "Hello! How can I help you today?",
        }
      );

      // Verify the message was created with correct role
      const messages = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });

      expect(messages.length).toBe(1);
      expect(messages[0]._id).toBe(messageId);
      expect(messages[0].role).toBe("assistant");
      expect(messages[0].content).toBe("Hello! How can I help you today?");
    });

    it("stores optional metadata (model, processingTimeMs, tokenCount)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation first
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      // Create an assistant message with metadata
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Here is your response",
        metadata: {
          model: "gemini-2.0-flash",
          processingTimeMs: 1234,
          tokenCount: 456,
        },
      });

      // Verify the metadata was stored
      const messages = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });

      expect(messages.length).toBe(1);
      expect(messages[0].metadata).toBeDefined();
      expect(messages[0].metadata!.model).toBe("gemini-2.0-flash");
      expect(messages[0].metadata!.processingTimeMs).toBe(1234);
      expect(messages[0].metadata!.tokenCount).toBe(456);
    });

    it("auto-generates title from first user message when message count becomes 2", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation with default title
      const conversationId = await asUser.mutation(api.conversations.create, {});

      // Verify initial title is "New Conversation"
      const beforeConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(beforeConversation!.title).toBe("New Conversation");

      // Create first user message
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "What are PERM deadlines?",
      });

      // Verify title is still "New Conversation" (only 1 message)
      const afterUserMessage = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(afterUserMessage!.title).toBe("New Conversation");

      // Advance time to ensure proper ordering
      advanceTime(100);

      // Create first assistant message (triggers auto-title)
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "PERM has several important deadlines...",
      });

      // Verify title was auto-generated from the first user message
      const afterAssistantMessage = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(afterAssistantMessage!.title).toBe("What are PERM deadlines?");
    });

    it("truncates long titles to 50 chars with '...'", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation with default title
      const conversationId = await asUser.mutation(api.conversations.create, {});

      // Create first user message with very long content (more than 50 chars)
      const longMessage =
        "What are all the important deadlines for the PERM labor certification process that I need to track?";
      expect(longMessage.length).toBeGreaterThan(50);

      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: longMessage,
      });

      advanceTime(100);

      // Create first assistant message (triggers auto-title)
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Here are the key PERM deadlines...",
      });

      // Verify title was truncated to 50 chars + "..."
      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation!.title.length).toBe(53); // 50 chars + "..."
      expect(conversation!.title.endsWith("...")).toBe(true);
      expect(conversation!.title).toBe(longMessage.substring(0, 50) + "...");
    });

    it("does NOT update title if already custom", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation with custom title
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "My Custom Title",
      });

      // Create user message
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "What are PERM deadlines?",
      });

      advanceTime(100);

      // Create assistant message
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "PERM has several important deadlines...",
      });

      // Verify title was NOT changed (already custom, not "New Conversation")
      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(conversation!.title).toBe("My Custom Title");
    });

    it("does NOT update title on subsequent assistant messages", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation
      const conversationId = await asUser.mutation(api.conversations.create, {});

      // Create first user message
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "First question",
      });

      advanceTime(100);

      // Create first assistant message (triggers auto-title to "First question")
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "First answer",
      });

      // Verify title is now "First question"
      let conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(conversation!.title).toBe("First question");

      advanceTime(100);

      // Create second user message
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Second question",
      });

      advanceTime(100);

      // Create second assistant message (should NOT change title)
      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Second answer",
      });

      // Verify title is still "First question"
      conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(conversation!.title).toBe("First question");
    });

    it("throws for non-owned conversation", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      // User 2 tries to create an assistant message in User 1's conversation
      await expect(
        asUser2.mutation(api.conversationMessages.createAssistantMessage, {
          conversationId,
          content: "Trying to impersonate the assistant",
        })
      ).rejects.toThrow("Access denied: you do not own this conversation");
    });
  });

  // ============================================================================
  // list TESTS
  // ============================================================================

  describe("list", () => {
    it("returns messages in chronological order (oldest first)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      // Create messages with time gaps
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "First message",
      });

      advanceTime(1000);

      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Second message",
      });

      advanceTime(1000);

      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Third message",
      });

      // Get messages
      const messages = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });

      // Verify chronological order (oldest first for chat display)
      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe("First message");
      expect(messages[1].content).toBe("Second message");
      expect(messages[2].content).toBe("Third message");

      // Verify timestamps are in ascending order
      expect(messages[0].createdAt).toBeLessThan(messages[1].createdAt);
      expect(messages[1].createdAt).toBeLessThan(messages[2].createdAt);
    });

    it("returns empty array for other user's conversation", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation with messages
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      await asUser1.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "User One's message",
      });

      // User 2 tries to list messages
      const messages = await asUser2.query(api.conversationMessages.list, {
        conversationId,
      });

      // Should return empty array (security: don't reveal existence)
      expect(messages).toEqual([]);
    });

    it("returns empty array for non-existent conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create and immediately delete a conversation to get a valid ID format
      const conversationId = await asUser.mutation(api.conversations.create, {});
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      // Try to list messages for the deleted conversation
      const messages = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });

      // Should return empty array
      expect(messages).toEqual([]);
    });
  });

  // ============================================================================
  // count TESTS
  // ============================================================================

  describe("count", () => {
    it("returns correct message count", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      // Verify initial count is 0
      let messageCount = await asUser.query(api.conversationMessages.count, {
        conversationId,
      });
      expect(messageCount).toBe(0);

      // Add messages
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Message 1",
      });

      messageCount = await asUser.query(api.conversationMessages.count, {
        conversationId,
      });
      expect(messageCount).toBe(1);

      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Message 2",
      });

      messageCount = await asUser.query(api.conversationMessages.count, {
        conversationId,
      });
      expect(messageCount).toBe(2);

      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Message 3",
      });

      messageCount = await asUser.query(api.conversationMessages.count, {
        conversationId,
      });
      expect(messageCount).toBe(3);
    });

    it("returns 0 for other user's conversation", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation with messages
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      await asUser1.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "User One's message",
      });

      await asUser1.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Assistant response",
      });

      // User 1 should see 2 messages
      const user1Count = await asUser1.query(api.conversationMessages.count, {
        conversationId,
      });
      expect(user1Count).toBe(2);

      // User 2 should see 0 messages (security: don't reveal existence)
      const user2Count = await asUser2.query(api.conversationMessages.count, {
        conversationId,
      });
      expect(user2Count).toBe(0);
    });

    it("returns 0 for non-existent conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create and immediately delete a conversation to get a valid ID format
      const conversationId = await asUser.mutation(api.conversations.create, {});
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      // Try to count messages for the deleted conversation
      const messageCount = await asUser.query(api.conversationMessages.count, {
        conversationId,
      });

      // Should return 0
      expect(messageCount).toBe(0);
    });
  });

  // ============================================================================
  // getMostRecent TESTS
  // ============================================================================

  describe("getMostRecent", () => {
    it("returns most recently updated conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create conversations with time gaps
      await asUser.mutation(api.conversations.create, {
        title: "Older Conversation",
      });

      advanceTime(1000);

      await asUser.mutation(api.conversations.create, {
        title: "Newer Conversation",
      });

      advanceTime(1000);

      const mostRecentId = await asUser.mutation(api.conversations.create, {
        title: "Most Recent Conversation",
      });

      // Get most recent
      const mostRecent = await asUser.query(
        api.conversationMessages.getMostRecent,
        {}
      );

      expect(mostRecent).not.toBeNull();
      expect(mostRecent!._id).toBe(mostRecentId);
      expect(mostRecent!.title).toBe("Most Recent Conversation");
    });

    it("returns conversation with most recent updatedAt, not createdAt", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create an older conversation
      const olderConvId = await asUser.mutation(api.conversations.create, {
        title: "Older Conversation",
      });

      advanceTime(1000);

      // Create a newer conversation
      await asUser.mutation(api.conversations.create, {
        title: "Newer Conversation",
      });

      advanceTime(1000);

      // Update the older conversation (should make it most recent by updatedAt)
      await asUser.mutation(api.conversations.updateTitle, {
        id: olderConvId,
        title: "Updated Older Conversation",
      });

      // Get most recent
      const mostRecent = await asUser.query(
        api.conversationMessages.getMostRecent,
        {}
      );

      expect(mostRecent).not.toBeNull();
      expect(mostRecent!._id).toBe(olderConvId);
      expect(mostRecent!.title).toBe("Updated Older Conversation");
    });

    it("returns null when no conversations exist", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // User has no conversations
      const mostRecent = await asUser.query(
        api.conversationMessages.getMostRecent,
        {}
      );

      expect(mostRecent).toBeNull();
    });

    it("isolates by user (returns null for user with no conversations)", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates conversations
      await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      // User 2 should get null (no conversations)
      const user2MostRecent = await asUser2.query(
        api.conversationMessages.getMostRecent,
        {}
      );
      expect(user2MostRecent).toBeNull();

      // User 1 should get their conversation
      const user1MostRecent = await asUser1.query(
        api.conversationMessages.getMostRecent,
        {}
      );
      expect(user1MostRecent).not.toBeNull();
      expect(user1MostRecent!.title).toBe("User One's Conversation");
    });
  });
});
