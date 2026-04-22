/**
 * AI Provider Configuration
 *
 * 5-model free fallback chain with automatic failover. Tries each in order;
 * if one fails (503, rate limit, quota, auth, 404, any error), moves to the next.
 *
 * Chain (April 2026):
 *
 *   Tier 1 — Google Gemini (primary, 1M context):
 *     1. Gemini 2.5 Flash (20 RPD free tier per model)
 *     2. Gemini 2.0 Flash (independent free-tier quota bucket)
 *
 *   Tier 2 — High-quota mid-size fallbacks (100k+ context):
 *     3. Groq Llama 3.3 70B Versatile (30 RPM, 10k TPM free tier)
 *     4. Mistral Small (generous free tier, wrapped with tool-call-ID sanitizer)
 *
 *   Tier 3 — Free large-context emergency fallback:
 *     5. GLM 4.5 Air via OpenRouter (131k context, verified reliable multi-turn tool calling)
 *
 * Cerebras llama3.1-8b is intentionally NOT in this chain — its 6k context budget
 * cannot fit our tool definitions + system prompt. It IS exported for use by
 * `summarize.ts` for fast background entity extraction.
 *
 * All providers use NATIVE AI SDK packages (@ai-sdk/google, @ai-sdk/groq,
 * @ai-sdk/mistral, @ai-sdk/cerebras, @openrouter/ai-sdk-provider).
 * Native providers handle each API's streaming format correctly, including
 * tool call parsing. Using createOpenAI() as a generic wrapper causes
 * "Expected 'function' type." errors on streaming tool calls (vercel/ai#5350).
 *
 * WHY THE MISTRAL ID SANITIZER IS NEEDED (re-added April 2026):
 *   Mistral's API rejects tool_call_id values longer than 9 alphanumeric chars
 *   with HTTP 400 ("Tool call id was X but must be a-z, A-Z, 0-9, length 9").
 *   The native @ai-sdk/mistral only sanitizes IDs it GENERATES. When earlier
 *   turns produced longer IDs (Gemini, Groq, etc.) and we fall to Mistral,
 *   those historical IDs are passed through unchanged and rejected. The
 *   `wrapMistralModel` middleware rewrites incoming IDs on both assistant
 *   tool-call parts AND tool-result parts before the request goes out.
 *   Production evidence: Sentry issue 7411490896 (release 49ece79).
 *
 * REMOVED:
 *   - meta-llama/llama-3.3-70b-instruct:free — chronically 429'd on OpenRouter free
 *   - Cerebras llama3.1-8b from chat chain — 6k budget < tool+system overhead
 *   - gemini-3-flash-preview — requires thought_signature for tool calls (broken)
 *   - createOpenAI() for Groq/Mistral/Cerebras — see "Expected 'function' type." above
 */

import { google } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createCerebras } from '@ai-sdk/cerebras';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { wrapLanguageModel } from 'ai';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { captureError, addBreadcrumb } from '@/lib/sentry';
import { estimateTokensOf } from './compaction';

// =============================================================================
// Provider Clients (all native SDKs — no createOpenAI() wrappers)
// =============================================================================

