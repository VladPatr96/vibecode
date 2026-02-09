import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  createDefaultUnifiedStore,
  migrateV3ToV4,
  loadUnifiedStore,
  saveUnifiedStore,
} from '../profile-store';
import { UNIFIED_STORE_VERSION, DEFAULT_AUTO_SWITCH_SETTINGS } from '../types';
import type { UnifiedProfileStoreData } from '../types';

// Helper to create a unique temp dir per test
let tempDir: string;
beforeEach(() => {
  tempDir = join(tmpdir(), `profile-store-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors on Windows
  }
});

describe('createDefaultUnifiedStore', () => {
  it('returns v4 store with all 5 providers empty', () => {
    const store = createDefaultUnifiedStore();
    expect(store.version).toBe(UNIFIED_STORE_VERSION);
    expect(store.version).toBe(4);

    const providerTypes = ['claude', 'gemini', 'openai', 'codex', 'opencode'] as const;
    for (const pt of providerTypes) {
      expect(store.providers[pt]).toBeDefined();
      expect(store.providers[pt].profiles).toEqual([]);
      expect(store.providers[pt].activeProfileId).toBeNull();
      expect(store.providers[pt].autoSwitch).toEqual(DEFAULT_AUTO_SWITCH_SETTINGS);
    }

    expect(store.globalSettings.crossProviderFallback).toBe(false);
    expect(store.migratedProfileIds).toBeUndefined();
  });
});

describe('migrateV3ToV4', () => {
  it('converts v3 profiles to unified profiles with correct providerType', () => {
    const v3Data = {
      version: 3,
      profiles: [
        {
          id: 'p1',
          name: 'Work Account',
          email: 'work@example.com',
          configDir: '/home/user/.claude-profiles/work',
          isDefault: true,
          description: 'Work profile',
          createdAt: '2025-06-15T10:00:00.000Z',
          lastUsedAt: '2025-07-01T12:30:00.000Z',
        },
        {
          id: 'p2',
          name: 'Personal',
          isDefault: false,
          createdAt: '2025-08-01T08:00:00.000Z',
        },
      ],
      activeProfileId: 'p1',
      autoSwitch: {
        enabled: true,
        proactiveSwapEnabled: false,
        usageCheckInterval: 30000,
        sessionThreshold: 90,
        weeklyThreshold: 95,
        autoSwitchOnRateLimit: true,
      },
      migratedProfileIds: ['p1'],
    };

    const v4 = migrateV3ToV4(v3Data);

    // All profiles should be under 'claude' provider
    const claude = v4.providers.claude;
    expect(claude.profiles).toHaveLength(2);

    // Check first profile
    const up1 = claude.profiles[0];
    expect(up1.id).toBe('p1');
    expect(up1.name).toBe('Work Account');
    expect(up1.providerType).toBe('claude');
    expect(up1.email).toBe('work@example.com');
    expect(up1.isDefault).toBe(true);
    expect(up1.isAuthenticated).toBe(false); // Default after migration
    expect(up1.configDir).toBe('/home/user/.claude-profiles/work');
    expect(up1.description).toBe('Work profile');
    expect(typeof up1.createdAt).toBe('number');
    expect(up1.createdAt).toBe(new Date('2025-06-15T10:00:00.000Z').getTime());
    expect(typeof up1.lastUsedAt).toBe('number');
    expect(up1.lastUsedAt).toBe(new Date('2025-07-01T12:30:00.000Z').getTime());

    // Check second profile
    const up2 = claude.profiles[1];
    expect(up2.id).toBe('p2');
    expect(up2.name).toBe('Personal');
    expect(up2.providerType).toBe('claude');
    expect(up2.isDefault).toBe(false);
    expect(up2.lastUsedAt).toBeUndefined();

    // Active profile
    expect(claude.activeProfileId).toBe('p1');

    // Version
    expect(v4.version).toBe(4);

    // Other providers should be empty
    expect(v4.providers.gemini.profiles).toEqual([]);
    expect(v4.providers.openai.profiles).toEqual([]);
    expect(v4.providers.codex.profiles).toEqual([]);
    expect(v4.providers.opencode.profiles).toEqual([]);

    // migratedProfileIds preserved
    expect(v4.migratedProfileIds).toEqual(['p1']);
  });

  it('preserves autoSwitch settings', () => {
    const v3Data = {
      version: 3,
      profiles: [],
      activeProfileId: '',
      autoSwitch: {
        enabled: true,
        proactiveSwapEnabled: true,
        usageCheckInterval: 60000,
        sessionThreshold: 80,
        weeklyThreshold: 90,
        autoSwitchOnRateLimit: true,
      },
    };

    const v4 = migrateV3ToV4(v3Data);
    const claude = v4.providers.claude;
    expect(claude.autoSwitch.enabled).toBe(true);
    expect(claude.autoSwitch.proactiveSwapEnabled).toBe(true);
    expect(claude.autoSwitch.usageCheckInterval).toBe(60000);
    expect(claude.autoSwitch.sessionThreshold).toBe(80);
    expect(claude.autoSwitch.weeklyThreshold).toBe(90);
    expect(claude.autoSwitch.autoSwitchOnRateLimit).toBe(true);
  });

  it('handles Date objects and string dates', () => {
    const v3Data = {
      version: 3,
      profiles: [
        {
          id: 'date-obj',
          name: 'Date Object Profile',
          isDefault: false,
          createdAt: new Date('2025-03-01T00:00:00Z'),
          lastUsedAt: new Date('2025-03-15T12:00:00Z'),
        },
        {
          id: 'date-str',
          name: 'Date String Profile',
          isDefault: false,
          createdAt: '2025-04-01T00:00:00Z',
          lastUsedAt: '2025-04-15T12:00:00Z',
        },
        {
          id: 'date-num',
          name: 'Date Number Profile',
          isDefault: false,
          createdAt: 1700000000000,
        },
      ],
      activeProfileId: '',
    };

    const v4 = migrateV3ToV4(v3Data);
    const profiles = v4.providers.claude.profiles;

    // Date object
    expect(profiles[0].createdAt).toBe(new Date('2025-03-01T00:00:00Z').getTime());
    expect(profiles[0].lastUsedAt).toBe(new Date('2025-03-15T12:00:00Z').getTime());

    // String date
    expect(profiles[1].createdAt).toBe(new Date('2025-04-01T00:00:00Z').getTime());
    expect(profiles[1].lastUsedAt).toBe(new Date('2025-04-15T12:00:00Z').getTime());

    // Number timestamp (already a number)
    expect(profiles[2].createdAt).toBe(1700000000000);
    expect(profiles[2].lastUsedAt).toBeUndefined();
  });

  it('does NOT copy oauthToken from v3 profiles', () => {
    const v3Data = {
      version: 3,
      profiles: [
        {
          id: 'with-token',
          name: 'Has Token',
          isDefault: true,
          createdAt: '2025-01-01T00:00:00Z',
          oauthToken: 'sk-ant-oat01-secret-token',
          tokenCreatedAt: '2025-01-01T00:00:00Z',
        },
      ],
      activeProfileId: 'with-token',
    };

    const v4 = migrateV3ToV4(v3Data);
    const profile = v4.providers.claude.profiles[0];

    // oauthToken should NOT exist on the unified profile
    expect((profile as any).oauthToken).toBeUndefined();
    expect((profile as any).tokenCreatedAt).toBeUndefined();
  });
});

describe('loadUnifiedStore', () => {
  it('creates default when file not found', async () => {
    const storePath = join(tempDir, 'nonexistent.json');
    const store = await loadUnifiedStore(storePath);

    expect(store.version).toBe(4);
    expect(store.providers.claude.profiles).toEqual([]);
    expect(store.providers.gemini.profiles).toEqual([]);
  });

  it('migrates v3 file on disk', async () => {
    const storePath = join(tempDir, 'profiles.json');
    const v3Data = {
      version: 3,
      profiles: [
        {
          id: 'disk-p1',
          name: 'Disk Profile',
          isDefault: true,
          createdAt: '2025-05-01T00:00:00Z',
          email: 'user@test.com',
        },
      ],
      activeProfileId: 'disk-p1',
      autoSwitch: {
        enabled: false,
        proactiveSwapEnabled: false,
        usageCheckInterval: 30000,
        sessionThreshold: 95,
        weeklyThreshold: 99,
        autoSwitchOnRateLimit: false,
      },
    };

    writeFileSync(storePath, JSON.stringify(v3Data, null, 2), 'utf-8');

    const store = await loadUnifiedStore(storePath);

    // Should have been migrated
    expect(store.version).toBe(4);
    expect(store.providers.claude.profiles).toHaveLength(1);
    expect(store.providers.claude.profiles[0].providerType).toBe('claude');
    expect(store.providers.claude.profiles[0].name).toBe('Disk Profile');
    expect(store.providers.claude.activeProfileId).toBe('disk-p1');

    // Should have saved the migrated version to disk
    const savedContent = readFileSync(storePath, 'utf-8');
    const savedData = JSON.parse(savedContent);
    expect(savedData.version).toBe(4);
  });

  it('loads existing v4 file as-is', async () => {
    const storePath = join(tempDir, 'v4-profiles.json');
    const v4Data: UnifiedProfileStoreData = {
      version: 4 as typeof UNIFIED_STORE_VERSION,
      providers: {
        claude: {
          profiles: [
            {
              id: 'c1',
              name: 'Claude Profile',
              providerType: 'claude',
              isDefault: true,
              isAuthenticated: true,
              createdAt: 1700000000000,
            },
          ],
          activeProfileId: 'c1',
          autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS },
        },
        gemini: { profiles: [], activeProfileId: null, autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS } },
        openai: { profiles: [], activeProfileId: null, autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS } },
        codex: { profiles: [], activeProfileId: null, autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS } },
        opencode: { profiles: [], activeProfileId: null, autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS } },
      },
      globalSettings: { crossProviderFallback: false },
    };

    writeFileSync(storePath, JSON.stringify(v4Data, null, 2), 'utf-8');

    const store = await loadUnifiedStore(storePath);
    expect(store.version).toBe(4);
    expect(store.providers.claude.profiles).toHaveLength(1);
    expect(store.providers.claude.profiles[0].id).toBe('c1');
    expect(store.providers.claude.profiles[0].isAuthenticated).toBe(true);
  });

  it('ensures all provider types exist when loading v4 with missing providers', async () => {
    const storePath = join(tempDir, 'partial-v4.json');
    // v4 file but missing some providers
    const partialV4 = {
      version: 4,
      providers: {
        claude: {
          profiles: [],
          activeProfileId: null,
          autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS },
        },
        // gemini, openai, codex, opencode missing
      },
      globalSettings: { crossProviderFallback: false },
    };

    writeFileSync(storePath, JSON.stringify(partialV4, null, 2), 'utf-8');

    const store = await loadUnifiedStore(storePath);
    expect(store.version).toBe(4);
    // All providers should exist
    expect(store.providers.claude).toBeDefined();
    expect(store.providers.gemini).toBeDefined();
    expect(store.providers.openai).toBeDefined();
    expect(store.providers.codex).toBeDefined();
    expect(store.providers.opencode).toBeDefined();
  });
});

describe('saveUnifiedStore + loadUnifiedStore round-trip', () => {
  it('round-trips correctly', async () => {
    const storePath = join(tempDir, 'roundtrip.json');
    const store = createDefaultUnifiedStore();

    // Add a profile
    store.providers.claude.profiles.push({
      id: 'rt-1',
      name: 'Round Trip',
      providerType: 'claude',
      isDefault: true,
      isAuthenticated: true,
      createdAt: 1700000000000,
      lastUsedAt: 1700001000000,
      email: 'rt@test.com',
      description: 'A test profile',
    });
    store.providers.claude.activeProfileId = 'rt-1';

    await saveUnifiedStore(storePath, store);
    const loaded = await loadUnifiedStore(storePath);

    expect(loaded.version).toBe(store.version);
    expect(loaded.providers.claude.profiles).toHaveLength(1);
    expect(loaded.providers.claude.profiles[0].id).toBe('rt-1');
    expect(loaded.providers.claude.profiles[0].name).toBe('Round Trip');
    expect(loaded.providers.claude.profiles[0].providerType).toBe('claude');
    expect(loaded.providers.claude.profiles[0].createdAt).toBe(1700000000000);
    expect(loaded.providers.claude.profiles[0].lastUsedAt).toBe(1700001000000);
    expect(loaded.providers.claude.activeProfileId).toBe('rt-1');
    expect(loaded.globalSettings.crossProviderFallback).toBe(false);
  });
});
