/**
 * AI Provider Configuration
 *
 * Multi-provider setup for chat functionality with automatic fallback.
 * Uses ai-fallback for mid-stream error recovery and automatic provider switching.
 *
 * Provider Chain (ordered by free-tier reliability - Feb 2026):
 *
 * Tier 1 (High quota free tiers):
 *   - Groq Llama 3.3 70B Versatile (30 RPM, 14400 RPD free) - PRIMARY
 *   - Mistral Small (generous free tier, reliable)
 *
 * Tier 2 (Limited quota):
 *   - Gemini 2.5 Flash (20 RPD free tier)
 *   - Gemini 3 Flash Preview (20 RPD free tier)
 *
 * Tier 3 (Unreliable free / Emergency):
 *   - Llama 3.3 70B (OpenRouter free, often rate-limited)
 *   - Llama 3.1 8B (Cerebras, emergency ultra-fast)
 *
 * Total: 6 models across 5 providers with automatic mid-stream recovery.
 * Tested: Feb 2026 - All models verified working with streaming + tool calling.
 *
 * REMOVED (Feb 2026):
 *   - devstral-2512:free — OpenRouter free period ended (returns 404)
 *   - cerebras llama-3.3-70b — deprecated on Cerebras Feb 16 2026
 */

import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { createFallback } from 'ai-fallback';
import { wrapLanguageModel } from 'ai';

// =============================================================================
// Mistral Tool Call ID Fix
// =============================================================================

/**
 * Mistral requires tool call IDs to be exactly 9 alphanumeric characters.
 * The Vercel AI SDK generates longer IDs, so we need to transform them.
 *
 * This function creates a consistent 9-char ID from any input ID using
 * a hash-like approach to maintain uniqueness.
 */
function toMistralToolCallId(id: string): string {
  // Simple hash: take alphanumeric chars, pad/truncate to 9 chars
  const alphanumeric = id.replace(/[^a-zA-Z0-9]/g, '');

  if (alphanumeric.length >= 9) {
    return alphanumeric.slice(-9); // Take last 9 chars
  }

  // Pad with deterministic chars derived from the id
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let padded = alphanumeric;
  let i = 0;
  while (padded.length < 9) {
    padded += chars[(id.charCodeAt(i % id.length) + i) % chars.length];
    i++;
  }
  return padded.slice(0, 9);
}

/**
 * Wrap a Mistral-based model with middleware that fixes tool call IDs.
 * This ensures all tool call IDs are exactly 9 alphanumeric characters.
 *
 * Uses ReturnType inference to match the model's type.
 */
function wrapMistralModel<T extends Parameters<typeof wrapLanguageModel>[0]['model']>(model: T): T {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v3' as const,
      // Transform tool results before sending to model
      transformParams: async ({ params }) => {
        // Transform tool call IDs in messages
        const transformedMessages = params.prompt.map((msg) => {
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            return {
              ...msg,
              content: msg.content.map((part) => {
                if (part.type === 'tool-call') {
                  return {
                    ...part,
                    toolCallId: toMistralToolCallId(part.toolCallId),
                  };
                }
                return part;
              }),
            };
          }
          if (msg.role === 'tool' && Array.isArray(msg.content)) {
            return {
              ...msg,
              content: msg.content.map((part) => {
                if (part.type === 'tool-result') {
                  return {
                    ...part,
                    toolCallId: toMistralToolCallId(part.toolCallId),
                  };
                }
                return part;
              }),
            };
          }
          return msg;
        });

        return { ...params, prompt: transformedMessages };
      },
    },
  }) as T;
}

/**
 * Custom error class that is always retryable.
 * This forces ai-fallback to continue to the next model instead of stopping.
 *
 * ai-fallback checks error.statusCode and error.message patterns to determine
 * if an error is retryable. We preserve the statusCode from the original error
 * and ensure the message contains retryable patterns.
 */
class RetryableError extends Error {
  isRetryable = true;
  statusCode?: number;

  constructor(message: string, public originalError?: Error) {
    // Ensure message contains patterns ai-fallback recognizes as retryable
    const retryableMessage = message.includes('rate') || message.includes('429') || message.includes('quota')
      ? message
      : `rate_limit: ${message}`; // Prefix to ensure ai-fallback recognizes it
    super(retryableMessage);
    this.name = 'RetryableError';

    // Extract statusCode from original error if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origError = originalError as any;
    if (origError?.statusCode) {
      this.statusCode = origError.statusCode;
    } else if (origError?.status) {
      this.statusCode = origError.status;
    } else {
      // Default to 429 (rate limit) to ensure ai-fallback treats it as retryable
      this.statusCode = 429;
    }
  }
}

