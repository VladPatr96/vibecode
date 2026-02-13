import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { UnifiedProfileManager } from '../unified-profile-manager';
import { DEFAULT_AUTO_SWITCH_SETTINGS } from '../types';
import type { IProviderAuthAdapter, UsageSnapshot } from '../types';
import type { ProviderType } from '../../../shared/types/provider';
import type { ProviderCredentials } from '../../providers/types';

/**
 * Minimal mock adapter for testing. Satisfies IProviderAuthAdapter
 * without any real credential I/O.
 */
function createMockAdapter(providerType: ProviderType): IProviderAuthAdapter {
  return {
    providerType,
    getNativeCredentialPaths: () => [],
    readNativeCredentials: async () => null,
    getAuthCommandLine: () => `${providerType} login`,
    getAuthSuccessPatterns: () => [/success/i],
    getAuthFailurePatterns: () => [/fail/i],
    refreshToken: async (creds: ProviderCredentials) => creds,
    validateToken: async () => true,
    revokeToken: async () => {},
    getEnvironmentForCLI: () => ({}),
    fetchUsage: async () => null,
  };
}

let tempDir: string;

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `upm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on Windows
  }
});

describe('UnifiedProfileManager', () => {
  it('initializes with empty providers', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    expect(manager.isInitialized()).toBe(true);

    // All provider types should exist but have zero profiles
    for (const pt of ['claude', 'gemini', 'openai', 'codex', 'opencode'] as ProviderType[]) {
      const profiles = manager.getProfiles(pt);
      expect(profiles).toEqual([]);
    }
  });

  it('adds and retrieves a profile', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('gemini'));
    await manager.initialize();

    const profile = await manager.addProfile('gemini', {
      name: 'My Gemini',
      email: 'user@example.com',
    });

    expect(profile.name).toBe('My Gemini');
    expect(profile.providerType).toBe('gemini');
    expect(profile.email).toBe('user@example.com');
    expect(profile.isDefault).toBe(true); // first profile becomes default
    expect(profile.isAuthenticated).toBe(false);
    expect(typeof profile.createdAt).toBe('number');

    // Retrieve by ID
    const fetched = manager.getProfile('gemini', profile.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(profile.id);

    // Retrieve all
    const all = manager.getProfiles('gemini');
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(profile.id);
  });

  it('sets and gets active profile per provider', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('claude'));
    await manager.initialize();

    const p1 = await manager.addProfile('claude', { name: 'Account A' });
    const p2 = await manager.addProfile('claude', { name: 'Account B' });

    // First profile becomes active by default
    expect(manager.getActiveProfile('claude')!.id).toBe(p1.id);

    // Switch active
    await manager.setActiveProfile('claude', p2.id);
    expect(manager.getActiveProfile('claude')!.id).toBe(p2.id);
  });

  it('deletes a non-default profile', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('openai'));
    await manager.initialize();

    const p1 = await manager.addProfile('openai', { name: 'Primary' });
    const p2 = await manager.addProfile('openai', { name: 'Secondary' });

    expect(manager.getProfiles('openai')).toHaveLength(2);

    await manager.deleteProfile('openai', p2.id);

    expect(manager.getProfiles('openai')).toHaveLength(1);
    expect(manager.getProfile('openai', p2.id)).toBeUndefined();
    // First profile still exists
    expect(manager.getProfile('openai', p1.id)).toBeDefined();
  });

  it('cannot delete the only profile for a provider', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('claude'));
    await manager.initialize();

    const p1 = await manager.addProfile('claude', { name: 'Only Account' });

    await expect(manager.deleteProfile('claude', p1.id)).rejects.toThrow(
      /cannot delete.*only/i
    );

    // Profile should still exist
    expect(manager.getProfiles('claude')).toHaveLength(1);
  });

  it('gets adapter for provider type', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    const adapter = createMockAdapter('gemini');
    manager.registerAdapter(adapter);
    await manager.initialize();

    const retrieved = manager.getAdapter('gemini');
    expect(retrieved).toBe(adapter);
    expect(retrieved!.providerType).toBe('gemini');

    expect(manager.getAdapter('codex')).toBeDefined();
    expect(manager.getAdapter('opencode')).toBeDefined();
  });

  it('manages auto-switch settings per provider', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    // Defaults
    const defaults = manager.getAutoSwitchSettings('claude');
    expect(defaults).toEqual(DEFAULT_AUTO_SWITCH_SETTINGS);
    expect(defaults.enabled).toBe(false);

    // Update
    await manager.updateAutoSwitchSettings('claude', {
      enabled: true,
      sessionThreshold: 80,
    });

    const updated = manager.getAutoSwitchSettings('claude');
    expect(updated.enabled).toBe(true);
    expect(updated.sessionThreshold).toBe(80);
    // Other settings remain default
    expect(updated.proactiveSwapEnabled).toBe(false);
    expect(updated.usageCheckInterval).toBe(30000);
  });

  it('multiple providers operate independently', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('claude'));
    manager.registerAdapter(createMockAdapter('gemini'));
    await manager.initialize();

    const claudeProfile = await manager.addProfile('claude', { name: 'Claude Acct' });
    const geminiProfile = await manager.addProfile('gemini', { name: 'Gemini Acct' });

    // Each provider has exactly 1 profile
    expect(manager.getProfiles('claude')).toHaveLength(1);
    expect(manager.getProfiles('gemini')).toHaveLength(1);

    // Profiles are in their respective providers
    expect(manager.getProfile('claude', claudeProfile.id)).toBeDefined();
    expect(manager.getProfile('gemini', claudeProfile.id)).toBeUndefined();
    expect(manager.getProfile('gemini', geminiProfile.id)).toBeDefined();
    expect(manager.getProfile('claude', geminiProfile.id)).toBeUndefined();

    // Active profiles are independent
    expect(manager.getActiveProfile('claude')!.id).toBe(claudeProfile.id);
    expect(manager.getActiveProfile('gemini')!.id).toBe(geminiProfile.id);

    // Auto-switch settings are independent
    await manager.updateAutoSwitchSettings('claude', { enabled: true });
    expect(manager.getAutoSwitchSettings('claude').enabled).toBe(true);
    expect(manager.getAutoSwitchSettings('gemini').enabled).toBe(false);
  });

  it('updates a profile', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('claude'));
    await manager.initialize();

    const profile = await manager.addProfile('claude', { name: 'Original' });

    const updated = await manager.updateProfile('claude', profile.id, {
      name: 'Renamed',
      email: 'new@example.com',
      isAuthenticated: true,
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.email).toBe('new@example.com');
    expect(updated.isAuthenticated).toBe(true);
    // Original fields preserved
    expect(updated.id).toBe(profile.id);
    expect(updated.providerType).toBe('claude');
  });

  it('gets and updates global settings', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    const defaults = manager.getGlobalSettings();
    expect(defaults.crossProviderFallback).toBe(false);

    await manager.updateGlobalSettings({ crossProviderFallback: true });
    const updated = manager.getGlobalSettings();
    expect(updated.crossProviderFallback).toBe(true);
  });

  it('persists data across instances', async () => {
    const manager1 = new UnifiedProfileManager(tempDir);
    manager1.registerAdapter(createMockAdapter('claude'));
    await manager1.initialize();

    const profile = await manager1.addProfile('claude', { name: 'Persistent' });
    await manager1.updateAutoSwitchSettings('claude', { enabled: true });

    // Create a new manager instance pointing to the same directory
    const manager2 = new UnifiedProfileManager(tempDir);
    await manager2.initialize();

    const loadedProfiles = manager2.getProfiles('claude');
    expect(loadedProfiles).toHaveLength(1);
    expect(loadedProfiles[0].id).toBe(profile.id);
    expect(loadedProfiles[0].name).toBe('Persistent');

    const loadedAutoSwitch = manager2.getAutoSwitchSettings('claude');
    expect(loadedAutoSwitch.enabled).toBe(true);
  });

  it('getActiveProfile falls back to first profile when no active is set', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    manager.registerAdapter(createMockAdapter('claude'));
    await manager.initialize();

    // addProfile sets active, but let's verify the fallback logic
    const p1 = await manager.addProfile('claude', { name: 'First' });
    const p2 = await manager.addProfile('claude', { name: 'Second' });

    // Internally force activeProfileId to a non-existent ID to test fallback
    // We do this by deleting the active profile (after adding a third so deletion is allowed)
    const p3 = await manager.addProfile('claude', { name: 'Third' });
    await manager.setActiveProfile('claude', p2.id);
    await manager.deleteProfile('claude', p2.id);

    // After deleting active profile, getActiveProfile should fall back to first available
    const active = manager.getActiveProfile('claude');
    expect(active).toBeDefined();
    expect([p1.id, p3.id]).toContain(active!.id);
  });
});
