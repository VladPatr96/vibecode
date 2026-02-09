/**
 * Unified Profile Store (v4)
 * Persistence layer for multi-provider profile management.
 * Handles v3 → v4 migration from the legacy Claude-only format.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { ProviderType } from '../../shared/types/provider';
import {
  UNIFIED_STORE_VERSION,
  DEFAULT_AUTO_SWITCH_SETTINGS,
  type UnifiedProfile,
  type UnifiedProfileStoreData,
  type ProviderProfileData,
  type AutoSwitchSettings,
} from './types';

/**
 * All provider types supported by the unified store.
 */
const ALL_PROVIDER_TYPES: ProviderType[] = ['claude', 'gemini', 'openai', 'codex', 'opencode'];

/**
 * Create an empty ProviderProfileData entry.
 */
function createEmptyProviderData(): ProviderProfileData {
  return {
    profiles: [],
    activeProfileId: null,
    autoSwitch: { ...DEFAULT_AUTO_SWITCH_SETTINGS },
  };
}

/**
 * Create a default (empty) v4 unified store with entries for all provider types.
 */
export function createDefaultUnifiedStore(): UnifiedProfileStoreData {
  const providers = {} as Record<ProviderType, ProviderProfileData>;
  for (const pt of ALL_PROVIDER_TYPES) {
    providers[pt] = createEmptyProviderData();
  }

  return {
    version: UNIFIED_STORE_VERSION,
    providers,
    globalSettings: {
      crossProviderFallback: false,
    },
  };
}

/**
 * Convert a date value (Date object, string, or number) to a Unix timestamp in milliseconds.
 */
function toTimestamp(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'string') {
    return new Date(value).getTime();
  }
  return Date.now();
}

/**
 * V3 profile shape (subset of fields we read during migration).
 * This is intentionally loose to handle real-world v3 data.
 */
interface V3Profile {
  id: string;
  name: string;
  email?: string;
  oauthToken?: string;
  tokenCreatedAt?: unknown;
  configDir?: string;
  isDefault: boolean;
  description?: string;
  createdAt: unknown; // string | Date | number
  lastUsedAt?: unknown;
  usage?: unknown;
  rateLimitEvents?: unknown[];
  [key: string]: unknown;
}

/**
 * V3 store shape (ProfileStoreData from profile-storage.ts).
 */
interface V3StoreData {
  version: number;
  profiles: V3Profile[];
  activeProfileId: string;
  autoSwitch?: {
    enabled: boolean;
    proactiveSwapEnabled: boolean;
    usageCheckInterval: number;
    sessionThreshold: number;
    weeklyThreshold: number;
    autoSwitchOnRateLimit: boolean;
  };
  accountPriorityOrder?: string[];
  migratedProfileIds?: string[];
}

/**
 * Migrate a v3 (Claude-only) store to v4 unified format.
 *
 * - All v3 profiles become `providerType: 'claude'` in the unified store.
 * - Dates are converted from Date/string to numeric timestamps.
 * - OAuth tokens are NOT copied (they stay in OS Keychain).
 * - autoSwitch settings are preserved on the claude provider entry.
 * - migratedProfileIds are preserved at the top level.
 */
export function migrateV3ToV4(v3Data: V3StoreData): UnifiedProfileStoreData {
  const store = createDefaultUnifiedStore();

  // Convert v3 profiles to unified profiles
  const unifiedProfiles: UnifiedProfile[] = v3Data.profiles.map((p) => {
    const profile: UnifiedProfile = {
      id: p.id,
      name: p.name,
      providerType: 'claude',
      isDefault: p.isDefault,
      isAuthenticated: false, // Needs re-auth after migration; tokens stay in keychain
      createdAt: toTimestamp(p.createdAt),
    };

    if (p.email) {
      profile.email = p.email;
    }
    if (p.configDir) {
      profile.configDir = p.configDir;
    }
    if (p.description) {
      profile.description = p.description;
    }
    if (p.lastUsedAt !== undefined && p.lastUsedAt !== null) {
      profile.lastUsedAt = toTimestamp(p.lastUsedAt);
    }

    return profile;
  });

  // Populate claude provider data
  store.providers.claude.profiles = unifiedProfiles;
  store.providers.claude.activeProfileId = v3Data.activeProfileId || null;

  // Preserve autoSwitch settings
  if (v3Data.autoSwitch) {
    store.providers.claude.autoSwitch = {
      enabled: v3Data.autoSwitch.enabled,
      proactiveSwapEnabled: v3Data.autoSwitch.proactiveSwapEnabled,
      usageCheckInterval: v3Data.autoSwitch.usageCheckInterval,
      sessionThreshold: v3Data.autoSwitch.sessionThreshold,
      weeklyThreshold: v3Data.autoSwitch.weeklyThreshold,
      autoSwitchOnRateLimit: v3Data.autoSwitch.autoSwitchOnRateLimit,
    };
  }

  // Preserve account priority order
  if (v3Data.accountPriorityOrder) {
    store.providers.claude.accountPriorityOrder = v3Data.accountPriorityOrder;
  }

  // Preserve migrated profile IDs
  if (v3Data.migratedProfileIds && v3Data.migratedProfileIds.length > 0) {
    store.migratedProfileIds = [...v3Data.migratedProfileIds];
  }

  return store;
}

/**
 * Ensure all provider types exist in a v4 store.
 * Fills in missing providers with empty defaults.
 */
function ensureAllProviders(store: UnifiedProfileStoreData): UnifiedProfileStoreData {
  for (const pt of ALL_PROVIDER_TYPES) {
    if (!store.providers[pt]) {
      store.providers[pt] = createEmptyProviderData();
    }
  }
  return store;
}

/**
 * Load the unified profile store from disk.
 *
 * - If the file does not exist, returns a default empty v4 store.
 * - If the file contains v4 data, returns it (ensuring all providers exist).
 * - If the file contains v3/v1 data, migrates to v4, saves the migrated version, and returns it.
 */
export async function loadUnifiedStore(storePath: string): Promise<UnifiedProfileStoreData> {
  try {
    const content = await readFile(storePath, 'utf-8');
    const data = JSON.parse(content);

    if (data.version === UNIFIED_STORE_VERSION) {
      // Already v4 — ensure all providers exist and return
      return ensureAllProviders(data as UnifiedProfileStoreData);
    }

    // v3 or v1 — migrate to v4
    const migrated = migrateV3ToV4(data as V3StoreData);
    // Save the migrated store back to disk
    await saveUnifiedStore(storePath, migrated);
    return migrated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createDefaultUnifiedStore();
    }
    console.error('[UnifiedProfileStore] Error loading store:', error);
    return createDefaultUnifiedStore();
  }
}

/**
 * Save the unified profile store to disk.
 * Creates the parent directory if it does not exist.
 */
export async function saveUnifiedStore(
  storePath: string,
  data: UnifiedProfileStoreData
): Promise<void> {
  try {
    const dir = dirname(storePath);
    await mkdir(dir, { recursive: true });
    await writeFile(storePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[UnifiedProfileStore] Error saving store:', error);
  }
}
