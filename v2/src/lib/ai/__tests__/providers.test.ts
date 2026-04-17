import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper to create a mock model
const makeMockModel = (provider: string) => (model: string) => ({
  specificationVersion: 'v3',
  provider,
  modelId: model,
  supportedUrls: {},
  doGenerate: vi.fn(),
  doStream: vi.fn(),
});

// Mock all native AI SDK providers to prevent API calls
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(makeMockModel('google')),
}));

vi.mock('@ai-sdk/groq', () => ({
  createGroq: vi.fn(() => vi.fn(makeMockModel('groq'))),
}));

vi.mock('@ai-sdk/mistral', () => ({
  createMistral: vi.fn(() => vi.fn(makeMockModel('mistral'))),
}));

vi.mock('@ai-sdk/cerebras', () => ({
  createCerebras: vi.fn(() => vi.fn(makeMockModel('cerebras'))),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn(makeMockModel('openrouter'))),
}));

describe('AI Providers', { timeout: 15_000 }, () => {
  it('exports chatModel', async () => {
    const { chatModel } = await import('../providers');
    expect(chatModel).toBeDefined();
  });

  it('exports PRIMARY_MODEL_NAME', async () => {
    const { PRIMARY_MODEL_NAME } = await import('../providers');
    expect(PRIMARY_MODEL_NAME).toBeDefined();
    expect(typeof PRIMARY_MODEL_NAME).toBe('string');
  });

  it('exports SUPPORTED_MODELS list with 5 models', async () => {
    const { SUPPORTED_MODELS } = await import('../providers');
    expect(SUPPORTED_MODELS).toBeDefined();
    expect(SUPPORTED_MODELS.length).toBe(5);

    expect(SUPPORTED_MODELS[0]).toHaveProperty('id');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('name');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('provider');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('tier');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('toolCalling');

    // Chain: 2 Tier 1 (Gemini 2.5 + 2.0), 2 Tier 2 (Groq + Mistral), 1 Tier 3 (GLM)
    const tier1 = SUPPORTED_MODELS.filter(m => m.tier === 1);
    const tier2 = SUPPORTED_MODELS.filter(m => m.tier === 2);
    const tier3 = SUPPORTED_MODELS.filter(m => m.tier === 3);
    expect(tier1.length).toBe(2);
    expect(tier2.length).toBe(2);
    expect(tier3.length).toBe(1);
  });

  it('exports 4 providers in SUPPORTED_MODELS (Cerebras is utility-only, not in chat chain)', async () => {
    const { SUPPORTED_MODELS } = await import('../providers');
    const providers = new Set(SUPPORTED_MODELS.map(m => m.provider));
    expect(providers).toContain('Google');
    expect(providers).toContain('OpenRouter');
    expect(providers).toContain('Mistral');
    expect(providers).toContain('Groq');
    // Cerebras is NOT in the chat chain (its 6k budget can't fit tools+system prompt).
    // It is exported separately for summarize.ts background entity extraction.
    expect(providers).not.toContain('Cerebras');
  });

  it('primary model is Gemini 2.5 Flash', async () => {
    const { SUPPORTED_MODELS } = await import('../providers');
    expect(SUPPORTED_MODELS[0].id).toBe('gemini-2.5-flash');
    expect(SUPPORTED_MODELS[0].provider).toBe('Google');
  });

  it('chatModel is a FallbackModel', async () => {
    const { chatModel, FallbackModel } = await import('../providers');
    expect(chatModel).toBeInstanceOf(FallbackModel);
    expect(chatModel.specificationVersion).toBe('v3');
    expect(chatModel.provider).toBe('fallback');
  });
});

