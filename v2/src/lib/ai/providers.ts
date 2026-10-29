/**
 * AI Provider Configuration
 *
 * 5-model free fallback chain with automatic failover. Tries each in order;
 * if one fails (503, rate limit, quota, auth, 404, any error), moves to the next.
 *
 * Chain (each checked live on Oct 12 2026, see MODEL_CONFIGS):
 *
 *   Tier 1, Google Gemini (primary, 1M context, a daily free allowance per model):
 *     1. Gemini 2.5 Flash
 *     2. Gemini 3.5 Flash Lite
 *     3. Gemini 3.8 Flash
 *
 *   Tier 2, other providers:
 *     4. GPT-OSS 120B on Groq (8k tokens a minute free, so short conversations only)
 *
 *   Tier 3, free large-context emergency fallback:
 *     5. Nemotron 3.5 Super via OpenRouter (1M context, free models: 50 requests a day)
 *
 * Mistral Small left the chain on Oct 29 2026: its free account had allowed
 * 0 requests a minute since at least Oct 12, so it never answered.
 *
 * The summarizer (summarize.ts) uses Groq's GPT-OSS models directly.
 *
 * All providers use NATIVE AI SDK packages (@ai-sdk/google, @ai-sdk/groq,
 * @openrouter/ai-sdk-provider).
 * Native providers handle each API's streaming format correctly, including
 * tool call parsing. Using createOpenAI() as a generic wrapper causes
 * "Expected 'function' type." errors on streaming tool calls (vercel/ai#5350).
 */

import { google } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider';
import { captureError, addBreadcrumb } from '@/lib/sentry';
import { estimateTokensOf } from './compaction';

// =============================================================================
// Provider Clients (all native SDKs — no createOpenAI() wrappers)
// =============================================================================

function getApiKey(name: string): string {
  const value = process.env[name];
  if (!value) {
    // Surface to Sentry at module load so missing env vars are an actionable
    // single issue at deploy time rather than a 401 storm during traffic.
    const msg = `[AI Providers] Missing env var: ${name}, this provider will fail at runtime`;
    console.warn(msg);
    captureError(new Error(msg), {
      operation: 'ai.providers.missingEnvVar',
      tags: { envVar: name },
    });
  }
  return value || '';
}

export const groq = createGroq({
  apiKey: getApiKey('GROQ_API_KEY'),
});

const openrouter = createOpenRouter({
  apiKey: getApiKey('OPENROUTER_API_KEY'),
});

// =============================================================================
// Model Configuration
// =============================================================================

interface ModelConfig {
  model: LanguageModelV4;
  name: string;
  /** Max estimated input tokens. Skip this model if input exceeds this. */
  maxInputTokens?: number;
  /** Lower the requested output cap to this for this model only. */
  maxOutputTokens?: number;
}

/**
 * The route asks for CHAT_MAX_OUTPUT_TOKENS (8,000, src/lib/ai/limits.ts).
 * Groq's free tier counts the requested maximum against an 8,000
 * tokens-a-minute budget shared with the input (its own rate-limit headers,
 * Oct 12 2026), so it asks for 2,000 and takes conversations under about
 * 5,000 estimated tokens.
 */
export const MODEL_OUTPUT_CAPS: Record<string, number> = {
  'GPT-OSS 120B (Groq)': 2000,
};

/** The call options for one model, with its own output cap applied. */
function optionsFor(config: ModelConfig, options: LanguageModelV4CallOptions): LanguageModelV4CallOptions {
  const cap = config.maxOutputTokens;
  if (cap === undefined || options.maxOutputTokens === undefined || options.maxOutputTokens <= cap) {
    return options;
  }
  return { ...options, maxOutputTokens: cap };
}

/**
 * Estimate total input token count from call options.
 * Delegates to the shared estimator in compaction.ts; over-counts vs actual
 * model tokens by ~30-50% due to JSON overhead, biased toward skipping
 * marginal models rather than sending oversized payloads.
 */
