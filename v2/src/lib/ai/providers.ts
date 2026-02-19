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
 * REMOVED (Feb 2026):
 *   - devstral-2512:free — OpenRouter free period ended (returns 404)
 *   - cerebras llama-3.3-70b — deprecated on Cerebras Feb 16 2026
 *   - gemini-3-flash-preview — requires thought_signature for tool calls,
 *     broken with @ai-sdk/google v3 (issues #11413, #12351)
 *
 * CRITICAL: @ai-sdk/openai v3 changed the default model type from
 * Chat Completions (/chat/completions) to Responses API (/responses).
 * Non-OpenAI providers (Groq, Mistral, Cerebras) don't support /responses.
 * ALWAYS use provider.chat('model-id') — NEVER provider('model-id').
 */

import { google } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { wrapLanguageModel } from 'ai';
import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider';
import { captureError, addBreadcrumb } from '@/lib/sentry';

// =============================================================================
// Mistral Tool Call ID Fix
// =============================================================================

/**
 * Mistral requires tool call IDs to be exactly 9 alphanumeric characters.
 * The Vercel AI SDK generates longer IDs, so we need to transform them.
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
 * Wrap a Mistral-based model with middleware that fixes tool call IDs.
 */
function wrapMistralModel<T extends Parameters<typeof wrapLanguageModel>[0]['model']>(model: T): T {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: 'v3' as const,
      transformParams: async ({ params }) => {
        const transformedMessages = params.prompt.map((msg) => {
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

        return { ...params, prompt: transformedMessages };
      },
    },
  }) as T;
}

// =============================================================================
// Provider Clients
// =============================================================================

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY || '',
});

const cerebras = createOpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY || '',
});

const mistral = createOpenAI({
  baseURL: 'https://api.mistral.ai/v1',
  apiKey: process.env.MISTRAL_API_KEY || '',
});

// =============================================================================
// Model Configuration
// =============================================================================

interface ModelConfig {
  model: LanguageModelV3;
  name: string;
}

/**
 * All models in fallback order. Each request tries from index 0.
 * No shared state between requests — every request gets a fresh attempt.
 *
 * IMPORTANT: Use provider.chat('model') for createOpenAI-based providers.
 * The default provider('model') uses Responses API which non-OpenAI providers
 * don't support (returns 404 on Mistral/Cerebras, 400 on Groq).
 */
const MODEL_CONFIGS: ModelConfig[] = [
  // Tier 1: Primary (Google Gemini — best quality, 20 RPD free)
  { model: google('gemini-2.5-flash'), name: 'Gemini 2.5 Flash' },

  // Tier 2: High-quota fallbacks (catch Gemini overflow)
  { model: groq.chat('llama-3.3-70b-versatile'), name: 'Llama 3.3 70B (Groq)' },
  { model: wrapMistralModel(mistral.chat('mistral-small-latest')), name: 'Mistral Small' },

  // Tier 3: Free / Emergency (OpenRouter free models are often 429'd)
  { model: openrouter('meta-llama/llama-3.3-70b-instruct:free'), name: 'Llama 3.3 70B (OpenRouter)' },
  { model: cerebras.chat('llama3.1-8b'), name: 'Llama 3.1 8B (Cerebras)' },
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
 * - No shared state between requests (no currentModelIndex)
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

  /** Last model that succeeded (set per-request, useful for debug headers). */
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

  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    const errors: Array<{ name: string; error: string }> = [];

    for (let i = 0; i < this.configs.length; i++) {
      const config = this.configs[i]!;
      try {
        console.log(`[Fallback] Trying ${config.name} (${i + 1}/${this.configs.length}) for generate...`);
        addBreadcrumb({ category: 'ai.fallback', message: `Trying ${config.name} for generate`, data: { modelIndex: i, totalModels: this.configs.length } });
        const result = await config.model.doGenerate(options);
        console.log(`[Fallback] ${config.name} succeeded (generate)`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} succeeded (generate)`, data: { modelIndex: i } });
        this.lastUsedModel = config.name;
        this.lastAttemptCount = i + 1;
        return result;
      } catch (error) {
        const errorStr = formatError(error);
        errors.push({ name: config.name, error: errorStr });
        console.warn(`[Fallback] ${config.name} FAILED (generate): ${errorStr}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} FAILED (generate)`, level: 'warning', data: { modelIndex: i, error: errorStr } });
        captureError(error, { operation: 'ai.fallback.doGenerate', extra: { model: config.name, modelIndex: i, fallbackAttempt: true } });
      }
    }

    // All models failed — throw with comprehensive info
    const summary = errors.map((e, i) => `  ${i + 1}. ${e.name}: ${e.error}`).join('\n');
    console.error(`[Fallback] ALL ${this.configs.length} models failed (generate):\n${summary}`);
    const allFailedError = new Error(
      `All ${this.configs.length} AI models failed (generate).\n${summary}`
    );
    captureError(allFailedError, { operation: 'ai.fallback.allFailed', extra: { mode: 'generate', modelCount: this.configs.length, errors: JSON.stringify(errors) } });
    const lastErr = errors[errors.length - 1];
    throw new Error(
      `All ${this.configs.length} AI models failed. Last: ${lastErr ? lastErr.error : 'unknown'}`
    );
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    const errors: Array<{ name: string; error: string }> = [];

    for (let i = 0; i < this.configs.length; i++) {
      const config = this.configs[i]!;
      try {
        console.log(`[Fallback] Trying ${config.name} (${i + 1}/${this.configs.length}) for stream...`);
        addBreadcrumb({ category: 'ai.fallback', message: `Trying ${config.name} for stream`, data: { modelIndex: i, totalModels: this.configs.length } });
        const result = await config.model.doStream(options);
        console.log(`[Fallback] ${config.name} stream started successfully`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} stream started`, data: { modelIndex: i } });
        this.lastUsedModel = config.name;
        this.lastAttemptCount = i + 1;
        return result;
      } catch (error) {
        const errorStr = formatError(error);
        errors.push({ name: config.name, error: errorStr });
        console.warn(`[Fallback] ${config.name} FAILED (stream): ${errorStr}`);
        addBreadcrumb({ category: 'ai.fallback', message: `${config.name} FAILED (stream)`, level: 'warning', data: { modelIndex: i, error: errorStr } });
        captureError(error, { operation: 'ai.fallback.doStream', extra: { model: config.name, modelIndex: i, fallbackAttempt: true } });
      }
    }

    // All models failed — throw with comprehensive info
    const summary = errors.map((e, i) => `  ${i + 1}. ${e.name}: ${e.error}`).join('\n');
    console.error(`[Fallback] ALL ${this.configs.length} models failed (stream):\n${summary}`);
    const allFailedError = new Error(
      `All ${this.configs.length} AI models failed (stream).\n${summary}`
    );
    captureError(allFailedError, { operation: 'ai.fallback.allFailed', extra: { mode: 'stream', modelCount: this.configs.length, errors: JSON.stringify(errors) } });
    const lastErr = errors[errors.length - 1];
    throw new Error(
      `All ${this.configs.length} AI models failed. Last: ${lastErr ? lastErr.error : 'unknown'}`
    );
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