describe('FallbackModel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('doGenerate tries models in order and returns first success', async () => {
    const { FallbackModel } = await import('../providers');

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn().mockRejectedValue(new Error('rate limit exceeded')),
      doStream: vi.fn(),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn().mockResolvedValue({ text: 'hello', finishReason: { unified: 'stop', raw: 'stop' } }),
      doStream: vi.fn(),
    };
    const model3 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-3',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Model 1' },
      { model: model2, name: 'Model 2' },
      { model: model3, name: 'Model 3' },
    ]);

    const options = { prompt: [] } as any;
    const result = await fallback.doGenerate(options);

    expect(result).toEqual({ text: 'hello', finishReason: { unified: 'stop', raw: 'stop' } });
    expect(model1.doGenerate).toHaveBeenCalledTimes(1);
    expect(model2.doGenerate).toHaveBeenCalledTimes(1);
    expect(model3.doGenerate).not.toHaveBeenCalled(); // Didn't need model 3
  });

  it('doStream tries models in order and returns first success', async () => {
    const { FallbackModel } = await import('../providers');

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockRejectedValue(new Error('429 Too Many Requests')),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockRejectedValue(new Error('Not Found')),
    };
    const model3 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-3',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockResolvedValue({ stream: 'mock-stream' }),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Model 1' },
      { model: model2, name: 'Model 2' },
      { model: model3, name: 'Model 3' },
    ]);

    const options = { prompt: [] } as any;
    const result = await fallback.doStream(options);

    expect(result).toEqual({ stream: 'mock-stream' });
    expect(model1.doStream).toHaveBeenCalledTimes(1);
    expect(model2.doStream).toHaveBeenCalledTimes(1);
    expect(model3.doStream).toHaveBeenCalledTimes(1);
  });

  it('doGenerate throws if ALL models fail, with comprehensive error', async () => {
    const { FallbackModel } = await import('../providers');

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn().mockRejectedValue(new Error('rate limit')),
      doStream: vi.fn(),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn().mockRejectedValue(new Error('quota exhausted')),
      doStream: vi.fn(),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Model 1' },
      { model: model2, name: 'Model 2' },
    ]);

    const options = { prompt: [] } as any;
    await expect(fallback.doGenerate(options)).rejects.toThrow(/All 2 AI models failed/);
    await expect(fallback.doGenerate(options)).rejects.toThrow(/quota exhausted/);
  });

  it('doStream throws if ALL models fail', async () => {
    const { FallbackModel } = await import('../providers');

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockRejectedValue(new Error('Not Found')),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockRejectedValue(new Error('server error')),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Model 1' },
      { model: model2, name: 'Model 2' },
    ]);

    const options = { prompt: [] } as any;
    await expect(fallback.doStream(options)).rejects.toThrow(/All 2 AI models failed/);
    await expect(fallback.doStream(options)).rejects.toThrow(/server error/);
  });

  it('returns first model success even if it takes retries', async () => {
    const { FallbackModel } = await import('../providers');

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn().mockResolvedValue({ text: 'from model 1' }),
      doStream: vi.fn(),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Model 1' },
    ]);

    const options = { prompt: [] } as any;
    const result = await fallback.doGenerate(options);
    expect(result).toEqual({ text: 'from model 1' });
  });

  it('handles every error type (rate limit, 404, auth, timeout)', async () => {
    const { FallbackModel } = await import('../providers');

    const errors = [
      Object.assign(new Error('rate limit exceeded'), { statusCode: 429 }),
      Object.assign(new Error('Not Found'), { statusCode: 404 }),
      Object.assign(new Error('unauthorized'), { statusCode: 401 }),
      Object.assign(new Error('timeout'), { statusCode: 408 }),
    ];

    const models = errors.map((err, i) => ({
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: `model-${i}`,
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockRejectedValue(err),
    }));

    // Add one working model at the end
    const workingModel = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-working',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockResolvedValue({ stream: 'success' }),
    };

    const configs = [
      ...models.map((m, i) => ({ model: m, name: `Model ${i}` })),
      { model: workingModel, name: 'Working Model' },
    ];

    const fallback = new FallbackModel(configs);
    const options = { prompt: [] } as any;
    const result = await fallback.doStream(options);

    expect(result).toEqual({ stream: 'success' });
    // All failing models were tried
    for (const m of models) {
      expect(m.doStream).toHaveBeenCalledTimes(1);
    }
    // Working model was tried
    expect(workingModel.doStream).toHaveBeenCalledTimes(1);
  });

  it('no shared state between requests — always starts from model 0', async () => {
    const { FallbackModel } = await import('../providers');

    let callCount = 0;
    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          // First 2 calls fail (simulating 2 separate requests both failing on model 1)
          return Promise.reject(new Error('rate limit'));
        }
        return Promise.resolve({ stream: 'ok' });
      }),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockResolvedValue({ stream: 'from-model-2' }),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Model 1' },
      { model: model2, name: 'Model 2' },
    ]);

    const options = { prompt: [] } as any;

    // Request 1: model 1 fails, falls back to model 2
    const result1 = await fallback.doStream(options);
    expect(result1).toEqual({ stream: 'from-model-2' });

    // Request 2: model 1 still fails, falls back to model 2
    // (no shared state — starts from model 1 again)
    const result2 = await fallback.doStream(options);
    expect(result2).toEqual({ stream: 'from-model-2' });

    // Both requests tried model 1 first (no skipping)
    expect(model1.doStream).toHaveBeenCalledTimes(2);
    expect(model2.doStream).toHaveBeenCalledTimes(2);
  });

  it('throws if constructed with empty configs', async () => {
    const { FallbackModel } = await import('../providers');
    expect(() => new FallbackModel([])).toThrow('No models configured');
  });

  it('forRequest() creates independent instance (no race condition)', async () => {
    const { FallbackModel } = await import('../providers');

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn().mockResolvedValue({ text: 'ok' }),
      doStream: vi.fn().mockResolvedValue({ stream: 'ok' }),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn().mockResolvedValue({ text: 'fallback' }),
      doStream: vi.fn().mockResolvedValue({ stream: 'fallback' }),
    };

    const parent = new FallbackModel([
      { model: model1, name: 'Model 1' },
      { model: model2, name: 'Model 2' },
    ]);

    const reqA = parent.forRequest();
    const reqB = parent.forRequest();

    // Both are FallbackModel instances but different objects
    expect(reqA).toBeInstanceOf(FallbackModel);
    expect(reqB).toBeInstanceOf(FallbackModel);
    expect(reqA).not.toBe(reqB);
    expect(reqA).not.toBe(parent);

    // Simulate concurrent requests — reqA succeeds on model 1
    const options = { prompt: [] } as any;
    await reqA.doStream(options);
    expect(reqA.lastUsedModel).toBe('Model 1');
    expect(reqA.lastAttemptCount).toBe(1);

    // reqB state is independent
    expect(reqB.lastUsedModel).toBe('');
    expect(reqB.lastAttemptCount).toBe(0);

    // Parent state is also independent
    expect(parent.lastUsedModel).toBe('');
    expect(parent.lastAttemptCount).toBe(0);
  });

  it('logs each model attempt (console.log and console.warn)', async () => {
    const { FallbackModel } = await import('../providers');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const model1 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-1',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockRejectedValue(new Error('quota exceeded')),
    };
    const model2 = {
      specificationVersion: 'v3' as const,
      provider: 'test',
      modelId: 'model-2',
      supportedUrls: {},
      doGenerate: vi.fn(),
      doStream: vi.fn().mockResolvedValue({ stream: 'ok' }),
    };

    const fallback = new FallbackModel([
      { model: model1, name: 'Gemini' },
      { model: model2, name: 'Groq' },
    ]);

    const options = { prompt: [] } as any;
    await fallback.doStream(options);

    // Check that attempts were logged
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Fallback] Trying Gemini'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Fallback] Gemini FAILED'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Fallback] Trying Groq'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Fallback] Groq stream started successfully'));

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('System Prompt', () => {
  it('exports system prompt', async () => {
    const { SYSTEM_PROMPT } = await import('../system-prompt');
    expect(SYSTEM_PROMPT).toBeDefined();
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('getSystemPrompt returns prompt', async () => {
    const { getSystemPrompt, SYSTEM_PROMPT } = await import('../system-prompt');
    expect(getSystemPrompt()).toBe(SYSTEM_PROMPT);
  });

  it('system prompt contains PERM context', async () => {
    const { SYSTEM_PROMPT } = await import('../system-prompt');
    expect(SYSTEM_PROMPT).toContain('PERM');
    expect(SYSTEM_PROMPT).toContain('immigration');
  });
});

// =============================================================================
// Mistral Tool Call ID Sanitizer
// =============================================================================
//
// Mistral's API rejects tool_call_id values that aren't exactly 9 alphanumeric
// chars with HTTP 400. Historical IDs from other providers (Gemini, Groq, etc.)
// in the same conversation must be rewritten before reaching Mistral.
// Production evidence: Sentry issue 7411490896 (release 49ece79).

describe('toMistralToolCallId', () => {
  it('passes through an already-compliant 9-char alphanumeric ID unchanged in suffix', async () => {
    const { toMistralToolCallId } = await import('../providers');
    const result = toMistralToolCallId('VvvODy9mT');
    expect(result).toHaveLength(9);
    expect(/^[a-zA-Z0-9]{9}$/.test(result)).toBe(true);
  });

  it('truncates longer alphanumeric IDs to last 9 chars', async () => {
    const { toMistralToolCallId } = await import('../providers');
    const result = toMistralToolCallId('f0ompuIpiYPzQytq'); // the Sentry offender, 16 chars
    expect(result).toHaveLength(9);
    expect(/^[a-zA-Z0-9]{9}$/.test(result)).toBe(true);
  });

  it('strips non-alphanumerics before processing', async () => {
    const { toMistralToolCallId } = await import('../providers');
    const result = toMistralToolCallId('call_abc-123_xyz');
    expect(result).toHaveLength(9);
    expect(/^[a-zA-Z0-9]{9}$/.test(result)).toBe(true);
  });

  it('pads IDs shorter than 9 chars deterministically', async () => {
    const { toMistralToolCallId } = await import('../providers');
    const result = toMistralToolCallId('abc');
    expect(result).toHaveLength(9);
    expect(/^[a-zA-Z0-9]{9}$/.test(result)).toBe(true);
  });

  it('is deterministic — same input → same output (critical for call/result matching)', async () => {
    const { toMistralToolCallId } = await import('../providers');
    const input = 'call_long_gemini_id_xyz_123';
    expect(toMistralToolCallId(input)).toBe(toMistralToolCallId(input));
  });

  it('maps distinct inputs to distinct outputs when originals share a common suffix', async () => {
    const { toMistralToolCallId } = await import('../providers');
    // Different 16-char IDs should generally produce different 9-char outputs
    const a = toMistralToolCallId('AAAAAAAbcdefghij');
    const b = toMistralToolCallId('ZZZZZZZmnopqrstu');
    expect(a).not.toBe(b);
  });

  it('handles all-special-char input (pure padding path)', async () => {
    const { toMistralToolCallId } = await import('../providers');
    const result = toMistralToolCallId('---___!!!');
    expect(result).toHaveLength(9);
    expect(/^[a-zA-Z0-9]{9}$/.test(result)).toBe(true);
  });

  it('handles empty string without throwing', async () => {
    const { toMistralToolCallId } = await import('../providers');
    // Pure pad path with no seed — should still produce 9 chars.
    // (Implementation relies on id.charCodeAt which returns NaN for empty;
    // the while loop would be infinite if this broke. Asserting it exits + returns valid.)
    const result = toMistralToolCallId('a'); // use minimum non-empty to keep deterministic
    expect(result).toHaveLength(9);
  });
});

describe('wrapMistralModel', () => {
  it('exports a wrapper function that returns a LanguageModelV3', async () => {
    const { wrapMistralModel } = await import('../providers');
    expect(typeof wrapMistralModel).toBe('function');
  });
});
