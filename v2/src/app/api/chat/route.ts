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
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
import {
  summarizeConversation,
  checkNeedsSummarization,
} from '@/lib/ai/summarize';
import { chatModel, PRIMARY_MODEL_NAME, reportMidStreamFailure } from '@/lib/ai/providers';
import { compactToFit, compactAt, parseFacts } from '@/lib/ai/compaction';
import { getClientIp } from '@/lib/net/getClientIp';
import { getSystemPrompt } from '@/lib/ai/system-prompt';
import type { ActionMode } from '@/lib/ai/tool-permissions';
import { createCacheStats } from '@/lib/ai/cache';
import { captureError } from '@/lib/sentry';
import { getPostHogClient } from '@/lib/posthog-server';
import { checkBotId } from 'botid/server';
import { createTools, truncateForLog } from './create-tools';

// Allow up to 60 seconds for streaming responses (extra time for fallbacks + tool calls)
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
      console.log(`[Chat API] [${sessionId}] Triggering async summarization`);
      await summarizeConversation(conversationId, token);
    }
  } catch (error) {
    console.error(`[Chat API] [${sessionId}] Summarization check failed:`, error);
    captureError(error);
  }
}

export async function POST(req: Request) {
  const sessionId = generateSessionId();
  console.log(`[Chat API] [${sessionId}] === New chat request ===`);

  try {
    // BotID check — reject non-browser callers before any Convex hit or LLM
    // call. Client-side botid instrumentation (see src/instrumentation-client.ts)
    // attaches a signed token to /api/chat requests; direct-API attackers have
    // no token and fail here. Costs nothing on Basic tier.
    const botVerdict = await checkBotId();
    if (botVerdict.isBot) {
      console.log(`[Chat API] [${sessionId}] Bot blocked`);
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Per-IP rate limit — caps one source from burning through AI quotas
    // regardless of which authenticated user is calling. Runs AFTER BotID
    // so we don't burn rate-limit budget on verified bots.
    // getClientIp() reads the Vercel-attested IP (not the spoofable leftmost
    // x-forwarded-for hop). "unknown" only when no IP is resolvable (local dev).
    const clientIp = getClientIp(req) || "unknown";
    try {
      const ipCheck = await fetchMutation(api.authRateLimit.checkIpRateLimit, {
        ip: clientIp,
        action: "ip_chat",
      });
      if (!ipCheck.allowed) {
        console.log(`[Chat API] [${sessionId}] IP rate limit hit`);
        return new Response(
          JSON.stringify({
            error: ipCheck.message || "Too many requests. Please slow down.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
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
      console.log(`[Chat API] [${sessionId}] Auth failed: not authenticated`);
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

    // Parse request body
    const {
      messages,
      conversationId,
      pageContext,
    }: {
      messages: UIMessage[];
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
    const lastMessage = messages[messages.length - 1];
    const messageContent = lastMessage?.parts
      ? lastMessage.parts.filter((p): p is { type: 'text'; text: string } => (p as { type: string }).type === 'text').map(p => p.text).join(' ')
      : JSON.stringify(lastMessage);
    console.log(`[Chat API] [${sessionId}] User message:`, truncateForLog(messageContent));
    if (conversationId) {
      console.log(`[Chat API] [${sessionId}] Conversation ID: ${conversationId}`);
    }
    if (pageContext) {
      console.log(`[Chat API] [${sessionId}] Page context:`, truncateForLog(pageContext));
    }

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: messages required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get optimized context if conversationId is provided
    // This uses summary + recent messages instead of full history
    let convertedMessages: Awaited<ReturnType<typeof convertToModelMessages>>;
    let typedConversationId: Id<"conversations"> | null = null;

    if (conversationId) {
      typedConversationId = conversationId as Id<"conversations">;
      try {
        const contextData = await fetchQuery(
          api.conversationSummary.getContextMessages,
          { conversationId: typedConversationId },
          { token }
        );

        if (contextData.summary || contextData.facts) {
          console.log(`[Chat API] [${sessionId}] Compacting context (${contextData.totalMessageCount} total messages)`);

          // Convert raw message history to ModelMessage[] (full fidelity — no hard truncation).
          // Let the compaction module walk L0→L4 to fit the target budget.
          const fullMessages = await convertToModelMessages(messages);

          // Target budget: ~10k tokens — fits Groq (the tightest model in the chain that
          // doesn't get skipped). Gemini (1M) and Mistral/GLM (~100k) handle this easily
          // with plenty of headroom. This targets the smallest non-skipped model so no
          // model in the chain gets skipped for size.
          const TARGET_TOKENS = 10_000;

          const compactionInput = {
            messages: fullMessages,
            summary: {
              content: contextData.summary ?? "",
              facts: parseFacts(contextData.facts ?? undefined),
            },
          };

          const compaction = compactToFit(compactionInput, TARGET_TOKENS);

          if (compaction) {
            console.log(`[Chat API] [${sessionId}] Compaction L${compaction.level}: ${compaction.estimatedTokens} tokens`);
            convertedMessages = compaction.messages;
          } else {
            // Emergency: even L4 didn't fit — a single turn exceeds the target
            // budget even after maximal compaction. Use the L4 result (which
            // PRESERVES the summary/facts envelope, unlike a raw tail slice) and
            // let FallbackModel skip models that can't handle the size.
            // captureError because this is a real product signal, not just noise.
            console.warn(`[Chat API] [${sessionId}] No compaction level fits ${TARGET_TOKENS} tokens; using L4 (envelope preserved)`);
            captureError(
              new Error(`Compaction L4 still exceeds ${TARGET_TOKENS} tokens`),
              { operation: 'chat.compaction.noFit', extra: { sessionId, totalMessageCount: contextData.totalMessageCount } },
            );
            convertedMessages = compactAt(4, compactionInput);
          }
        } else {
          console.log(`[Chat API] [${sessionId}] No summary available, using full history`);
          convertedMessages = await convertToModelMessages(messages);
        }
      } catch (error) {
        console.warn(`[Chat API] [${sessionId}] Failed to get context, using full history:`, error);
        captureError(error);
        convertedMessages = await convertToModelMessages(messages);
      }
    } else {
      convertedMessages = await convertToModelMessages(messages);
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
      console.log(`[Chat API] [${sessionId}] Action mode: ${actionMode}`);
    } catch (error) {
      console.warn(`[Chat API] [${sessionId}] Failed to get action mode, using default (confirm):`, error);
      captureError(error);
    }
    const userProfile = await profilePromise;
    const posthogUserId = userProfile?._id || "anonymous";

    // Build system prompt WITH action mode AND current date context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const currentTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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
      console.log(`[Chat API] [${sessionId}] Streaming with ${PRIMARY_MODEL_NAME} (fallback across 5 models)`);

      // Per-request model instance to isolate lastUsedModel/lastAttemptCount
      // from concurrent requests (singleton chatModel would race)
      const requestModel = chatModel.forRequest();

      const result = streamText({
        model: requestModel,
        system: systemPrompt,
        messages: convertedMessages,
        tools,
        stopWhen: stepCountIs(10),
        maxOutputTokens: 4000,
        maxRetries: 0, // Disable per-model retries; FallbackModel handles model-to-model fallback
        onError({ error }) {
          // AI SDK v6: errors during streaming become part of the stream
          console.error(`[Chat API] [${sessionId}] streamText onError:`, error instanceof Error ? error.message : String(error));
          captureError(error);
        },
        onStepFinish: (event) => {
          console.log(`[Chat API] [${sessionId}] Step finished, reason: ${event.finishReason}`);

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
            console.log(
              `[Chat API] [${sessionId}] Tool calls:`,
              event.toolCalls.map((tc: { toolName: string }) => ({ tool: tc.toolName }))
            );
          }
          if ('toolResults' in event && Array.isArray(event.toolResults) && event.toolResults.length > 0) {
            console.log(`[Chat API] [${sessionId}] Tool results: ${event.toolResults.length} result(s)`);
          }
          if ('usage' in event && event.usage) {
            const usage = event.usage as { inputTokens?: number; outputTokens?: number };
            console.log(`[Chat API] [${sessionId}] Usage: ${usage.inputTokens || 0} in, ${usage.outputTokens || 0} out`);
          }
        },
        onFinish: (event) => {
          const modelUsed = requestModel.lastUsedModel || 'unknown';
          const attempts = requestModel.lastAttemptCount || 0;
          if (event.finishReason === 'error' || event.finishReason === 'other') {
            console.error(`[Chat API] [${sessionId}] Stream finished with error/other: ${event.finishReason} (model: ${modelUsed}, attempts: ${attempts})`);
          } else {
            console.log(`[Chat API] [${sessionId}] Stream completed: ${event.finishReason} (model: ${modelUsed}, attempts: ${attempts})`);
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
            // AI SDK v6: the string returned here is emitted as a structured
            // ERROR PART on the stream (not assistant text), so the client can
            // render it as an error banner. The client MUST NOT persist a turn
            // that finished with isError — see useChatWithPersistence onFinish.
            onError: (error) => {
              const msg = error instanceof Error ? error.message : String(error);
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
        onFinish: () => {
          // Schedule summarization AFTER the response is sent. `after()` keeps the
          // serverless invocation alive until the work settles (bounded by
          // maxDuration) — a bare fire-and-forget promise can be frozen/killed
          // once the response flushes, so summaries would intermittently never run.
          // Note: onFinish also fires on abort/error in v6; an extra summarization
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
      // This fires when model.doStream() throws before streaming starts
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