function getApiKey(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[AI Providers] Missing env var: ${name} — this provider will fail at runtime`);
  }
  return value || '';
}

export const groq = createGroq({
  apiKey: getApiKey('GROQ_API_KEY'),
});

export const mistral = createMistral({
  apiKey: getApiKey('MISTRAL_API_KEY'),
});

/** Cerebras client — used by summarize.ts for fast entity extraction. NOT in chat chain. */
export const cerebras = createCerebras({
  apiKey: getApiKey('CEREBRAS_API_KEY'),
});

const openrouter = createOpenRouter({
  apiKey: getApiKey('OPENROUTER_API_KEY'),
});

// =============================================================================
// Mistral Tool Call ID Sanitizer Middleware
// =============================================================================

/**
 * Mistral requires tool_call_id to be exactly 9 alphanumeric characters.
 * Transforms any ID to exactly that shape deterministically so repeated calls
 * with the same input yield the same output — critical for matching tool-call
 * parts with their tool-result parts in the same conversation.
 */
function toMistralToolCallId(id: string): string {
  const alphanumeric = id.replace(/[^a-zA-Z0-9]/g, '');

  if (alphanumeric.length >= 9) {
    return alphanumeric.slice(-9);
  }

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
 * Wrap a Mistral-based model with middleware that rewrites every tool_call_id
 * in the outgoing prompt. Handles BOTH:
 *   - assistant messages with tool-call parts (the call being made)
 *   - tool messages with tool-result parts (references to prior calls)
 *
 * Without this, historical IDs from other providers in the same conversation
 * (16-char Gemini IDs, etc.) cause Mistral to 400.
 */
function wrapMistralModel<T extends LanguageModelV3>(model: T): T {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v3' as const,
      transformParams: async ({ params }) => {
        const transformedPrompt = params.prompt.map((msg) => {
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            return {
              ...msg,
              content: msg.content.map((part) => {
                if (part.type === 'tool-call') {
                  return { ...part, toolCallId: toMistralToolCallId(part.toolCallId) };
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
                  return { ...part, toolCallId: toMistralToolCallId(part.toolCallId) };
                }
                return part;
              }),
            };
          }
          return msg;
        });

        return { ...params, prompt: transformedPrompt };
      },
    },
  }) as T;
}

// Export for unit testing
export { toMistralToolCallId, wrapMistralModel };

// =============================================================================
// Model Configuration
// =============================================================================

interface ModelConfig {
  model: LanguageModelV3;
  name: string;
  /** Max estimated input tokens. Skip this model if input exceeds this. */
  maxInputTokens?: number;
}

/**
 * Estimate total input token count from call options.
 * Delegates to the shared estimator in compaction.ts; over-counts vs actual
 * model tokens by ~30-50% due to JSON overhead — biased toward skipping
 * marginal models rather than sending oversized payloads.
 */
function estimateInputTokens(options: LanguageModelV3CallOptions): number {
  return estimateTokensOf(options);
}

/**
 * Fallback chain (5 models). Each request tries from index 0.
 * No shared state between requests — every request gets a fresh attempt.
 *
 * maxInputTokens reflects the realistic usable budget including tools:
 *   - Groq free tier: 12k TPM total → cap at 10k
 *   - Others: 100k+ context, no cap needed for typical requests
 */
const MODEL_CONFIGS: ModelConfig[] = [
  // Tier 1: Google Gemini — 1M context, best quality, 20 RPD per model free tier
  { model: google('gemini-2.5-flash'), name: 'Gemini 2.5 Flash' },
  { model: google('gemini-2.0-flash'), name: 'Gemini 2.0 Flash' },

  // Tier 2: High-quota mid-size fallbacks
  { model: groq('llama-3.3-70b-versatile'), name: 'Llama 3.3 70B (Groq)', maxInputTokens: 10000 },
  { model: wrapMistralModel(mistral('mistral-small-latest')), name: 'Mistral Small' },

  // Tier 3: Free large-context emergency
  { model: openrouter('z-ai/glm-4.5-air:free'), name: 'GLM 4.5 Air (OpenRouter)' },
];

// =============================================================================
// Simple Fallback Model
// =============================================================================

/**
 * Format error for logging: extract message, status code, and type.
 */
type ErrorLike = Error & { statusCode?: number | string; status?: number | string };

function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const e = error as ErrorLike;
  const status = e.statusCode ?? e.status ?? '';
  const name = e.name || 'Error';
  const msg = (e.message ?? 'unknown').slice(0, 300);
  return status ? `[${name} ${status}] ${msg}` : `[${name}] ${msg}`;
}

/**
 * Simple sequential fallback model. Tries each model in order for every request.
 *
 * - No shared state between requests (use forRequest() for per-request isolation)
 * - No complex stream wrapping or mid-stream recovery
 * - Clear, sequential logging of every model attempt
 * - ALL errors are retried (no shouldRetryThisError issues)
 * - Models with declared maxInputTokens are skipped if payload exceeds budget
 *
 * Trade-off: no mid-stream recovery. Errors during stream consumption (after
 * doStream resolves) are outside the fallback loop. Acceptable because most
 * errors (rate limit, quota, auth, 404) happen at connection time.
 */
export class FallbackModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;

  /** Last model that succeeded (per-instance — use forRequest() for isolation). */
  private _lastUsedModel = '';
  /** Number of models tried in the last request (1 = primary succeeded). */
  private _lastAttemptCount = 0;

  get lastUsedModel(): string {
    return this._lastUsedModel;
  }

  get lastAttemptCount(): number {
    return this._lastAttemptCount;
  }

  get modelId(): string {
    // Constructor guarantees configs.length > 0, so [0] is always defined.
    return this.configs[0]!.name;
  }

  get provider(): string {
    return 'fallback';
  }

  get supportedUrls(): Record<string, RegExp[]> {
    return {};
  }

  constructor(private configs: ModelConfig[]) {
    if (configs.length === 0) {
      throw new Error('[FallbackModel] No models configured');
    }
  }

  /**
   * Create a per-request instance with independent state.
   * Shares the same model configs (zero overhead) but isolates
   * lastUsedModel/lastAttemptCount from concurrent requests.
   */
  forRequest(): FallbackModel {
    return new FallbackModel(this.configs);
  }

  private async tryModels<T>(
    mode: 'generate' | 'stream',
    invoke: (model: LanguageModelV3) => PromiseLike<T>,
    options?: LanguageModelV3CallOptions,
  ): Promise<T> {
    const errors: Array<{ name: string; error: string }> = [];
    const estimatedTokens = options ? estimateInputTokens(options) : undefined;

    for (let i = 0; i < this.configs.length; i++) {
      const config = this.configs[i]!;

      if (config.maxInputTokens && estimatedTokens && estimatedTokens > config.maxInputTokens) {
        const msg = `Input too large (~${estimatedTokens} tokens, limit ${config.maxInputTokens})`;
        errors.push({ name: config.name, error: msg });
        console.warn(`[Fallback] ${config.name} SKIPPED (${i + 1}/${this.configs.length}): ${msg}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} SKIPPED`, level: 'warning', data: { modelIndex: i, estimatedTokens, limit: config.maxInputTokens } });
        continue;
      }

      try {
        console.log(`[Fallback] Trying ${config.name} (${i + 1}/${this.configs.length}) for ${mode}...`);
        addBreadcrumb({ category: 'ai.fallback', message: `Trying ${config.name} for ${mode}`, data: { modelIndex: i, totalModels: this.configs.length } });
        const result = await invoke(config.model);
        const successMsg = mode === 'stream'
          ? `${config.name} stream started successfully`
          : `${config.name} succeeded (${mode})`;
        console.log(`[Fallback] ${successMsg}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} succeeded (${mode})`, data: { modelIndex: i } });
        this._lastUsedModel = config.name;
        this._lastAttemptCount = i + 1;
        return result;
      } catch (error) {
        const errorStr = formatError(error);
        errors.push({ name: config.name, error: errorStr });
        console.warn(`[Fallback] ${config.name} FAILED (${mode}): ${errorStr}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} FAILED (${mode})`, level: 'warning', data: { modelIndex: i, error: errorStr } });
      }
    }

    const summary = errors.map((e, i) => `  ${i + 1}. ${e.name}: ${e.error}`).join('\n');
    console.error(`[Fallback] ALL ${this.configs.length} models failed (${mode}):\n${summary}`);
    captureError(
      new Error(`All ${this.configs.length} AI models failed (${mode}).\n${summary}`),
      { operation: 'ai.fallback.allFailed', extra: { mode, modelCount: this.configs.length, errors: JSON.stringify(errors) } }
    );
    const lastErr = errors[errors.length - 1];
    throw new Error(
      `All ${this.configs.length} AI models failed. Last: ${lastErr ? lastErr.error : 'unknown'}`
    );
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    return this.tryModels('generate', (model) => model.doGenerate(options), options);
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    return this.tryModels('stream', (model) => model.doStream(options), options);
  }
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Chat model with automatic fallback across 5 models / 5 providers.
 * Every request starts from model #1 (Gemini 2.5 Flash).
 */
export const chatModel = new FallbackModel(MODEL_CONFIGS);

export const PRIMARY_MODEL_NAME = MODEL_CONFIGS[0]!.name;

export const SUPPORTED_MODELS = [
  // Tier 1: Google Gemini
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 1, toolCalling: '~90%' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Google', tier: 1, toolCalling: '~85%' },

  // Tier 2: High-quota fallbacks
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'Groq', tier: 2, toolCalling: '77.3%' },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'Mistral', tier: 2, toolCalling: '~70%' },

  // Tier 3: Free large-context emergency
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', provider: 'OpenRouter', tier: 3, toolCalling: '~80%' },
] as const;
