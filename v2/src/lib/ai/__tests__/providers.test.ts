import { describe, it, expect, vi } from 'vitest';

// Mock the external providers to prevent API calls
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((model) => ({ provider: 'google', modelId: model })),
}));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: vi.fn(() => vi.fn((model) => ({ provider: 'openrouter', modelId: model }))),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(({ baseURL }: { baseURL: string }) => {
    return vi.fn((model) => {
      let providerType = 'openai';
      if (baseURL?.includes('groq')) providerType = 'groq';
      else if (baseURL?.includes('cerebras')) providerType = 'cerebras';
      else if (baseURL?.includes('mistral')) providerType = 'mistral';
      return { provider: providerType, modelId: model };
    });
  }),
}));

// Mock ai-fallback to return a simple object
vi.mock('ai-fallback', () => ({
  createFallback: vi.fn((config) => ({
    models: config.models,
    retryAfterOutput: config.retryAfterOutput,
    modelResetInterval: config.modelResetInterval,
  })),
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

  it('exports SUPPORTED_MODELS list with 8 models', async () => {
    const { SUPPORTED_MODELS } = await import('../providers');
    expect(SUPPORTED_MODELS).toBeDefined();
    expect(SUPPORTED_MODELS.length).toBe(8);

    // Check structure
    expect(SUPPORTED_MODELS[0]).toHaveProperty('id');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('name');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('provider');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('tier');
    expect(SUPPORTED_MODELS[0]).toHaveProperty('toolCalling');

    // Verify tier distribution: 2 Tier 1, 4 Tier 2, 2 Tier 3
    const tier1 = SUPPORTED_MODELS.filter(m => m.tier === 1);
    const tier2 = SUPPORTED_MODELS.filter(m => m.tier === 2);
    const tier3 = SUPPORTED_MODELS.filter(m => m.tier === 3);
    expect(tier1.length).toBe(2);
    expect(tier2.length).toBe(4);
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
    expect(providers.size).toBe(5);
  });

  it('primary model is Gemini 2.5 Flash', async () => {
    const { SUPPORTED_MODELS } = await import('../providers');
    expect(SUPPORTED_MODELS[0].id).toBe('gemini-2.5-flash');
    expect(SUPPORTED_MODELS[0].provider).toBe('Google');
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
