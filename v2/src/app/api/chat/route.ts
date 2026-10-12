/**
 * Chat Streaming API Route
 *
 * Handles AI chat requests with:
 * - Authentication verification
 * - Multi-provider fallback (auto-switches on quota/rate limit errors)
 * - Streaming response with error recovery
 * - Native AI SDK tool calling for case queries, knowledge search, and web search
 * - Conversation context optimization via summarization
 *
 * POST /api/chat
 * Body: { messages: UIMessage[], conversationId?: string }
 * Returns: Streaming response (AI SDK format)
 */

import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from 'ai';
import { after } from 'next/server';
import { isAuthenticatedNextjs, convexAuthNextjsToken } from '@convex-dev/auth/nextjs/server';
import { fetchMutation, fetchQuery } from 'convex/nextjs';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import {
  summarizeConversation,
  checkNeedsSummarization,
} from '@/lib/ai/summarize';
import { chatModel, PRIMARY_MODEL_NAME, reportMidStreamFailure } from '@/lib/ai/providers';
import { compactToFit, compactAt, parseFacts } from '@/lib/ai/compaction';
import { getClientIp } from '@/lib/net/getClientIp';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
import { nowInZone, savedTurns, stepShowedCard } from '@/lib/ai/chatTurn';
import type { ActionMode } from '@/lib/ai/tool-permissions';
import { createCacheStats } from '@/lib/ai/cache';
import { captureError } from '@/lib/sentry';
import { getPostHogClient } from '@/lib/posthog-server';
import { chatDebug, createTools, truncateForLog } from './create-tools';
import { CHAT_MAX_OUTPUT_TOKENS, CHAT_MAX_STEPS, chatIpLimitBody, chatUserLimitBody, cutShortFrom } from '@/lib/ai/limits';
import { CHAT_LIMITS, CONVERSATION_FULL_MESSAGE } from '@convex/lib/chatLimits';

// Up to 60 seconds for streaming responses (extra time for fallbacks + tool
// calls), for platforms that read maxDuration. On our own server `next start`
// doesn't enforce it; nginx's proxy_read_timeout (300 s) is the real limit.
export const maxDuration = 60;

/**
 * Generate unique session ID for request tracing
 */
