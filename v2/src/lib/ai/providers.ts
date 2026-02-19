/**
 * AI Provider Configuration
 *
 * Multi-provider setup with automatic fallback. Tries each model in order;
 * if one fails (rate limit, quota, auth, 404, any error), moves to the next.
 *
 * Provider Chain (Feb 2026):
 *
 * Tier 1 (Primary - Google Gemini):
 *   - Gemini 2.5 Flash (20 RPD free tier) - PRIMARY
 *
 * Tier 2 (High-quota fallbacks):
 *   - Groq Llama 3.3 70B Versatile (30 RPM, 14400 RPD free)
 *   - Mistral Small (generous free tier, reliable)
 *
 * Tier 3 (Free / Emergency):
 *   - Llama 3.3 70B (OpenRouter free, often rate-limited)
 *   - Llama 3.1 8B (Cerebras, emergency ultra-fast)
 *
 * Total: 5 models across 5 providers.
 *
 * All providers use NATIVE AI SDK packages (@ai-sdk/google, @ai-sdk/groq,
 * @ai-sdk/mistral, @ai-sdk/cerebras, @openrouter/ai-sdk-provider).
 * Native providers handle each API's streaming format correctly, including
 * tool call parsing. Using createOpenAI() as a generic wrapper causes
 * "Expected 'function' type." errors on streaming tool calls (vercel/ai#5350).
 *
 * REMOVED (Feb 2026):
 *   - createOpenAI() for Groq/Mistral/Cerebras — caused "Expected 'function'
 *     type." on streaming tool calls + defaulted to /responses API (404/400)
 *   - Mistral tool call ID middleware — native @ai-sdk/mistral handles IDs
 *   - devstral-2512:free — OpenRouter free period ended (returns 404)
 *   - cerebras llama-3.3-70b — deprecated on Cerebras Feb 16 2026
 *   - gemini-3-flash-preview — requires thought_signature for tool calls,
 *     broken with @ai-sdk/google v3 (issues #11413, #12351)
 */

import { google } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createMistral } from '@ai-sdk/mistral';
import { createCerebras } from '@ai-sdk/cerebras';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { captureError, addBreadcrumb } from '@/lib/sentry';

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

const mistral = createMistral({
  apiKey: getApiKey('MISTRAL_API_KEY'),
});

const cerebras = createCerebras({
  apiKey: getApiKey('CEREBRAS_API_KEY'),
});

const openrouter = createOpenRouter({
  apiKey: getApiKey('OPENROUTER_API_KEY'),
});

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
 * Serializes the entire options object and uses ~3.5 chars per token (conservative).
 * This is a rough estimate — good enough for skipping models with tiny limits.
 */
function estimateInputTokens(options: LanguageModelV3CallOptions): number {
  try {
    const serialized = JSON.stringify(options);
    return Math.ceil(serialized.length / 3.5);
  } catch {
    return 0; // Can't estimate — don't skip
  }
}

/**
 * All models in fallback order. Each request tries from index 0.
 * No shared state between requests — every request gets a fresh attempt.
 *
 * maxInputTokens: set below the provider's TPM/context limit with buffer.
 * - Groq free tier: 12k TPM total → cap at 10k to leave room for output
 * - Cerebras: 8192 context window → cap at 6k to leave room for output
 */
const MODEL_CONFIGS: ModelConfig[] = [
  // Tier 1: Primary (Google Gemini — best quality, 20 RPD free, 1M context)
  { model: google('gemini-2.5-flash'), name: 'Gemini 2.5 Flash' },

  // Tier 2: High-quota fallbacks (catch Gemini overflow)
  { model: groq('llama-3.3-70b-versatile'), name: 'Llama 3.3 70B (Groq)', maxInputTokens: 10000 },
  { model: mistral('mistral-small-latest'), name: 'Mistral Small' },

  // Tier 3: Free / Emergency (OpenRouter free models are often 429'd)
  { model: openrouter('meta-llama/llama-3.3-70b-instruct:free'), name: 'Llama 3.3 70B (OpenRouter)' },
  { model: cerebras('llama3.1-8b'), name: 'Llama 3.1 8B (Cerebras)', maxInputTokens: 6000 },
];

// =============================================================================
// Simple Fallback Model
// =============================================================================

/**
 * Format error for logging: extract message, status code, and type.
 */
function formatError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const errAny = error as any;
  const status = errAny?.statusCode || errAny?.status || '';
  const name = errAny?.name || 'Error';
  const msg = error.message?.slice(0, 300) || 'unknown';

  return status ? `[${name} ${status}] ${msg}` : `[${name}] ${msg}`;
}

/**
 * Simple sequential fallback model. Tries each model in order for every request.
 *
 * Unlike ai-fallback, this has:
 * - No shared state between requests (use forRequest() for per-request isolation)
 * - No complex stream wrapping or mid-stream recovery
 * - Clear, sequential logging of every model attempt
 * - ALL errors are retried (no shouldRetryThisError issues)
 *
 * Trade-off: no mid-stream recovery. If a model starts streaming and fails
 * mid-stream, the error propagates. This is acceptable because:
 * - Most errors (rate limit, quota, auth, 404) happen at connection time
 * - Mid-stream failures are rare
 * - Simplicity prevents the bugs that caused the fallback to silently fail
 */
export class FallbackModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;

  /** Last model that succeeded (per-instance — use forRequest() for isolation). */
  lastUsedModel = '';

  /** Number of models tried in the last request (1 = primary succeeded). */
  lastAttemptCount = 0;

  get modelId(): string {
    return this.configs[0]?.name || 'fallback';
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

      // Skip models with insufficient context/TPM limits
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
        this.lastUsedModel = config.name;
        this.lastAttemptCount = i + 1;
        return result;
      } catch (error) {
        const errorStr = formatError(error);
        errors.push({ name: config.name, error: errorStr });
        console.warn(`[Fallback] ${config.name} FAILED (${mode}): ${errorStr}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} FAILED (${mode})`, level: 'warning', data: { modelIndex: i, error: errorStr } });
      }
    }

    // All models failed — throw with comprehensive info and report to Sentry
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
 * Every request starts from model #1 (Gemini). If it fails, tries #2, #3, etc.
 */
export const chatModel = new FallbackModel(MODEL_CONFIGS);

export const PRIMARY_MODEL_NAME = MODEL_CONFIGS[0]!.name;

export const SUPPORTED_MODELS = [
  // Tier 1: Primary (Google Gemini)
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 1, toolCalling: '~90%' },

  // Tier 2: High-quota fallbacks
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: 'Groq', tier: 2, toolCalling: '77.3%' },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'Mistral', tier: 2, toolCalling: '~70%' },

  // Tier 3: Free / Emergency
  { id: 'llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'OpenRouter', tier: 3, toolCalling: '77.3%' },
  { id: 'llama3.1-8b', name: 'Llama 3.1 8B', provider: 'Cerebras', tier: 3, toolCalling: '~50%' },
] as const;
