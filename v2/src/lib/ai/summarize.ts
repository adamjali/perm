/**
 * Conversation Summarization Module
 *
 * Two-phase background pipeline:
 *   Phase 1, Entity extraction (Cerebras llama3.1-8b, ~200ms):
 *     Extracts structured facts (cases, people, dates, preferences, openActions)
 *     as JSON. Merged losslessly with existing facts. Survives unlimited compactions.
 *
 *   Phase 2, Prose summary (Mistral Small, fallback: Groq 70B):
 *     Generates a single replacement prose summary bounded at ~1000 tokens.
 *     Never stacks, each cycle replaces the prior prose summary.
 *
 * Race protection: atomic beginSummarizing/finishSummarizing lock with 60s TTL.
 * Non-blocking: errors never propagate to the chat flow; the conversation still works.
 *
 * @module lib/ai/summarize
 */

import { generateObject, generateText } from "ai";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { RECENT_MESSAGES_TO_KEEP } from "@/../convex/conversationSummary";
import { captureError } from "@/lib/sentry";
import {
  CompactionFactsSchema,
  estimateStringTokens,
  mergeFacts,
  parseFacts,
  type CompactionFacts,
} from "./compaction";
import { cerebras, groq, mistral } from "./providers";

/** Cerebras is ideal for extraction: fast, cheap, structured-output capable. */
const entityExtractionModel = cerebras("llama3.1-8b");

/** Primary prose summarizer — Mistral Small. */
const prosePrimaryModel = mistral("mistral-small-latest");

/** Fallback prose summarizer — Groq 70B. Used if Mistral fails. */
const proseFallbackModel = groq("llama-3.3-70b-versatile");

/**
 * Message type for summarization (matches Convex return shape).
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

const ENTITY_EXTRACTION_PROMPT = `Extract structured facts from this conversation snippet.

Return a JSON object with these optional fields:
- cases: PERM case IDs (strings) or {id, status} objects if status is explicit
- people: {name, role} objects where role is e.g. "beneficiary", "employer rep"
- dates: key→date strings, e.g. {"pwdFiling": "2024-06-15", "recruitment": "2024-09-01"}
- preferences: explicit user preferences, e.g. ["bullet summaries", "concise answers"]
- openActions: work items not yet completed, e.g. ["waiting for RFE response"]

Omit any field with no entries. Never invent facts. Only extract what's explicitly stated.
`;

const PROSE_SUMMARIZATION_PROMPT = `You are a conversation summarizer for a PERM immigration case tracking assistant.

Summarize the following conversation history, preserving:
1. Key questions the user asked and their answers
2. Important case context (relationships, open items, constraints)
3. Action items or decisions made

Exclude:
- Pleasantries or greetings
- Redundant information
- Verbatim quotes unless legally critical
- Specific case IDs, dates, and names (those are stored separately in structured facts)

Format: a brief narrative (2–4 paragraphs, <1000 tokens). Focus on continuity for the next turn.`;

/**
 * Format messages for the prose summarization prompt.
 */
function formatMessagesForSummary(
  messages: SummarizationMessage[],
  existingSummary: string | null,
): string {
  let out = "";

  if (existingSummary) {
    out += `## Previous Summary\n${existingSummary}\n\n## New Messages to Incorporate\n`;
  } else {
    out += "## Conversation History\n";
  }

  for (const msg of messages) {
    const roleLabel =
      msg.role === "user" ? "User" : msg.role === "system" ? "System" : "Assistant";
    out += `\n**${roleLabel}:** ${msg.content}\n`;

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        out += `  [Tool: ${tc.tool}]\n`;
        if (tc.result) {
          const preview =
            tc.result.length > 200 ? tc.result.slice(0, 200) + "..." : tc.result;
          out += `  Result: ${preview}\n`;
        }
      }
    }
  }

  return out;
}

/**
 * Phase 1, extract structured facts from messages. Non-throwing.
 * Returns undefined on any failure (prose-only summary still works).
 */
async function extractEntities(
  messages: SummarizationMessage[],
): Promise<CompactionFacts | undefined> {
  try {
    const text = formatMessagesForSummary(messages, null);
    const { object } = await generateObject({
      model: entityExtractionModel,
      schema: CompactionFactsSchema,
      system: ENTITY_EXTRACTION_PROMPT,
      prompt: text,
      maxOutputTokens: 800,
    });
    return object;
  } catch (error) {
    console.warn(
      `[Summarization] Entity extraction failed (non-fatal):`,
      error instanceof Error ? error.message : error,
    );
    captureError(error, { operation: "summarization.extractEntities" });
    return undefined;
  }
}

/**
 * Phase 2, generate a prose summary with Mistral, falling back to Groq on failure.
 * Returns null on double failure (caller logs and skips saving).
 */
