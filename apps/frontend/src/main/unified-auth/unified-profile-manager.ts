/**
 * Unified Profile Manager
 *
 * Central coordinator for multi-provider profile management.
 * Manages profiles, adapters, auto-switch settings, and persistence
 * for all supported provider types (claude, gemini, openai, codex, opencode).
 */

import { join } from 'path';
import type { ProviderType } from '../../shared/types/provider';
import type {
  IProviderAuthAdapter,
  UnifiedProfile,
  UnifiedProfileStoreData,
  AutoSwitchSettings,
} from './types';
import { DEFAULT_AUTO_SWITCH_SETTINGS } from './types';
import { loadUnifiedStore, saveUnifiedStore, createDefaultUnifiedStore } from './profile-store';
import { ClaudeAuthAdapter } from './adapters/claude-adapter';
import { GeminiAuthAdapter } from './adapters/gemini-adapter';
import { CodexAuthAdapter } from './adapters/codex-adapter';
import { OpencodeAuthAdapter } from './adapters/opencode-adapter';

const STORE_FILENAME = 'unified-profiles.json';

export class UnifiedProfileManager {
  private storePath: string;
  private store: UnifiedProfileStoreData | null = null;
  private adapters = new Map<ProviderType, IProviderAuthAdapter>();
  private initialized = false;

  constructor(configDir: string) {
    this.storePath = join(configDir, STORE_FILENAME);

    // Register the built-in Claude adapter by default
    this.registerAdapter(new ClaudeAuthAdapter());
    this.registerAdapter(new GeminiAuthAdapter());
    this.registerAdapter(new CodexAuthAdapter());
    this.registerAdapter(new OpencodeAuthAdapter());
  }

  /**
   * Register a provider auth adapter.
   */
  registerAdapter(adapter: IProviderAuthAdapter): void {
    this.adapters.set(adapter.providerType, adapter);
  }

  /**
   * Get the adapter for a provider type, or undefined if not registered.
   */
  getAdapter(providerType: ProviderType): IProviderAuthAdapter | undefined {
    return this.adapters.get(providerType);
  }

  /**
   * Initialize the manager by loading (or creating) the profile store from disk.
   */
  async initialize(): Promise<void> {
    this.store = await loadUnifiedStore(this.storePath);
    this.initialized = true;
  }

  /**
   * Whether the manager has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ---------------------------------------------------------------------------
  // Profile CRUD
  // ---------------------------------------------------------------------------

  /**
   * Get all profiles for a provider type.
   */
  getProfiles(providerType: ProviderType): UnifiedProfile[] {
    this.ensureInitialized();
    return [...(this.store!.providers[providerType]?.profiles ?? [])];
  }

  /**
   * Get a single profile by provider type and profile ID.
   */
  getProfile(providerType: ProviderType, profileId: string): UnifiedProfile | undefined {
    this.ensureInitialized();
    return this.store!.providers[providerType]?.profiles.find((p) => p.id === profileId);
  }

  /**
   * Get the active profile for a provider type.
   * Falls back to the first profile if the active ID is not found.
   * Returns undefined if no profiles exist for the provider.
   */
  getActiveProfile(providerType: ProviderType): UnifiedProfile | undefined {
    this.ensureInitialized();
    const providerData = this.store!.providers[providerType];
    if (!providerData || providerData.profiles.length === 0) {
      return undefined;
    }

    // Try to find the explicitly set active profile
    if (providerData.activeProfileId) {
      const active = providerData.profiles.find((p) => p.id === providerData.activeProfileId);
      if (active) {
        return active;
      }
    }

    // Fallback to first profile
    return providerData.profiles[0];
  }