function generateSessionId(): string {
  return `chat_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Run the post-response summarization check. Returns a promise so the caller
 * can hand it to `after()`, which keeps the serverless invocation alive until
 * it settles. Never rejects, all errors are captured internally.
 */
async function triggerSummarizationCheck(
  conversationId: Id<"conversations">,
  token: string,
  sessionId: string
): Promise<void> {
  try {
    const needsSummary = await checkNeedsSummarization(conversationId, token);
    if (needsSummary) {
      chatDebug(`[Chat API] [${sessionId}] Triggering async summarization`);
      await summarizeConversation(conversationId, token);
    }
  } catch (error) {
    console.error(`[Chat API] [${sessionId}] Summarization check failed:`, error);
    captureError(error);
  }
}

export async function POST(req: Request) {
  const sessionId = generateSessionId();
  chatDebug(`[Chat API] [${sessionId}] === New chat request ===`);

  try {
    // Per-IP rate limit — caps one source from burning through AI quotas
    // regardless of which signed-in user is calling. The chat also needs a
    // session (sign-up is Turnstile-gated) and carries a per-user quota.
    // getClientIp() reads the address nginx set from Cloudflare's own header,
    // never a client-sent one. "unknown" only when none resolves (local dev).
    const clientIp = getClientIp(req) || "unknown";
    try {
      const ipCheck = await fetchMutation(api.authRateLimit.checkIpRateLimit, {
        ip: clientIp,
        action: "ip_chat",
        // Convex counts only calls carrying it (convex/lib/serverDoor.ts).
        serverSecret: process.env.API_SERVER_SECRET,
      });
      if (!ipCheck.allowed) {
        chatDebug(`[Chat API] [${sessionId}] IP rate limit hit`);
        // Say which limit and how long, in nginx's JSON shape, so the panel
        // shows the wait instead of "the AI services didn't respond".
        const body = chatIpLimitBody(
          ipCheck.retryAfterMs ?? 0,
          (ipCheck.message ?? '').includes('blocked'),
        );
        return new Response(JSON.stringify(body), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": String(body.retryAfter) },
        });
      }
    } catch (ipError) {
      // Fail open on rate-limit service error — better availability than
      // blocking legitimate users for an infrastructure glitch. captureError so
      // a sustained limiter outage (silent loss of per-IP protection) is visible
      // in Sentry, not just console.
      console.warn(`[Chat API] [${sessionId}] IP rate-limit check failed, allowing:`, ipError);
      captureError(ipError, { operation: 'chat.ipRateLimit.failOpen', extra: { sessionId } });
    }

    // Verify authentication (chatbot is authenticated-only)
    const isAuthenticated = await isAuthenticatedNextjs();
    if (!isAuthenticated) {
      chatDebug(`[Chat API] [${sessionId}] Auth failed: not authenticated`);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token for tool execution (needed for Convex API calls)
    const token = await convexAuthNextjsToken();
    if (!token) {
      console.error(`[Chat API] [${sessionId}] Failed to get auth token`);
      return new Response(
        JSON.stringify({ error: 'Authentication error' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // One account's turns (convex/chatQuota.ts): the AI providers' free
    // quotas are shared, so one account can't spend them all. Fails open like
    // the per-address check, and says so in Sentry.
    try {
      const turn = await fetchMutation(api.chatQuota.takeTurn, {}, { token });
      if (!turn.ok) {
        const body = chatUserLimitBody(turn.retryAfterMs, turn.window);
        return new Response(JSON.stringify(body), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(body.retryAfter) },
        });
      }
    } catch (quotaError) {
      console.warn(`[Chat API] [${sessionId}] Chat quota check failed, allowing:`, quotaError instanceof Error ? quotaError.message : quotaError);
      captureError(quotaError, { operation: 'chat.userQuota.failOpen', extra: { sessionId } });
    }

    // Parse request body
    const {
      messages: sessionMessages,
      history,
      conversationId,
      pageContext,
    }: {
      messages: UIMessage[];
      history?: unknown;
      conversationId?: string;
      pageContext?: {
        path?: string;
        pageType?: string;
        currentCaseId?: string;
        visibleCaseIds?: string[];
        filters?: Record<string, unknown>;
        pagination?: { page?: number; pageSize?: number; totalCount?: number };
        selectedCaseIds?: string[];
        [key: string]: unknown;
      };
    } = await req.json();
    // The saved turns from before the client's session (useChatWithPersistence
    // historyForModel), then the session's own: after a reload the session
    // holds none of the conversation. Text only, kept to their bounds.
    const messages: UIMessage[] = Array.isArray(sessionMessages)
      ? [...savedTurns(history), ...sessionMessages]
      : sessionMessages;
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.parts
      ? lastMessage.parts.filter((p): p is { type: 'text'; text: string } => (p as { type: string }).type === 'text').map(p => p.text).join(' ')
      : JSON.stringify(lastMessage);
    chatDebug(`[Chat API] [${sessionId}] User message:`, truncateForLog(messageContent));
    if (conversationId) {
      chatDebug(`[Chat API] [${sessionId}] Conversation ID: ${conversationId}`);
    }
    if (pageContext) {
      chatDebug(`[Chat API] [${sessionId}] Page context:`, truncateForLog(pageContext));
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // The composer stops at the same length; this is for anything else.
    if (lastMessage?.role === 'user' && messageContent.length > CHAT_LIMITS.userMessageChars) {
      return new Response(
        JSON.stringify({
          error: 'message_too_long',
          message: `That message is ${messageContent.length.toLocaleString('en-US')} characters; the chat takes up to ${CHAT_LIMITS.userMessageChars.toLocaleString('en-US')}. Shorten it and send again.`,
        }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // The model's context: the summary of earlier turns (when one exists) and
    // the messages the client sent, which include the saved turns from before
    // this session (useChatWithPersistence seeds them), fitted to the budget.
    // Target ~10k tokens, the smallest model in the chain that isn't skipped.
    const TARGET_TOKENS = 10_000;
    let convertedMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
    let typedConversationId: Id<"conversations"> | null = null;
    const fullMessages = await convertToModelMessages(messages, { ignoreIncompleteToolCalls: true });
    let summary: { content: string; facts: ReturnType<typeof parseFacts> } | undefined;

    if (conversationId) {
      typedConversationId = conversationId as Id<"conversations">;
      try {
        const contextData = await fetchQuery(
          api.conversationSummary.getContextMessages,
          { conversationId: typedConversationId },
          { token }
        );
        // A full conversation takes no new question (convex/lib/chatLimits.ts).
        if (lastMessage?.role === 'user' && contextData.totalMessageCount >= CHAT_LIMITS.messagesPerConversation) {
          return new Response(
            JSON.stringify({ error: 'conversation_full', message: CONVERSATION_FULL_MESSAGE }),
            { status: 409, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (contextData.summary || contextData.facts) {
          summary = { content: contextData.summary ?? '', facts: parseFacts(contextData.facts ?? undefined) };
        }
      } catch (error) {
        console.warn(`[Chat API] [${sessionId}] Failed to get the conversation summary, going on without it:`, error instanceof Error ? error.message : error);
        captureError(error);
      }
    }

    const compactionInput = { messages: fullMessages, summary };
    const compaction = compactToFit(compactionInput, TARGET_TOKENS);
    if (compaction) {
      chatDebug(`[Chat API] [${sessionId}] Compaction L${compaction.level}: ${compaction.estimatedTokens} tokens`);
      convertedMessages = compaction.messages;
    } else {
      // Even L4 didn't fit: one turn is over the budget on its own. L4 keeps
      // the summary envelope; FallbackModel skips models that can't take it.
      console.warn(`[Chat API] [${sessionId}] No compaction level fits ${TARGET_TOKENS} tokens; using L4`);
      captureError(
        new Error(`Compaction L4 still exceeds ${TARGET_TOKENS} tokens`),
        { operation: 'chat.compaction.noFit', extra: { sessionId } },
      );
      convertedMessages = compactAt(4, compactionInput);
    }

    // Create cache stats tracker for this request
    const cacheStats = createCacheStats();

    // Fetch action mode + user profile in parallel (profile needed for PostHog attribution)
    let actionMode: ActionMode = 'confirm'; // Default to safest mode
    const actionModePromise = fetchQuery(api.users.getActionMode, {}, { token });
    const profilePromise = fetchQuery(api.users.currentUserProfile, {}, { token }).catch(() => null);
    try {
      const userActionMode = await actionModePromise;
      actionMode = userActionMode as ActionMode;
      chatDebug(`[Chat API] [${sessionId}] Action mode: ${actionMode}`);
    } catch (error) {
      console.warn(`[Chat API] [${sessionId}] Failed to get action mode, using default (confirm):`, error);
      captureError(error);
    }
    const userProfile = await profilePromise;
    const posthogUserId = userProfile?._id || "anonymous";

    // Build system prompt WITH action mode AND current date context
    // "Today" in the person's own time zone (Eastern if unset). The server
    // runs on UTC, which put the evening on tomorrow's date.
    const { currentDate, currentTime } = nowInZone(userProfile?.timezone);
    const systemPrompt = getSystemPrompt({
      actionMode,
      currentDate: `${currentDate} at ${currentTime}`,
      pageContext,
    });

    // Create tools for this request (pass pageContext for context-aware tools)
    const tools = createTools(token, typedConversationId, cacheStats, actionMode, pageContext);

    // Track chat message sent (fire-and-forget, non-blocking)
    try {
      getPostHogClient()?.capture({
        distinctId: posthogUserId,
        event: "chat_message_sent",
        properties: { session_id: sessionId, has_conversation_id: !!conversationId },
      });
    } catch (error) {
      console.warn(`[Chat API] [${sessionId}] PostHog capture failed:`, error instanceof Error ? error.message : error);
    }

    try {
      chatDebug(`[Chat API] [${sessionId}] Streaming with ${PRIMARY_MODEL_NAME} (fallback across the chain)`);

      // Per-request model instance to isolate lastUsedModel/lastAttemptCount
      // from concurrent requests (singleton chatModel would race)
      const requestModel = chatModel.forRequest();

      const result = streamText({
        model: requestModel,
        instructions: systemPrompt,
        messages: convertedMessages,
        tools,
        // Both caps are said out loud when they end a reply: the finish
        // reason rides the message metadata below, and the panel shows why
        // the reply stopped with a Continue button (src/lib/ai/limits.ts).
        stopWhen: stepCountIs(CHAT_MAX_STEPS),
        // Once a step has shown a confirmation card, the rest of the reply is
        // words only: a second call of the same tool had put two cards for one
        // change in front of the person, and both ran.
        prepareStep: ({ steps }) => (steps.some(stepShowedCard) ? { toolChoice: 'none' as const } : undefined),
        maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
        maxRetries: 0, // Disable per-model retries; FallbackModel handles model-to-model fallback
        // Stop and a closed tab end the request, and with it the model calls
        // still running for it (FallbackModel stops on an abort, no fallback).
        abortSignal: req.signal,
        onError({ error }) {
          // AI SDK v6: errors during streaming become part of the stream
          if (req.signal.aborted) return; // Stop or a closed tab, not a failure
          console.error(`[Chat API] [${sessionId}] streamText onError:`, error instanceof Error ? error.message : String(error));
          captureError(error);
        },
        onStepFinish: (event) => {
          chatDebug(`[Chat API] [${sessionId}] Step finished, reason: ${event.finishReason}`);

          if (event.finishReason === 'error') {
            console.error(`[Chat API] [${sessionId}] Step error - model failed to generate response`);
            if ('usage' in event && event.usage) {
              const usage = event.usage as { inputTokens?: number; outputTokens?: number };
              if (usage.inputTokens && usage.inputTokens > 30000) {
                console.error(`[Chat API] [${sessionId}] Likely cause: input too large (${usage.inputTokens} tokens). Use idsOnly for bulk operations.`);
              }
            }
          }

          if ('toolCalls' in event && Array.isArray(event.toolCalls) && event.toolCalls.length > 0) {
            chatDebug(
              `[Chat API] [${sessionId}] Tool calls:`,
              event.toolCalls.map((tc: { toolName: string }) => ({ tool: tc.toolName }))
            );
          }
          if ('toolResults' in event && Array.isArray(event.toolResults) && event.toolResults.length > 0) {
            chatDebug(`[Chat API] [${sessionId}] Tool results: ${event.toolResults.length} result(s)`);
          }
          if ('usage' in event && event.usage) {
            const usage = event.usage as { inputTokens?: number; outputTokens?: number };
            chatDebug(`[Chat API] [${sessionId}] Usage: ${usage.inputTokens || 0} in, ${usage.outputTokens || 0} out`);
          }
        },
        onEnd: (event) => {
          const modelUsed = requestModel.lastUsedModel || 'unknown';
          const attempts = requestModel.lastAttemptCount || 0;
          if (event.finishReason === 'error' || event.finishReason === 'other') {
            console.error(`[Chat API] [${sessionId}] Stream finished with error/other: ${event.finishReason} (model: ${modelUsed}, attempts: ${attempts})`);
          } else {
            chatDebug(`[Chat API] [${sessionId}] Stream completed: ${event.finishReason} (model: ${modelUsed}, attempts: ${attempts})`);
          }
          // Track provider fallback when more than 1 attempt was needed
          if (attempts > 1) {
            try {
              getPostHogClient()?.capture({
                distinctId: posthogUserId,
                event: "chat_provider_fallback",
                properties: { session_id: sessionId, model_used: modelUsed, attempts },
              });
            } catch (error) {
              console.warn(`[Chat API] [${sessionId}] PostHog capture failed:`, error instanceof Error ? error.message : error);
            }
          }
        },
      });

      // Log cache stats for the session
      cacheStats.log(sessionId);

      // Use createUIMessageStream to merge streamText output + append debug metadata.
      // Headers can't carry model info (set before stream starts, model unknown at that point).
      // Instead, we write a metadata chunk AFTER the stream completes — client reads it from useChat data.
      const uiStream = createUIMessageStream({
        execute: async ({ writer }) => {
          // Merge the streamText result into this stream
          writer.merge(result.toUIMessageStream({
            // When the reply began, so the client can timestamp it from its
            // first word instead of waiting for the saved copy.
            messageMetadata: ({ part }) => {
              if (part.type === 'start') return { createdAt: Date.now() };
              // Why the reply ended, when a cap ended it: the output cap
              // ("length") or the step cap (the last step still wanted a tool).
              if (part.type === 'finish') {
                const cutShort = cutShortFrom(part.finishReason);
                return cutShort ? { cutShort } : undefined;
              }
              return undefined;
            },
            // AI SDK v6: the string returned here is emitted as a structured
            // ERROR PART on the stream (not assistant text), so the client can
            // render it as an error banner. The client MUST NOT persist a turn
            // that finished with isError — see useChatWithPersistence onFinish.
            onError: (error) => {
              const msg = error instanceof Error ? error.message : String(error);
              // The person stopped the reply or left: not a provider failure.
              if (req.signal.aborted) return 'Stopped.';
              console.error(`[Chat API] [${sessionId}] UIMessageStream onError:`, msg.slice(0, 300));
              // Distinct mid-stream telemetry: this fires AFTER doStream resolved,
              // i.e. outside FallbackModel's connection-time retry loop — the
              // unrecoverable mid-stream gap, tracked separately from allFailed.
              reportMidStreamFailure(error, {
                modelUsed: requestModel.lastUsedModel,
                attempts: requestModel.lastAttemptCount,
                sessionId,
              });
              return 'AI service temporarily unavailable. Please try again in a moment.';
            },
          }));
        },
        onEnd: () => {
          // Schedule summarization AFTER the response is sent. `after()` keeps the
          // serverless invocation alive until the work settles (bounded by
          // maxDuration) — a bare fire-and-forget promise can be frozen/killed
          // once the response flushes, so summaries would intermittently never run.
          // Note: onEnd also fires on abort/error; an extra summarization
          // check after a failed turn is harmless (it self-gates on need).
          if (typedConversationId) {
            const convId = typedConversationId;
            after(() => triggerSummarizationCheck(convId, token, sessionId));
          }
        },
      });

      return createUIMessageStreamResponse({ stream: uiStream });
    } catch (error) {
      // All models failed (FallbackModel exhausted all options)
      // This fires when model.doStream() throws before streaming starts.
      // An abort (Stop, a closed tab) lands here too and isn't a failure.
      if (req.signal.aborted) {
        return new Response(null, { status: 499 });
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errAny = error as any;
      console.error(`[Chat API] [${sessionId}] All models failed:`, {
        message: errMsg?.slice(0, 500),
        status: errAny?.statusCode || errAny?.status,
        cause: errAny?.cause?.message,
        name: errAny?.name,
      });
      captureError(error);
      return new Response(
        JSON.stringify({
          error: `All AI providers are currently unavailable. Please try again in a moment.`,
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error(`[Chat API] [${sessionId}] Error:`, error);
    captureError(error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
