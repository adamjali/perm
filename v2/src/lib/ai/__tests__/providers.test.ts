import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the external providers to prevent API calls
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((model) => ({
    specificationVersion: 'v3',
    provider: 'google',
    modelId: model,
    supportedUrls: {},
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  })),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model) => ({
    specificationVersion: 'v3',
    provider: 'openrouter',
    modelId: model,
    supportedUrls: {},
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  }))),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(({ baseURL }: { baseURL: string }) => {
    const makeMockModel = (model: string) => {
      let providerType = 'openai';
      if (baseURL?.includes('groq')) providerType = 'groq';
      else if (baseURL?.includes('cerebras')) providerType = 'cerebras';
      else if (baseURL?.includes('mistral')) providerType = 'mistral';
      return {
        specificationVersion: 'v3',
        provider: providerType,
        modelId: model,
        supportedUrls: {},
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      };
    };
    // @ai-sdk/openai v3: default call uses Responses API, .chat() uses Chat Completions
    // Use Object.assign to add .chat to the callable function
    return Object.assign(vi.fn(makeMockModel), { chat: vi.fn(makeMockModel) });
  }),
}));

// Mock wrapLanguageModel to pass through
vi.mock('ai', () => ({
  wrapLanguageModel: ({ model }: { model: unknown }) => model,
}));

describe('AI Providers', () => {
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

    // Check structure
    expect(SUPPORTED_MODELS[0]).toHaveProperty('id');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('name');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('provider');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('tier');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('toolCalling');

    // Verify tier distribution: 1 Tier 1, 2 Tier 2, 2 Tier 3
    const tier1 = SUPPORTED_MODELS.filter(m => m.tier === 1);
    const tier2 = SUPPORTED_MODELS.filter(m => m.tier === 2);
    const tier3 = SUPPORTED_MODELS.filter(m => m.tier === 3);
    expect(tier1.length).toBe(1);
    expect(tier2.length).toBe(2);
    expect(tier3.length).toBe(2);
  });

  it('exports all 5 providers in SUPPORTED_MODELS', async () => {
    const { SUPPORTED_MODELS } = await import('../providers');
    const providers = new Set(SUPPORTED_MODELS.map(m => m.provider));
    expect(providers).toContain('Google');
    expect(providers).toContain('OpenRouter');
    expect(providers).toContain('Mistral');
    expect(providers).toContain('Groq');
    expect(providers).toContain('Cerebras');
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
