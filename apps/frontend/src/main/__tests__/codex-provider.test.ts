import { describe, it, expect } from 'vitest';

import { CodexCLIProvider } from '../providers/codex';
import { ProviderType } from '../providers/types';

describe('CodexCLIProvider', () => {
  it('should create instance', () => {
    const provider = CodexCLIProvider.create();
    expect(provider.providerType).toBe('codex');
  });

  it('should have correct capabilities', () => {
    const provider = CodexCLIProvider.create();
    expect(provider.capabilities.supportsOAuth).toBe(true);
    expect(provider.capabilities.supportsApiKey).toBe(true);
    expect(provider.capabilities.supportedModels).toContain('gpt-4o');
    expect(provider.capabilities.supportedModels).toContain('o3');
  });

  it('should return CLI command', async () => {
    const provider = CodexCLIProvider.create();
    await provider.initialize({
      id: 'test',
      name: 'Test',
      providerType: ProviderType.CODEX,
      model: 'gpt-4o',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const cmd = provider.getCliCommand();
    expect(cmd[0]).toBe('codex');
  });

  it('should provide environment variables', async () => {
    const provider = CodexCLIProvider.create();
    await provider.initialize({
      id: 'test',
      name: 'Test',
      providerType: ProviderType.CODEX,
      model: 'gpt-4o',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const env = provider.getCliEnvironment();
    expect(typeof env).toBe('object');
  });
});