/**
 * Wrap any model to make ALL errors retryable.
 * This ensures ai-fallback continues to the next model on ANY failure,
 * not just rate limits or 5xx errors.
 *
 * Also detects Gemini's silent failures (finishReason: 'error' with 0 output).
 * Logs which model successfully handled the request.
 */
function wrapWithRetryableErrors<T extends Parameters<typeof wrapLanguageModel>[0]['model']>(model: T): T {
  // Get model ID for logging
  const modelId = 'modelId' in model ? (model as { modelId: string }).modelId : 'unknown';

  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v3' as const,
      // Wrap generate to catch errors and make them retryable
      wrapGenerate: async ({ doGenerate }) => {
        try {
          const result = await doGenerate();

          // Detect silent failure: error finish reason with no output
          // In AI SDK v6, finishReason is { unified, raw } instead of a plain string
          const reason = result.finishReason.unified;
          if (reason === 'error' || reason === 'other') {
            const hasOutput = result.content && result.content.length > 0 && result.content.some(
              (part) => (part.type === 'text' && part.text) || part.type === 'tool-call'
            );
            if (!hasOutput) {
              console.error(`[Middleware] Silent failure detected (generate) for ${modelId} - throwing retryable error`);
              throw new RetryableError(`Model silent failure: finishReason=${reason} with no output`);
            }
          }

          // Log success
          console.log(`[Middleware] Model ${modelId} completed successfully (generate)`);
          return result;
        } catch (error) {
          // Make ALL errors retryable so fallback continues
          if (error instanceof RetryableError) {
            throw error; // Already retryable
          }
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[Middleware] Error from ${modelId}, converting to retryable:`, message);
          throw new RetryableError(message, error instanceof Error ? error : undefined);
        }
      },

      // Wrap stream to catch errors and make them retryable
      wrapStream: async ({ doStream }) => {
        try {
          const { stream, ...rest } = await doStream();

          let hasContent = false;
          let finishReason: string | null = null;
          let logged = false;

          // Transform stream to detect silent failures
          const transformStream = new TransformStream({
            transform(chunk, controller) {
              // Track if we've seen any actual content
              if (chunk.type === 'text-delta' && chunk.textDelta) {
                hasContent = true;
                // Log success on first content (only once)
                if (!logged) {
                  console.log(`[Middleware] Model ${modelId} streaming response`);
                  logged = true;
                }
              }
              if (chunk.type === 'tool-call') {
                hasContent = true;
                if (!logged) {
                  console.log(`[Middleware] Model ${modelId} calling tool`);
                  logged = true;
                }
              }
              if (chunk.type === 'tool-call-delta') {
                hasContent = true;
              }

              // Track finish reason (v6: finishReason is { unified, raw })
              if (chunk.type === 'finish') {
                finishReason = chunk.finishReason.unified;
              }

              controller.enqueue(chunk);
            },
            flush(controller) {
              // After stream ends, check if it was a silent failure
              if ((finishReason === 'error' || finishReason === 'other') && !hasContent) {
                console.error(`[Middleware] Silent failure detected (stream) for ${modelId} - throwing retryable error`);
                controller.error(new RetryableError(`Model silent failure: finishReason=${finishReason} with no output`));
              }
            },
          });

          return {
            stream: stream.pipeThrough(transformStream),
            ...rest,
          };
        } catch (error) {
          // Make ALL errors retryable so fallback continues
          if (error instanceof RetryableError) {
            throw error; // Already retryable
          }
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[Middleware] Stream error from ${modelId}, converting to retryable:`, message);
          throw new RetryableError(message, error instanceof Error ? error : undefined);
        }
      },
    },
  }) as T;
}


// =============================================================================
// Provider Clients
// =============================================================================

// OpenRouter client (300+ models, many free)
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

// Groq client (OpenAI-compatible API, fast inference)
const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY!,
});

// Cerebras client (OpenAI-compatible API, ultra-fast inference)
const cerebras = createOpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY!,
});

// Mistral client (OpenAI-compatible API)
const mistral = createOpenAI({
  baseURL: 'https://api.mistral.ai/v1',
  apiKey: process.env.MISTRAL_API_KEY!,
});

// =============================================================================
// Model Configuration
// =============================================================================

/**
 * All models in fallback order (primary + fallbacks)
 * Ordered by free-tier quota generosity and reliability, NOT raw capability.
 *
 * IMPORTANT: ALL models are wrapped with wrapWithRetryableErrors() to ensure
 * the fallback chain continues on ANY error (not just rate limits/5xx).
 *
 * Note:
 * - Groq has the most generous free tier (30 RPM, 14400 RPD) — PRIMARY
 * - Gemini free tier is very limited (20 RPD per model) — used as backup
 * - OpenRouter free models are unreliable (rate limited, free periods end)
 * - Mistral-based models also get wrapMistralModel() for tool ID fix
 */