function estimateInputTokens(options: LanguageModelV4CallOptions): number {
  return estimateTokensOf(options);
}

/**
 * Fallback chain (5 models). Each request tries from index 0.
 * No shared state between requests, every request gets a fresh attempt.
 *
 * Every model here answered a two-step tool call through this SDK on
 * Oct 12 2026 with the production keys. Retired that day: Gemini 2.0 Flash (404), Groq's Llama
 * 3.3 70B (gone from Groq's model list), OpenRouter's free GLM 4.5 Air (404);
 * Cerebras's free tier now answers 402. A model that's gone is reported on
 * first sight (reportModelGone), not only when every model fails. Oct 29 2026:
 * OpenRouter's free Nemotron 3 Super answered "unavailable for free"; Nemotron
 * 3.5 Super took its place after a two-step tool call with the production key.
 * OpenRouter serves free models only to accounts that allow free-model
 * training (asked with training refused: "No endpoints found matching your
 * data policy"). Mistral Small left the chain the same day: its free account
 * allowed 0 requests a minute (scripts/check_chat_models.py, Oct 29 2026).
 *
 * Gemini's free tier counts requests per model, so three Gemini models give
 * three separate daily allowances. maxInputTokens is the realistic usable
 * budget including tools:
 *   - Groq free tier: 8k tokens a minute, input plus requested output
 *   - Others: 128k to 1M context, no cap needed
 */
const MODEL_CONFIGS: ModelConfig[] = [
  // Tier 1: Google Gemini, 1M context
  { model: google('gemini-2.5-flash'), name: 'Gemini 2.5 Flash' },
  { model: google('gemini-3.5-flash-lite'), name: 'Gemini 3.5 Flash Lite' },
  { model: google('gemini-3.8-flash'), name: 'Gemini 3.8 Flash' },

  // Tier 2: other providers' fallbacks
  {
    model: groq('openai/gpt-oss-120b'),
    name: 'GPT-OSS 120B (Groq)',
    maxInputTokens: 5000,
    maxOutputTokens: MODEL_OUTPUT_CAPS['GPT-OSS 120B (Groq)'],
  },

  // Tier 3: free large-context emergency
  { model: openrouter('nvidia/nemotron-3.5-super-vl:free'), name: 'Nemotron 3.5 Super (OpenRouter)' },
];

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
 * A model the provider no longer serves (404) or no longer serves free
 * (402, or OpenRouter's "unavailable for free") fails every request until the
 * chain is edited, and the chain hides it while a later model answers. Report
 * each one once per process, so it reaches Sentry the first time it's seen.
 */
const reportedGone = new Set<string>();

export function isModelGone(error: unknown): boolean {
  const e = error as ErrorLike | undefined;
  const status = Number(e?.statusCode ?? e?.status);
  const msg = String((e as Error | undefined)?.message ?? '');
  return status === 404 || status === 402 || /no longer available|unavailable for free|model.+not found|decommissioned/i.test(msg);
}

function reportModelGone(name: string, error: unknown): void {
  if (reportedGone.has(name) || !isModelGone(error)) return;
  reportedGone.add(name);
  captureError(new Error(`AI model unavailable: ${name}. ${formatError(error)}`), {
    operation: 'ai.fallback.modelGone',
    tags: { model: name },
  });
}

/** Test hook: forget which models were reported. */
export function resetReportedGone(): void {
  reportedGone.clear();
}

// =============================================================================
// Simple Fallback Model
// =============================================================================

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
export class FallbackModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4' as const;

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
    invoke: (model: LanguageModelV4, options: LanguageModelV4CallOptions) => PromiseLike<T>,
    options: LanguageModelV4CallOptions,
  ): Promise<T> {
    const errors: Array<{ name: string; error: string }> = [];
    const estimatedTokens = estimateInputTokens(options);

    for (let i = 0; i < this.configs.length; i++) {
      const config = this.configs[i]!;

      if (
        config.maxInputTokens !== undefined &&
        estimatedTokens !== undefined &&
        estimatedTokens > config.maxInputTokens
      ) {
        const msg = `Input too large (~${estimatedTokens} tokens, limit ${config.maxInputTokens})`;
        errors.push({ name: config.name, error: msg });
        console.warn(`[Fallback] ${config.name} SKIPPED (${i + 1}/${this.configs.length}): ${msg}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} SKIPPED`, level: 'warning', data: { modelIndex: i, estimatedTokens, limit: config.maxInputTokens } });
        continue;
      }

      try {
        console.log(`[Fallback] Trying ${config.name} (${i + 1}/${this.configs.length}) for ${mode}...`);
        addBreadcrumb({ category: 'ai.fallback', message: `Trying ${config.name} for ${mode}`, data: { modelIndex: i, totalModels: this.configs.length } });
        const result = await invoke(config.model, optionsFor(config, options));
        const successMsg = mode === 'stream'
          ? `${config.name} stream started successfully`
          : `${config.name} succeeded (${mode})`;
        console.log(`[Fallback] ${successMsg}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} succeeded (${mode})`, data: { modelIndex: i } });
        this._lastUsedModel = config.name;
        this._lastAttemptCount = i + 1;
        return result;
      } catch (error) {
        // The request was aborted (Stop, a closed tab): every other model would
        // fail the same way, and none of it is a provider failure.
        if (options.abortSignal?.aborted) throw error;
        const errorStr = formatError(error);
        errors.push({ name: config.name, error: errorStr });
        reportModelGone(config.name, error);
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

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    return this.tryModels('generate', (model, opts) => model.doGenerate(opts), options);
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    return this.tryModels('stream', (model, opts) => model.doStream(opts), options);
  }
}

