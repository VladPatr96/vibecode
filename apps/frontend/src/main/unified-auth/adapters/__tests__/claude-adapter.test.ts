import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { IProviderAuthAdapter } from '../../types';
import { ProviderType } from '../../../../main/providers/types';

// Mock electron
vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/test' },
  safeStorage: { isEncryptionAvailable: () => false },
}));

// Mock credential-utils
vi.mock('../../../claude-profile/credential-utils', () => ({
  getCredentialsFromKeychain: vi.fn().mockReturnValue({
    token: 'sk-ant-test',
    email: 'test@example.com',
  }),
  getFullCredentialsFromKeychain: vi.fn().mockResolvedValue({
    token: 'sk-ant-test',
    email: 'test@example.com',
    refreshToken: 'rt-test',
    expiresAt: Date.now() + 3600000,
    scopes: null,
    subscriptionType: 'max',
    rateLimitTier: null,
  }),
  normalizeWindowsPath: vi.fn((p: string) => p),
}));

// Mock token-refresh
vi.mock('../../../claude-profile/token-refresh', () => ({
  reactiveTokenRefresh: vi.fn().mockResolvedValue({
    token: 'sk-ant-refreshed',
    wasRefreshed: true,
  }),
}));

// Mock platform
vi.mock('../../../platform', () => ({
  isMacOS: vi.fn().mockReturnValue(false),
  isWindows: vi.fn().mockReturnValue(false),
  isLinux: vi.fn().mockReturnValue(true),
}));

describe('ClaudeAuthAdapter', () => {
  let adapter: IProviderAuthAdapter;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../../adapters/claude-adapter');
    adapter = new mod.ClaudeAuthAdapter();
  });

  it('should have providerType "claude"', () => {
    expect(adapter.providerType).toBe('claude');
  });

  it('should return empty native credential paths', () => {
    expect(adapter.getNativeCredentialPaths()).toEqual([]);
  });

  it('should return auth command line', () => {
    expect(adapter.getAuthCommandLine()).toContain('claude');
  });

  it('should have auth success patterns', () => {
    const patterns = adapter.getAuthSuccessPatterns();
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns[0]).toBeInstanceOf(RegExp);
  });

  it('should have auth failure patterns', () => {
    const patterns = adapter.getAuthFailurePatterns();
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('should generate CLI environment with CLAUDE_CONFIG_DIR', () => {
    const env = adapter.getEnvironmentForCLI({
      providerType: ProviderType.CLAUDE,
      configDir: '/home/user/.claude',
    });
    expect(env.CLAUDE_CONFIG_DIR).toBe('/home/user/.claude');
    expect(env.CLAUDE_CODE_ENTRYPOINT).toBe('auto-claude');
  });

  it('should include CLAUDE_CODE_OAUTH_TOKEN when accessToken provided', () => {
    const env = adapter.getEnvironmentForCLI({
      providerType: ProviderType.CLAUDE,
      accessToken: 'sk-ant-test-token',
      configDir: '/home/user/.claude',
    });
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe('sk-ant-test-token');
  });

  it('should not include CLAUDE_CODE_OAUTH_TOKEN when accessToken is absent', () => {
    const env = adapter.getEnvironmentForCLI({
      providerType: ProviderType.CLAUDE,
      configDir: '/home/user/.claude',
    });
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
  });

  it('should validate token based on accessToken presence', async () => {
    expect(
      await adapter.validateToken({ providerType: ProviderType.CLAUDE, accessToken: 'token' }),
    ).toBe(true);
    expect(await adapter.validateToken({ providerType: ProviderType.CLAUDE })).toBe(false);
  });

  it('should read native credentials from keychain', async () => {
    const creds = await adapter.readNativeCredentials();
    expect(creds).not.toBeNull();
    expect(creds?.accessToken).toBe('sk-ant-test');
    expect(creds?.metadata?.email).toBe('test@example.com');
  });

  it('should return null for readNativeCredentials when no token found', async () => {
    // Re-mock to return no token
    const { getFullCredentialsFromKeychain } = await import(
      '../../../claude-profile/credential-utils'
    );
    (getFullCredentialsFromKeychain as Mock).mockResolvedValueOnce({
      token: null,
      email: null,
      refreshToken: null,
      expiresAt: null,
      scopes: null,
      subscriptionType: null,
      rateLimitTier: null,
    });

    const creds = await adapter.readNativeCredentials();
    expect(creds).toBeNull();
  });

  it('should delegate refreshToken to reactiveTokenRefresh', async () => {
    const result = await adapter.refreshToken({
      providerType: ProviderType.CLAUDE,
      accessToken: 'sk-ant-old',
      configDir: '/home/user/.claude',
    });
    expect(result.accessToken).toBe('sk-ant-refreshed');
    expect(result.providerType).toBe('claude');
  });

  it('should not throw on revokeToken (no-op)', async () => {
    await expect(
      adapter.revokeToken({ providerType: ProviderType.CLAUDE, accessToken: 'token' }),
    ).resolves.toBeUndefined();
  });

  it('should return null from fetchUsage', async () => {
    const result = await adapter.fetchUsage?.({ providerType: ProviderType.CLAUDE });
    expect(result).toBeNull();
  });
});
