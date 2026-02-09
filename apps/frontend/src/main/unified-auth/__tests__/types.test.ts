import { describe, it, expect } from 'vitest';

describe('Unified Auth Types', () => {
  it('should export UNIFIED_STORE_VERSION as 4', async () => {
    const { UNIFIED_STORE_VERSION } = await import('../types');
    expect(UNIFIED_STORE_VERSION).toBe(4);
  });

  it('should export DEFAULT_AUTO_SWITCH_SETTINGS', async () => {
    const { DEFAULT_AUTO_SWITCH_SETTINGS } = await import('../types');
    expect(DEFAULT_AUTO_SWITCH_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_AUTO_SWITCH_SETTINGS.sessionThreshold).toBe(95);
    expect(DEFAULT_AUTO_SWITCH_SETTINGS.weeklyThreshold).toBe(99);
  });

  it('should generate correct keychain service name', async () => {
    const { getUnifiedKeychainServiceName } = await import('../types');
    expect(getUnifiedKeychainServiceName('claude', 'abc123')).toBe('Auto-Claude-claude-credentials-abc123');
    expect(getUnifiedKeychainServiceName('gemini', 'def456')).toBe('Auto-Claude-gemini-credentials-def456');
    expect(getUnifiedKeychainServiceName('codex', 'ghi789')).toBe('Auto-Claude-codex-credentials-ghi789');
  });

  it('UnifiedProfile should have required fields', () => {
    const profile: import('../types').UnifiedProfile = {
      id: 'test',
      name: 'Test',
      providerType: 'claude',
      isDefault: false,
      isAuthenticated: false,
      createdAt: Date.now(),
    };
    expect(profile.providerType).toBe('claude');
    expect(profile.isAuthenticated).toBe(false);
  });
});