async function generateProseSummary(
  messages: SummarizationMessage[],
  existingSummary: string | null,
): Promise<string | null> {
  const formatted = formatMessagesForSummary(messages, existingSummary);

  try {
    const { text } = await generateText({
      model: prosePrimaryModel,
      system: PROSE_SUMMARIZATION_PROMPT,
      prompt: formatted,
      maxOutputTokens: 1000,
    });
    return text;
  } catch (primaryError) {
    console.warn(
      `[Summarization] Mistral prose failed, falling back to Groq:`,
      primaryError instanceof Error ? primaryError.message : primaryError,
    );
    captureError(primaryError, {
      operation: "summarization.prose.mistral",
    });

    try {
      const { text } = await generateText({
        model: proseFallbackModel,
        system: PROSE_SUMMARIZATION_PROMPT,
        prompt: formatted,
        maxOutputTokens: 1000,
      });
      return text;
    } catch (fallbackError) {
      console.error(
        `[Summarization] Groq fallback also failed:`,
        fallbackError instanceof Error ? fallbackError.message : fallbackError,
      );
      captureError(fallbackError, {
        operation: "summarization.prose.groqFallback",
      });
      return null;
    }
  }
}

/**
 * Summarize a conversation's history.
 *
 * Two-phase:
 *   1. Entity extraction (Cerebras), merged with existing facts
 *   2. Prose summary (Mistral → Groq fallback), replaces existing prose
 *
 * Atomic lock via beginSummarizing prevents concurrent summarization of the
 * same conversation. Errors never propagate, chat flow is always preserved.
 *
 * @param conversationId - The conversation to summarize
 * @param token - Auth token for Convex API calls
 */
export async function summarizeConversation(
  conversationId: Id<"conversations">,
  token: string,
): Promise<void> {
  const startTime = Date.now();

  // Claim the lock atomically. If another process holds it, back off.
  let locked = false;
  try {
    locked = await fetchMutation(
      api.conversationSummary.beginSummarizing,
      { conversationId },
      { token },
    );
  } catch (error) {
    console.warn(
      `[Summarization] Failed to claim lock, skipping:`,
      error instanceof Error ? error.message : error,
    );
    return;
  }

  if (!locked) {
    console.log(
      `[Summarization] Skipped, another process holds the lock for ${conversationId}`,
    );
    return;
  }

  // Best-effort lock release shared by every early-exit / error branch below.
  // A failed release is swallowed: the 60s TTL auto-clears a stale lock
  // (SUMMARIZATION_LOCK_TTL_MS), so retrying isn't worth it.
  const releaseLock = async (): Promise<void> => {
    try {
      await fetchMutation(
        api.conversationSummary.finishSummarizing,
        { conversationId },
        { token },
      );
    } catch {
      // Stale lock will auto-clear after 60s — not worth retrying.
    }
  };

  try {
    const { messages, existingSummary, existingFacts, totalMessageCount } =
      await fetchQuery(
        api.conversationSummary.getMessagesToSummarize,
        { conversationId },
        { token },
      );

    if (messages.length === 0) {
      console.log(`[Summarization] No messages to summarize, releasing lock`);
      await releaseLock();
      return;
    }

    const originalContentSize = messages.reduce(
      (acc: number, m: SummarizationMessage) => acc + m.content.length,
      0,
    );
    console.log(
      `[Summarization] Starting ${messages.length} msgs (${originalContentSize} chars) for ${conversationId}`,
    );

    // Run phases in parallel — they're independent.
    const [facts, proseText] = await Promise.all([
      extractEntities(messages),
      generateProseSummary(messages, existingSummary),
    ]);

    if (proseText === null) {
      // Both prose models failed — release lock without saving.
      console.error(
        `[Summarization] All prose models failed, releasing lock without updating`,
      );
      await releaseLock();
      return;
    }

    // Merge facts (lossless across compactions)
    const existingFactsObj = parseFacts(existingFacts ?? undefined);
    const mergedFacts = mergeFacts(existingFactsObj, facts);
    const factsJson = mergedFacts ? JSON.stringify(mergedFacts) : undefined;

    const messageCountAtSummary = totalMessageCount - RECENT_MESSAGES_TO_KEEP;

    await fetchMutation(
      api.conversationSummary.saveSummary,
      {
        conversationId,
        content: proseText,
        facts: factsJson,
        tokenCount: estimateStringTokens(proseText),
        messageCountAtSummary,
      },
      { token },
    );

    const duration = Date.now() - startTime;
    const factsCount = mergedFacts ? Object.keys(mergedFacts).length : 0;
    console.log(
      `[Summarization] Completed in ${duration}ms: prose ${estimateStringTokens(proseText)} tokens, facts ${factsCount} categories`,
    );
  } catch (error) {
    console.error(`[Summarization] Error:`, error);
    captureError(error, {
      operation: "summarization.generate",
      extra: { conversationId },
    });
    // Release the lock on any unexpected error.
    await releaseLock();
  }
}

/**
 * Lightweight check that can be called after each response to determine
 * whether summarization should be triggered for a conversation.
 */
export async function checkNeedsSummarization(
  conversationId: Id<"conversations">,
  token: string,
): Promise<boolean> {
  try {
    return await fetchQuery(
      api.conversationSummary.needsSummarization,
      { conversationId },
      { token },
    );
  } catch (error) {
    console.error(`[Summarization] Error checking summarization need:`, error);
    captureError(error);
    return false;
  }
}
