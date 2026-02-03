import { describe, it, expect, beforeEach } from 'vitest';
import { providerRegistry } from '../providers';
import { ProviderType } from '../providers/types';
import type { ProviderProfile } from '../providers/types';

describe('Provider Registry', () => {
  beforeEach(() => {
    providerRegistry.clearAll();
  });

  it('should list available providers', () => {
    const available = providerRegistry.getAvailableProviders();
    expect(available).toContain(ProviderType.CLAUDE);
    expect(available).toContain(ProviderType.GEMINI);
    expect(available).toContain(ProviderType.OPENAI);
  });

  it('should create provider for terminal', async () => {
    const profile: ProviderProfile = {
      id: 'test-profile',
      name: 'Test Profile',
      providerType: ProviderType.CLAUDE,
      model: 'claude-sonnet-4-20250514',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const provider = await providerRegistry.createForTerminal(
      'terminal-1',
      ProviderType.CLAUDE,
      profile
    );

    expect(provider).toBeDefined();
    expect(provider.providerType).toBe(ProviderType.CLAUDE);
  });

  it('should get terminal provider', async () => {
    const profile: ProviderProfile = {
      id: 'test',
      name: 'Test',
      providerType: ProviderType.GEMINI,
      model: 'gemini-2.0-flash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await providerRegistry.createForTerminal('terminal-2', ProviderType.GEMINI, profile);

    const provider = providerRegistry.getTerminalProvider('terminal-2');
    expect(provider).toBeDefined();
    expect(provider?.providerType).toBe(ProviderType.GEMINI);
  });

  it('should switch terminal provider', async () => {
    const claudeProfile: ProviderProfile = {
      id: 'claude',
      name: 'Claude',
      providerType: ProviderType.CLAUDE,
      model: 'claude-sonnet-4-20250514',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const geminiProfile: ProviderProfile = {
      id: 'gemini',
      name: 'Gemini',
      providerType: ProviderType.GEMINI,
      model: 'gemini-2.0-flash',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await providerRegistry.createForTerminal('terminal-3', ProviderType.CLAUDE, claudeProfile);
    await providerRegistry.switchTerminalProvider('terminal-3', ProviderType.GEMINI, geminiProfile);

    const provider = providerRegistry.getTerminalProvider('terminal-3');
    expect(provider?.providerType).toBe(ProviderType.GEMINI);
  });

  it('should dispose terminal provider', async () => {
    const profile: ProviderProfile = {
      id: 'test',
      name: 'Test',
      providerType: ProviderType.OPENAI,
      model: 'gpt-4o',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await providerRegistry.createForTerminal('terminal-4', ProviderType.OPENAI, profile);
    await providerRegistry.disposeTerminal('terminal-4');

    const provider = providerRegistry.getTerminalProvider('terminal-4');
    expect(provider).toBeUndefined();
  });

  it('should get terminal state', async () => {
    const profile: ProviderProfile = {
      id: 'test-state',
      name: 'Test State',
      providerType: ProviderType.CLAUDE,
      model: 'claude-sonnet-4-20250514',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await providerRegistry.createForTerminal('terminal-5', ProviderType.CLAUDE, profile);

    const state = providerRegistry.getTerminalState('terminal-5');
    expect(state).toBeDefined();
    expect(state?.providerType).toBe(ProviderType.CLAUDE);
    expect(state?.profileId).toBe('test-state');
  });
});
