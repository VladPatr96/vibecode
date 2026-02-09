import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { UnifiedProfileManager } from '../unified-profile-manager';
import { createClaudeProfileCompat, toClaudeProfile } from '../claude-profile-compat';
import type { UnifiedProfile } from '../types';
import type { ClaudeProfile, ClaudeProfileSettings, ClaudeAutoSwitchSettings } from '../../../shared/types/agent';

let tempDir: string;

beforeEach(() => {
  tempDir = join(
    tmpdir(),
    `compat-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('toClaudeProfile', () => {
  it('converts UnifiedProfile to ClaudeProfile with Date objects', () => {
    const now = Date.now();
    const lastUsed = now - 60_000;

    const unified: UnifiedProfile = {
      id: 'claude-test-abc123',
      name: 'Test Account',
      providerType: 'claude',
      email: 'test@example.com',
      isDefault: true,
      isAuthenticated: true,
      configDir: '/home/user/.claude',
      description: 'My main account',
      createdAt: now,
      lastUsedAt: lastUsed,
    };

    const claude = toClaudeProfile(unified);

    expect(claude.id).toBe('claude-test-abc123');
    expect(claude.name).toBe('Test Account');
    expect(claude.email).toBe('test@example.com');
    expect(claude.isDefault).toBe(true);
    expect(claude.isAuthenticated).toBe(true);
    expect(claude.configDir).toBe('/home/user/.claude');
    expect(claude.description).toBe('My main account');

    // Dates should be Date objects, not numbers
    expect(claude.createdAt).toBeInstanceOf(Date);
    expect(claude.createdAt.getTime()).toBe(now);
    expect(claude.lastUsedAt).toBeInstanceOf(Date);
    expect(claude.lastUsedAt!.getTime()).toBe(lastUsed);
  });

  it('handles missing optional fields gracefully', () => {
    const unified: UnifiedProfile = {
      id: 'claude-minimal-xyz',
      name: 'Minimal',
      providerType: 'claude',
      isDefault: false,
      isAuthenticated: false,
      createdAt: 1700000000000,
    };

    const claude = toClaudeProfile(unified);

    expect(claude.id).toBe('claude-minimal-xyz');
    expect(claude.name).toBe('Minimal');
    expect(claude.email).toBeUndefined();
    expect(claude.configDir).toBeUndefined();
    expect(claude.description).toBeUndefined();
    expect(claude.lastUsedAt).toBeUndefined();
    expect(claude.isDefault).toBe(false);
    expect(claude.isAuthenticated).toBe(false);
    expect(claude.createdAt).toBeInstanceOf(Date);
    expect(claude.createdAt.getTime()).toBe(1700000000000);
  });

  it('does NOT map usage or rateLimitEvents', () => {
    const unified: UnifiedProfile = {
      id: 'claude-nousage-abc',
      name: 'No Usage',
      providerType: 'claude',
      isDefault: false,
      isAuthenticated: true,
      createdAt: Date.now(),
      metadata: { someExtra: 'data' },
    };

    const claude = toClaudeProfile(unified);

    expect(claude.usage).toBeUndefined();
    expect(claude.rateLimitEvents).toBeUndefined();
  });
});

describe('createClaudeProfileCompat', () => {
  it('getSettings() returns ClaudeProfileSettings shape with correct fields', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    const p1 = await manager.addProfile('claude', {
      name: 'Account A',
      email: 'a@example.com',
      description: 'First account',
    });
    const p2 = await manager.addProfile('claude', {
      name: 'Account B',
      email: 'b@example.com',
    });

    const compat = createClaudeProfileCompat(manager);
    const settings = compat.getSettings();

    // Validate shape
    expect(settings).toHaveProperty('profiles');
    expect(settings).toHaveProperty('activeProfileId');
    expect(settings).toHaveProperty('autoSwitch');

    // Profiles should be ClaudeProfile objects
    expect(settings.profiles).toHaveLength(2);
    expect(settings.profiles[0].id).toBe(p1.id);
    expect(settings.profiles[0].name).toBe('Account A');
    expect(settings.profiles[0].email).toBe('a@example.com');
    expect(settings.profiles[0].createdAt).toBeInstanceOf(Date);
    expect(settings.profiles[1].id).toBe(p2.id);
    expect(settings.profiles[1].name).toBe('Account B');

    // Active profile is the first one added
    expect(settings.activeProfileId).toBe(p1.id);
  });

  it('getActiveProfile() returns ClaudeProfile with Date objects', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    await manager.addProfile('claude', {
      name: 'Active Account',
      email: 'active@example.com',
    });

    const compat = createClaudeProfileCompat(manager);
    const active = compat.getActiveProfile();

    expect(active).toBeDefined();
    expect(active!.name).toBe('Active Account');
    expect(active!.email).toBe('active@example.com');
    expect(active!.createdAt).toBeInstanceOf(Date);
    expect(active!.isDefault).toBe(true);
  });

  it('getActiveProfile() returns undefined when no profiles exist', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    const compat = createClaudeProfileCompat(manager);
    const active = compat.getActiveProfile();

    expect(active).toBeUndefined();
  });

  it('getProfile(id) finds profile by id', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    const p1 = await manager.addProfile('claude', { name: 'First' });
    const p2 = await manager.addProfile('claude', { name: 'Second' });

    const compat = createClaudeProfileCompat(manager);

    const found = compat.getProfile(p2.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(p2.id);
    expect(found!.name).toBe('Second');
    expect(found!.createdAt).toBeInstanceOf(Date);

    // Non-existent ID returns undefined
    const notFound = compat.getProfile('nonexistent-id');
    expect(notFound).toBeUndefined();
  });

  it('setActiveProfile(id) delegates to manager', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    const p1 = await manager.addProfile('claude', { name: 'First' });
    const p2 = await manager.addProfile('claude', { name: 'Second' });

    const compat = createClaudeProfileCompat(manager);

    // Initially first profile is active
    expect(compat.getActiveProfile()!.id).toBe(p1.id);

    // Switch to second
    const result = await compat.setActiveProfile(p2.id);
    expect(result).toBe(true);

    // Verify it changed
    expect(compat.getActiveProfile()!.id).toBe(p2.id);

    // Also verify via the manager directly
    expect(manager.getActiveProfile('claude')!.id).toBe(p2.id);
  });

  it('setActiveProfile(id) returns false for non-existent profile', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    await manager.addProfile('claude', { name: 'Only Account' });

    const compat = createClaudeProfileCompat(manager);
    const result = await compat.setActiveProfile('does-not-exist');
    expect(result).toBe(false);
  });

  it('getAutoSwitchSettings() returns correct shape', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    // Update some settings
    await manager.updateAutoSwitchSettings('claude', {
      enabled: true,
      sessionThreshold: 80,
      autoSwitchOnRateLimit: true,
    });

    const compat = createClaudeProfileCompat(manager);
    const settings = compat.getAutoSwitchSettings();

    // Validate shape matches ClaudeAutoSwitchSettings
    expect(settings.enabled).toBe(true);
    expect(settings.proactiveSwapEnabled).toBe(false); // default
    expect(settings.usageCheckInterval).toBe(30000); // default
    expect(settings.sessionThreshold).toBe(80);
    expect(settings.weeklyThreshold).toBe(99); // default
    expect(settings.autoSwitchOnRateLimit).toBe(true);
  });

  it('updateAutoSwitchSettings() delegates to manager', async () => {
    const manager = new UnifiedProfileManager(tempDir);
    await manager.initialize();

    const compat = createClaudeProfileCompat(manager);

    await compat.updateAutoSwitchSettings({ enabled: true, sessionThreshold: 75 });

    // Verify via manager directly
    const fromManager = manager.getAutoSwitchSettings('claude');
    expect(fromManager.enabled).toBe(true);
    expect(fromManager.sessionThreshold).toBe(75);

    // Verify via compat
    const fromCompat = compat.getAutoSwitchSettings();
    expect(fromCompat.enabled).toBe(true);
    expect(fromCompat.sessionThreshold).toBe(75);
  });

  it('isInitialized() reflects manager state', async () => {
    const manager = new UnifiedProfileManager(tempDir);

    const compat = createClaudeProfileCompat(manager);

    // Before initialization
    expect(compat.isInitialized()).toBe(false);

    await manager.initialize();

    // After initialization
    expect(compat.isInitialized()).toBe(true);
  });
});