// =============================================================================
// Mid-stream failure telemetry
// =============================================================================

/**
 * Report an UNRECOVERABLE mid-stream failure, an error that surfaced AFTER a
 * provider's `doStream()` resolved (provider dropped the connection, 5xx
 * mid-generation, quota exhausted partway). These escape `FallbackModel`'s
 * connection-time retry loop entirely: no failover to the remaining models
 * happens, by design (mid-stream failover risks double-billing).
 *
 * This is a DISTINCT signal from `ai.fallback.allFailed` (all connection-time
 * attempts failed) so the rate of the unrecoverable mid-stream gap is
 * separately measurable in Sentry rather than blending into generic failures.
 *
 * @param error - The mid-stream error.
 * @param context - Which model was streaming + how many attempts it took to start.
 */
export function reportMidStreamFailure(
  error: unknown,
  context: { modelUsed?: string; attempts?: number; sessionId?: string } = {},
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  addBreadcrumb({
    category: 'ai.fallback',
    message: 'mid-stream failure (no failover)',
    level: 'error',
    data: { modelUsed: context.modelUsed, attempts: context.attempts },
  });
  captureError(err, {
    operation: 'ai.fallback.midStream',
    tags: { unrecoverable: 'true' },
    extra: {
      modelUsed: context.modelUsed || 'unknown',
      attempts: context.attempts ?? 0,
      sessionId: context.sessionId,
    },
  });
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Chat model with automatic fallback across 6 models / 4 providers.
 * Every request starts from model #1 (Gemini 2.5 Flash).
 */
export const chatModel = new FallbackModel(MODEL_CONFIGS);

export const PRIMARY_MODEL_NAME = MODEL_CONFIGS[0]!.name;

/** The chain's names in order, so SUPPORTED_MODELS can be held to it. */
export const CHAT_MODEL_NAMES = MODEL_CONFIGS.map((c) => c.name);

export const SUPPORTED_MODELS = [
  // Tier 1: Google Gemini
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 1 },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite', provider: 'Google', tier: 1 },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', provider: 'Google', tier: 1 },

  // Tier 2: other providers
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'Groq', tier: 2 },

  // Tier 3: free large-context emergency
  { id: 'nvidia/nemotron-3.5-super-vl:free', name: 'Nemotron 3.5 Super', provider: 'OpenRouter', tier: 3 },
] as const;