  /**
   * Add a new profile for a provider.
   *
   * Options:
   * - name (required) — display name
   * - email — optional email
   * - configDir — optional CLI config directory
   * - description — optional description
   * - metadata — optional metadata
   *
   * The first profile added for a provider becomes the default and active profile.
   */
  async addProfile(
    providerType: ProviderType,
    opts: {
      name: string;
      email?: string;
      configDir?: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<UnifiedProfile> {
    this.ensureInitialized();

    const providerData = this.store!.providers[providerType];
    const isFirst = providerData.profiles.length === 0;

    const profile: UnifiedProfile = {
      id: this.generateId(providerType, opts.name),
      name: opts.name,
      providerType,
      isDefault: isFirst,
      isAuthenticated: false,
      createdAt: Date.now(),
    };

    if (opts.email) {
      profile.email = opts.email;
    }
    if (opts.configDir) {
      profile.configDir = opts.configDir;
    }
    if (opts.description) {
      profile.description = opts.description;
    }
    if (opts.metadata) {
      profile.metadata = opts.metadata;
    }

    providerData.profiles.push(profile);

    // First profile becomes active
    if (isFirst) {
      providerData.activeProfileId = profile.id;
    }

    await this.save();
    return profile;
  }

  /**
   * Update an existing profile's fields.
   * Returns the updated profile. Throws if profile is not found.
   */
  async updateProfile(
    providerType: ProviderType,
    profileId: string,
    updates: Partial<
      Pick<UnifiedProfile, 'name' | 'email' | 'description' | 'isAuthenticated' | 'configDir' | 'lastUsedAt' | 'metadata'>
    >
  ): Promise<UnifiedProfile> {
    this.ensureInitialized();

    const providerData = this.store!.providers[providerType];
    const index = providerData.profiles.findIndex((p) => p.id === profileId);
    if (index === -1) {
      throw new Error(`Profile "${profileId}" not found for provider "${providerType}"`);
    }

    const profile = providerData.profiles[index];
    Object.assign(profile, updates);
    providerData.profiles[index] = profile;

    await this.save();
    return profile;
  }

  /**
   * Delete a profile. Cannot delete the only profile for a provider.
   * If the deleted profile was active, the first remaining profile becomes active.
   */
  async deleteProfile(providerType: ProviderType, profileId: string): Promise<void> {
    this.ensureInitialized();

    const providerData = this.store!.providers[providerType];
    const index = providerData.profiles.findIndex((p) => p.id === profileId);

    if (index === -1) {
      throw new Error(`Profile "${profileId}" not found for provider "${providerType}"`);
    }

    if (providerData.profiles.length <= 1) {
      throw new Error(
        `Cannot delete the only profile for provider "${providerType}". ` +
          'At least one profile must exist.'
      );
    }

    providerData.profiles.splice(index, 1);

    // If the deleted profile was the active one, reset to first available
    if (providerData.activeProfileId === profileId) {
      providerData.activeProfileId = providerData.profiles[0]?.id ?? null;
    }

    await this.save();
  }

  /**
   * Set the active profile for a provider type.
   * Throws if the profile does not exist.
   */
  async setActiveProfile(providerType: ProviderType, profileId: string): Promise<void> {
    this.ensureInitialized();

    const providerData = this.store!.providers[providerType];
    const exists = providerData.profiles.some((p) => p.id === profileId);

    if (!exists) {
      throw new Error(`Profile "${profileId}" not found for provider "${providerType}"`);
    }

    providerData.activeProfileId = profileId;
    await this.save();
  }

  // ---------------------------------------------------------------------------
  // Auto-switch settings
  // ---------------------------------------------------------------------------

  /**
   * Get auto-switch settings for a provider type.
   */
  getAutoSwitchSettings(providerType: ProviderType): AutoSwitchSettings {
    this.ensureInitialized();
    return {
      ...(this.store!.providers[providerType]?.autoSwitch ?? DEFAULT_AUTO_SWITCH_SETTINGS),
    };
  }

  /**
   * Update auto-switch settings for a provider type (partial merge).
   */
  async updateAutoSwitchSettings(
    providerType: ProviderType,
    settings: Partial<AutoSwitchSettings>
  ): Promise<void> {
    this.ensureInitialized();

    const providerData = this.store!.providers[providerType];
    providerData.autoSwitch = {
      ...providerData.autoSwitch,
      ...settings,
    };

    await this.save();
  }

  // ---------------------------------------------------------------------------
  // Global settings
  // ---------------------------------------------------------------------------

  /**
   * Get cross-provider global settings.
   */
  getGlobalSettings(): UnifiedProfileStoreData['globalSettings'] {
    this.ensureInitialized();
    return { ...this.store!.globalSettings };
  }

  /**
   * Update cross-provider global settings (partial merge).
   */
  async updateGlobalSettings(
    settings: Partial<UnifiedProfileStoreData['globalSettings']>
  ): Promise<void> {
    this.ensureInitialized();

    this.store!.globalSettings = {
      ...this.store!.globalSettings,
      ...settings,
    };

    await this.save();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Generate a unique profile ID from provider type and name.
   * Format: {providerType}-{slugified-name}-{short-random}
   */
  private generateId(providerType: ProviderType, name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
    const rand = Math.random().toString(36).slice(2, 8);
    return `${providerType}-${slug}-${rand}`;
  }

  /**
   * Persist the current store to disk.
   */
  private async save(): Promise<void> {
    if (this.store) {
      await saveUnifiedStore(this.storePath, this.store);
    }
  }

  /**
   * Throw if the manager has not been initialized.
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.store) {
      throw new Error('UnifiedProfileManager has not been initialized. Call initialize() first.');
    }
  }
}
