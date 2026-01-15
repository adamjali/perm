/**
 * Conversation Summarization Module
 *
 * Provides client-side function to trigger LLM-based conversation summarization.
 * Uses a fast, lightweight model (Gemini 2.0 Flash Lite) for efficient summarization.
 *
 * @module lib/ai/summarize
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
  SUMMARIZATION_PROMPT,
  RECENT_MESSAGES_TO_KEEP,
} from "@/../convex/conversationSummary";

/**
 * Summarization model - using Gemini 2.0 Flash Lite for speed
 * This is a lightweight model optimized for summarization tasks.
 */
const summarizationModel = google("gemini-2.0-flash-lite");

/**
 * Approximate tokens per character for rough token counting
 * English text averages about 4 characters per token
 */
const CHARS_PER_TOKEN = 4;

/**
 * Estimate token count from text length
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Message type for summarization
 */
interface SummarizationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: Array<{
    tool: string;
    arguments: string;
    result?: string;
  }>;
}

/**
 * Format messages for summarization prompt
 */
function formatMessagesForSummary(
  messages: SummarizationMessage[],
  existingSummary: string | null
): string {
  let promptContent = "";

  // Include existing summary if present
  if (existingSummary) {
    promptContent += `## Previous Summary\n${existingSummary}\n\n## New Messages to Incorporate\n`;
  } else {
    promptContent += "## Conversation History\n";
  }

  // Format each message
  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "User" : "Assistant";
    promptContent += `\n**${roleLabel}:** ${msg.content}\n`;

    // Include tool call information if present
    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        promptContent += `  [Tool: ${tc.tool}]\n`;
        if (tc.result) {
          // Truncate long results
          const resultPreview =
            tc.result.length > 200
              ? tc.result.slice(0, 200) + "..."
              : tc.result;
          promptContent += `  Result: ${resultPreview}\n`;
        }
      }
    }
  }

  return promptContent;
}

/**
 * Summarize a conversation's history
 *
 * This function:
 * 1. Fetches messages that need summarization from Convex
 * 2. Generates a summary using the LLM
 * 3. Saves the summary back to Convex
 *
 * The function runs asynchronously and does NOT block the chat response.
 *
 * @param conversationId - The conversation to summarize
 * @param token - Auth token for Convex API calls
 * @returns Promise that resolves when summarization is complete
 */
export async function summarizeConversation(
  conversationId: Id<"conversations">,
  token: string
): Promise<void> {
  const startTime = Date.now();
  console.log(
    `[Summarization] Starting summarization for conversation ${conversationId}`
  );

  try {
    // Fetch messages that need to be summarized
    const { messages, existingSummary, totalMessageCount } = await fetchQuery(
      api.conversationSummary.getMessagesToSummarize,
      { conversationId },
      { token }
    );

    if (messages.length === 0) {
      console.log(`[Summarization] No messages to summarize, skipping`);
      return;
    }

    // Calculate original message content size
    const originalContentSize = messages.reduce(
      (acc: number, m: SummarizationMessage) => acc + m.content.length,
      0
    );

    console.log(
      `[Summarization] Summarizing ${messages.length} messages (${originalContentSize} chars)`
    );

    // Format messages for the summarization prompt
    const formattedContent = formatMessagesForSummary(messages, existingSummary);

    // Generate summary using LLM
    const { text: summaryText } = await generateText({
      model: summarizationModel,
      system: SUMMARIZATION_PROMPT,
      prompt: formattedContent,
      maxOutputTokens: 1000, // Keep summaries concise
    });

    // Calculate compression ratio
    const originalTokenEstimate = estimateTokenCount(
      existingSummary
        ? existingSummary + formattedContent
        : formattedContent
    );
    const summaryTokenEstimate = estimateTokenCount(summaryText);
    const compressionRatio = (
      ((originalTokenEstimate - summaryTokenEstimate) / originalTokenEstimate) *
      100
    ).toFixed(1);

    console.log(
      `[Summarization] Compression: ${originalTokenEstimate} -> ${summaryTokenEstimate} tokens (${compressionRatio}% reduction)`
    );

    // Save the summary to Convex
    // messageCountAtSummary = totalMessageCount - RECENT_MESSAGES_TO_KEEP
    // This marks where we've summarized up to
    const messageCountAtSummary = totalMessageCount - RECENT_MESSAGES_TO_KEEP;

    await fetchMutation(
      api.conversationSummary.saveSummary,
      {
        conversationId,
        content: summaryText,
        tokenCount: summaryTokenEstimate,
        messageCountAtSummary,
      },
      { token }
    );

    const duration = Date.now() - startTime;
    console.log(
      `[Summarization] Completed in ${duration}ms, summary covers messages 1-${messageCountAtSummary}`
    );
  } catch (error) {
    // Don't let summarization errors affect the main chat flow
    console.error(`[Summarization] Error:`, error);
    // Don't rethrow - summarization is non-critical
  }
}

/**
 * Check if a conversation needs summarization
 *
 * This is a lightweight check that can be called after each response
 * to determine if summarization should be triggered.
 *
 * @param conversationId - The conversation to check
 * @param token - Auth token for Convex API calls
 * @returns Promise<boolean> - True if summarization is needed
 */
export async function checkNeedsSummarization(
  conversationId: Id<"conversations">,
  token: string
): Promise<boolean> {
  try {
    return await fetchQuery(
      api.conversationSummary.needsSummarization,
      { conversationId },
      { token }
    );
  } catch (error) {
    console.error(`[Summarization] Error checking summarization need:`, error);
    return false;
  }
}
