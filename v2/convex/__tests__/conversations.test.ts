/**
 * Conversations CRUD Tests
 *
 * Comprehensive tests for the conversation management module:
 * - create: Create new conversations with optional title and metadata
 * - get: Retrieve a single conversation by ID with ownership verification
 * - list: List user's conversations
 * - updateTitle: Update conversation title with ownership verification
 * - deleteConversation: Permanently delete conversation and all messages
 *
 * @see /convex/conversations.ts - Conversation implementations
 * @see /convex/conversationMessages.ts - Message implementations
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
// CONVERSATIONS TESTS
// ============================================================================

describe("conversations", () => {
  // Set up fake timers for scheduler tests (needed for time-based ordering)
  setupSchedulerTests();

  // ============================================================================
  // create TESTS
  // ============================================================================

  describe("create", () => {
    it("creates a new conversation with default title 'New Conversation'", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {});

      // Verify the conversation was created
      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).not.toBeNull();
      expect(conversation!.title).toBe("New Conversation");
      expect(conversation!.isArchived).toBe(false);
    });

    it("creates with custom title", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "My Custom Conversation",
      });

      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).not.toBeNull();
      expect(conversation!.title).toBe("My Custom Conversation");
    });

    it("creates with metadata (conversationType)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Case Question",
        metadata: {
          conversationType: "case_inquiry",
        },
      });

      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).not.toBeNull();
      expect(conversation!.metadata?.conversationType).toBe("case_inquiry");
    });

    it("creates with all metadata fields", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Full Metadata Test",
        metadata: {
          conversationType: "deadline_help",
          tags: ["pwd", "urgent"],
        },
      });

      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).not.toBeNull();
      expect(conversation!.metadata?.conversationType).toBe("deadline_help");
      expect(conversation!.metadata?.tags).toEqual(["pwd", "urgent"]);
    });

    it("sets default metadata values when not provided", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {});

      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).not.toBeNull();
      expect(conversation!.metadata?.conversationType).toBe("general");
      expect(conversation!.metadata?.tags).toEqual([]);
      expect(conversation!.metadata?.lastActiveAt).toBeDefined();
    });
  });

  // ============================================================================
  // get TESTS
  // ============================================================================

  describe("get", () => {
    it("returns conversation for owner", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Test Conversation",
      });

      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).not.toBeNull();
      expect(conversation!._id).toBe(conversationId);
      expect(conversation!.title).toBe("Test Conversation");
    });

    it("returns null for non-existent conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation to get a valid ID format, then delete it directly
      const conversationId = await asUser.mutation(api.conversations.create, {});
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      // Now try to get the deleted conversation
      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation).toBeNull();
    });

    it("returns null for other user's conversation (user isolation)", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      // User 2 tries to access it
      const conversation = await asUser2.query(api.conversations.get, {
        id: conversationId,
      });

      // Should return null, not throw an error (security: don't reveal existence)
      expect(conversation).toBeNull();
    });
  });

  // ============================================================================
  // list TESTS
  // ============================================================================

  describe("list", () => {
    it("lists active conversations (sorted by updatedAt desc)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create conversations with time gaps to ensure distinct updatedAt values
      await asUser.mutation(api.conversations.create, {
        title: "First Conversation",
      });
      advanceTime(1000);

      await asUser.mutation(api.conversations.create, {
        title: "Second Conversation",
      });
      advanceTime(1000);

      await asUser.mutation(api.conversations.create, {
        title: "Third Conversation",
      });

      const conversations = await asUser.query(api.conversations.list, {});

      expect(conversations.length).toBe(3);
      // Most recently updated should be first
      expect(conversations[0].title).toBe("Third Conversation");
      expect(conversations[1].title).toBe("Second Conversation");
      expect(conversations[2].title).toBe("First Conversation");
    });

    it("isolates by user (other user sees empty list)", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates conversations
      await asUser1.mutation(api.conversations.create, {
        title: "User One Conv 1",
      });
      await asUser1.mutation(api.conversations.create, {
        title: "User One Conv 2",
      });

      // User 2 should see an empty list
      const user2Conversations = await asUser2.query(api.conversations.list, {});
      expect(user2Conversations.length).toBe(0);

      // User 1 should see their conversations
      const user1Conversations = await asUser1.query(api.conversations.list, {});
      expect(user1Conversations.length).toBe(2);
    });

    it("returns empty array for user with no conversations", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "New User");

      const conversations = await asUser.query(api.conversations.list, {});

      expect(conversations).toEqual([]);
    });
  });

  // ============================================================================
  // updateTitle TESTS
  // ============================================================================

  describe("updateTitle", () => {
    it("updates conversation title", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Original Title",
      });

      await asUser.mutation(api.conversations.updateTitle, {
        id: conversationId,
        title: "Updated Title",
      });

      const conversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(conversation!.title).toBe("Updated Title");
    });

    it("updates updatedAt timestamp", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Original Title",
      });

      const beforeConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      const beforeUpdatedAt = beforeConversation!.updatedAt;

      // Advance time to ensure different timestamp
      advanceTime(1000);

      await asUser.mutation(api.conversations.updateTitle, {
        id: conversationId,
        title: "Updated Title",
      });

      const afterConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });

      expect(afterConversation!.updatedAt).toBeGreaterThan(beforeUpdatedAt);
    });

    it("throws for other user's conversation", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      // User 2 tries to update it
      await expect(
        asUser2.mutation(api.conversations.updateTitle, {
          id: conversationId,
          title: "Hacked Title",
        })
      ).rejects.toThrow("Access denied: you do not own this conversation");
    });

    it("throws for non-existent conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create and immediately delete a conversation to get a valid-looking ID
      const conversationId = await asUser.mutation(api.conversations.create, {});
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      await expect(
        asUser.mutation(api.conversations.updateTitle, {
          id: conversationId,
          title: "New Title",
        })
      ).rejects.toThrow("Conversation not found");
    });
  });

  // ============================================================================
  // deleteConversation TESTS
  // ============================================================================

  describe("deleteConversation", () => {
    it("deletes conversation and all its messages", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create a conversation
      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Conversation to Delete",
      });

      // Add some messages to the conversation
      await asUser.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Hello, this is a test message",
      });

      await asUser.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content: "Hello! How can I help you today?",
      });

      // Verify messages exist
      const messagesBefore = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });
      expect(messagesBefore.length).toBe(2);

      // Delete the conversation
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      // Verify conversation is deleted
      const deletedConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(deletedConversation).toBeNull();

      // Verify messages are also deleted (list returns empty for non-existent conversation)
      const messagesAfter = await asUser.query(api.conversationMessages.list, {
        conversationId,
      });
      expect(messagesAfter).toEqual([]);
    });

    it("throws for other user's conversation", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a conversation
      const conversationId = await asUser1.mutation(api.conversations.create, {
        title: "User One's Conversation",
      });

      // User 2 tries to delete it
      await expect(
        asUser2.mutation(api.conversations.deleteConversation, {
          id: conversationId,
        })
      ).rejects.toThrow("Access denied: you do not own this conversation");

      // Verify the conversation still exists for User 1
      const conversation = await asUser1.query(api.conversations.get, {
        id: conversationId,
      });
      expect(conversation).not.toBeNull();
    });

    it("throws for non-existent conversation", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create and immediately delete to get a valid ID format
      const conversationId = await asUser.mutation(api.conversations.create, {});
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      // Try to delete again
      await expect(
        asUser.mutation(api.conversations.deleteConversation, {
          id: conversationId,
        })
      ).rejects.toThrow("Conversation not found");
    });

    it("deletes conversation with no messages successfully", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      const conversationId = await asUser.mutation(api.conversations.create, {
        title: "Empty Conversation",
      });

      // Delete without adding any messages
      await asUser.mutation(api.conversations.deleteConversation, {
        id: conversationId,
      });

      const deletedConversation = await asUser.query(api.conversations.get, {
        id: conversationId,
      });
      expect(deletedConversation).toBeNull();
    });
  });
});