const allModels = [
  // Tier 1: High-quota free tiers (handle most traffic)
  wrapWithRetryableErrors(groq('llama-3.3-70b-versatile')),                               // 30 RPM, 14400 RPD free
  wrapWithRetryableErrors(wrapMistralModel(mistral('mistral-small-latest'))),             // Generous free tier

  // Tier 2: Limited quota (20 RPD each on Google free tier)
  wrapWithRetryableErrors(google('gemini-2.5-flash')),                      // Best quality, limited quota
  wrapWithRetryableErrors(google('gemini-3-flash-preview')),                // Preview, separate quota pool

  // Tier 3: Unreliable free / Emergency
  wrapWithRetryableErrors(openrouter('meta-llama/llama-3.3-70b-instruct:free')),          // Often rate-limited
  wrapWithRetryableErrors(cerebras('llama3.1-8b')),                         // Emergency fallback
];

/**
 * Model names for logging (matches allModels order)
 */
const MODEL_NAMES = [
  'Llama 3.3 70B Versatile (Groq)',
  'Mistral Small',
  'Gemini 2.5 Flash',
  'Gemini 3 Flash Preview',
  'Llama 3.3 70B (OpenRouter)',
  'Llama 3.1 8B (Cerebras)',
] as const;

/**
 * Chat model with automatic fallback on quota/rate limit/server errors.
 * Uses ai-fallback for mid-stream error recovery.
 *
 * Configuration:
 * - retryAfterOutput: true - Recover from mid-stream errors (restarts generation)
 * - modelResetInterval: 5 minutes - Re-test failed models periodically
 * - All 6 models tried in order before giving up
 */
/**
 * Custom retry checker that ensures ALL errors are considered retryable.
 * This overrides ai-fallback's default logic which only checks specific
 * status codes and message patterns.
 */
function shouldRetryThisError(error: Error): boolean {
  // Always retry RetryableError instances
  if (error instanceof RetryableError || (error as { isRetryable?: boolean }).isRetryable) {
    return true;
  }

  // Check for common retryable status codes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusCode = (error as any)?.statusCode ?? (error as any)?.status;
  if (statusCode) {
    const retryableCodes = [401, 403, 408, 409, 413, 429, 498, 500, 502, 503, 504];
    if (retryableCodes.includes(statusCode) || statusCode >= 500) {
      return true;
    }
  }

  // Check for common retryable patterns in error message
  const message = (error.message || '').toLowerCase();
  const retryablePatterns = [
    'overloaded', 'service unavailable', 'bad gateway',
    'too many requests', 'internal server error', 'gateway timeout',
    'rate_limit', 'ratelimit', 'rate limit', 'wrong-key',
    'unexpected', 'capacity', 'timeout', 'server_error',
    'quota', 'exceeded', 'resource_exhausted',
    '429', '500', '502', '503', '504'
  ];
  if (retryablePatterns.some(pattern => message.includes(pattern))) {
    return true;
  }

  // For safety: retry most errors since we have fallback models
  // Only skip if it's clearly a client error (bad request, not found, etc.)
  console.log(`[Providers] Allowing retry for error: ${error.message?.slice(0, 100)}`);
  return true;
}

export const chatModel = createFallback({
  models: allModels,
  retryAfterOutput: true,
  modelResetInterval: 5 * 60 * 1000, // 5 minutes
  shouldRetryThisError,
  onError: (error, modelId) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errAny = error as any;
    console.warn(`[Providers] Model ${modelId} failed (status=${errAny?.statusCode || errAny?.status || 'none'}), falling back:`, error.message?.slice(0, 300));
  },
});

/**
 * Primary model name for logging
 */
export const PRIMARY_MODEL_NAME = MODEL_NAMES[0];

/**
 * List of supported models for debugging/UI
 */
export const SUPPORTED_MODELS = [
  // Tier 1: High-quota free tiers (primary)
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'Groq', tier: 1, toolCalling: '77.3%' },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'Mistral', tier: 1, toolCalling: '~70%' },

  // Tier 2: Limited quota (Google free tier = 20 RPD)
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 2, toolCalling: '~90%' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', provider: 'Google', tier: 2, toolCalling: '~95%' },

  // Tier 3: Unreliable free / Emergency
  { id: 'llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'OpenRouter', tier: 3, toolCalling: '77.3%' },
  { id: 'llama3.1-8b', name: 'Llama 3.1 8B', provider: 'Cerebras', tier: 3, toolCalling: '~50%' },
] as const;
