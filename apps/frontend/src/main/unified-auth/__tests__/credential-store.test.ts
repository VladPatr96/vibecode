import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('UnifiedCredentialStore', () => {
  let UnifiedCredentialStore: any;
  let getUnifiedCredentialStore: any;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('../credential-store');
    UnifiedCredentialStore = mod.UnifiedCredentialStore;
    getUnifiedCredentialStore = mod.getUnifiedCredentialStore;
  });

  it('should generate correct keychain service name', () => {
    const store = new UnifiedCredentialStore();
    expect(store.getServiceName('claude', 'abc123')).toBe('Auto-Claude-claude-credentials-abc123');
    expect(store.getServiceName('gemini', 'def456')).toBe('Auto-Claude-gemini-credentials-def456');
    expect(store.getServiceName('codex', 'ghi789')).toBe('Auto-Claude-codex-credentials-ghi789');
  });

  it('should cache and retrieve credentials', () => {
    const store = new UnifiedCredentialStore();
    const creds = { providerType: 'claude' as any, accessToken: 'test-token' };
    store.cacheCredentials('profile-1', creds);
    const retrieved = store.getCachedCredentials('profile-1');
    expect(retrieved?.accessToken).toBe('test-token');
  });

  it('should return null for non-cached profile', () => {
    const store = new UnifiedCredentialStore();
    expect(store.getCachedCredentials('nonexistent')).toBeNull();
  });

  it('should expire cache after TTL', () => {
    vi.useFakeTimers();
    const store = new UnifiedCredentialStore();
    const creds = { providerType: 'claude' as any, accessToken: 'test' };
    store.cacheCredentials('profile-1', creds);

    // Advance past 5 min TTL
    vi.advanceTimersByTime(6 * 60 * 1000);

    expect(store.getCachedCredentials('profile-1')).toBeNull();
    vi.useRealTimers();
  });

  it('should expire error cache faster (10s)', () => {
    vi.useFakeTimers();
    const store = new UnifiedCredentialStore();
    store.cacheError('profile-1', 'claude');

    // Still within 10s
    vi.advanceTimersByTime(5000);
    expect(store.getCachedCredentials('profile-1')).not.toBeNull();

    // Past 10s
    vi.advanceTimersByTime(6000);
    expect(store.getCachedCredentials('profile-1')).toBeNull();
    vi.useRealTimers();
  });

  it('should clear specific profile cache', () => {
    const store = new UnifiedCredentialStore();
    store.cacheCredentials('p1', { providerType: 'claude' as any, accessToken: 't1' });
    store.cacheCredentials('p2', { providerType: 'gemini' as any, accessToken: 't2' });
    store.clearCache('p1');
    expect(store.getCachedCredentials('p1')).toBeNull();
    expect(store.getCachedCredentials('p2')).not.toBeNull();
  });

  it('should clear all cache', () => {
    const store = new UnifiedCredentialStore();
    store.cacheCredentials('p1', { providerType: 'claude' as any, accessToken: 't1' });
    store.cacheCredentials('p2', { providerType: 'gemini' as any, accessToken: 't2' });
    store.clearAll();
    expect(store.getCachedCredentials('p1')).toBeNull();
    expect(store.getCachedCredentials('p2')).toBeNull();
  });

  it('should return singleton via getUnifiedCredentialStore', () => {
    const s1 = getUnifiedCredentialStore();
    const s2 = getUnifiedCredentialStore();
    expect(s1).toBe(s2);
  });
});
