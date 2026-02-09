import { describe, it, expect } from 'vitest';

describe('ProviderType', () => {
  it('should include codex and opencode types', async () => {
    const { ProviderType } = await import('../types');
    expect(ProviderType.CODEX).toBe('codex');
    expect(ProviderType.OPENCODE).toBe('opencode');
  });

  it('should have display names for all providers', async () => {
    const { ProviderType, PROVIDER_DISPLAY_NAMES } = await import('../types');
    expect(PROVIDER_DISPLAY_NAMES[ProviderType.CODEX]).toBeDefined();
    expect(PROVIDER_DISPLAY_NAMES[ProviderType.OPENCODE]).toBeDefined();
  });

  it('should have default models for all providers', async () => {
    const { ProviderType, DEFAULT_MODELS } = await import('../types');
    expect(DEFAULT_MODELS[ProviderType.CODEX]).toBeDefined();
    expect(DEFAULT_MODELS[ProviderType.OPENCODE]).toBeDefined();
  });
});
