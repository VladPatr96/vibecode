import { describe, it, expect } from 'vitest';

import { OpencodeCLIProvider } from '../providers/opencode';
import { ProviderType } from '../providers/types';

describe('OpencodeCLIProvider', () => {
  it('should create instance', () => {
    const provider = OpencodeCLIProvider.create();
    expect(provider.providerType).toBe('opencode');
  });

  it('should have correct capabilities', () => {
    const provider = OpencodeCLIProvider.create();
    expect(provider.capabilities.supportsApiKey).toBe(true);
    expect(provider.capabilities.supportedModels).toContain('deepseek-v3');
    expect(provider.capabilities.supportedModels).toContain('deepseek-coder');
  });

  it('should return CLI command', async () => {
    const provider = OpencodeCLIProvider.create();
    await provider.initialize({
      id: 'test',
      name: 'Test',
      providerType: ProviderType.OPENCODE,
      model: 'deepseek-v3',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const cmd = provider.getCliCommand();
    expect(cmd[0]).toBe('opencode');
  });
});
