/**
 * ClaudeProfile Backward-Compatible Shim
 *
 * Exposes the same API surface as the legacy ClaudeProfileManager,
 * but delegates to UnifiedProfileManager under the hood.
 *
 * This allows the ~24 existing consumers (IPC handlers, terminal system,
 * agent manager) to continue working without changes during the migration
 * to the unified auth system.
 */

import type { UnifiedProfileManager } from './unified-profile-manager';
import type { UnifiedProfile, AutoSwitchSettings } from './types';
import type {
  ClaudeProfile,
  ClaudeProfileSettings,
  ClaudeAutoSwitchSettings,
} from '../../shared/types/agent';

/**
 * Convert a UnifiedProfile to a ClaudeProfile.
 *
 * Maps id, name, email, configDir, isDefault, isAuthenticated, description.
 * Converts createdAt (number -> Date), lastUsedAt (number -> Date).
 * Does NOT map usage or rateLimitEvents (those are computed dynamically
 * by other modules like usage-monitor and profile-scorer).
 */
export function toClaudeProfile(unified: UnifiedProfile): ClaudeProfile {
  const profile: ClaudeProfile = {
    id: unified.id,
    name: unified.name,
    isDefault: unified.isDefault,
    isAuthenticated: unified.isAuthenticated,
    createdAt: new Date(unified.createdAt),
  };

  if (unified.email !== undefined) {
    profile.email = unified.email;
  }
  if (unified.configDir !== undefined) {
    profile.configDir = unified.configDir;
  }
  if (unified.description !== undefined) {
    profile.description = unified.description;
  }
  if (unified.lastUsedAt !== undefined) {
    profile.lastUsedAt = new Date(unified.lastUsedAt);
  }

  return profile;
}

/**
 * The shape returned by createClaudeProfileCompat.
 * Mirrors the most important methods from the legacy ClaudeProfileManager.
 */
export interface ClaudeProfileCompat {
  getSettings(): ClaudeProfileSettings;
  getActiveProfile(): ClaudeProfile | undefined;
  getProfile(profileId: string): ClaudeProfile | undefined;
  setActiveProfile(profileId: string): Promise<boolean>;
  getAutoSwitchSettings(): ClaudeAutoSwitchSettings;
  updateAutoSwitchSettings(settings: Partial<ClaudeAutoSwitchSettings>): Promise<void>;
  isInitialized(): boolean;
}

/**
 * Create a backward-compatible shim that exposes the ClaudeProfileManager
 * API surface, but delegates to a UnifiedProfileManager instance.
 *
 * All operations are scoped to the 'claude' provider type.
 */
export function createClaudeProfileCompat(mgr: UnifiedProfileManager): ClaudeProfileCompat {
  const PROVIDER: 'claude' = 'claude';

  return {
    /**
     * Get all Claude profile settings in the legacy ClaudeProfileSettings shape.
     */
    getSettings(): ClaudeProfileSettings {
      const profiles = mgr.getProfiles(PROVIDER).map(toClaudeProfile);
      const active = mgr.getActiveProfile(PROVIDER);
      const autoSwitch = mgr.getAutoSwitchSettings(PROVIDER);

      return {
        profiles,
        activeProfileId: active?.id ?? '',
        autoSwitch: toClaudeAutoSwitchSettings(autoSwitch),
      };
    },

    /**
     * Get the currently active Claude profile as a ClaudeProfile.
     */
    getActiveProfile(): ClaudeProfile | undefined {
      const unified = mgr.getActiveProfile(PROVIDER);
      return unified ? toClaudeProfile(unified) : undefined;
    },

    /**
     * Find a Claude profile by its ID.
     */
    getProfile(profileId: string): ClaudeProfile | undefined {
      const unified = mgr.getProfile(PROVIDER, profileId);
      return unified ? toClaudeProfile(unified) : undefined;
    },

    /**
     * Set the active Claude profile by ID.
     * Returns true if successful, false if the profile was not found.
     */
    async setActiveProfile(profileId: string): Promise<boolean> {
      try {
        await mgr.setActiveProfile(PROVIDER, profileId);
        return true;
      } catch {
        // Profile not found or other error
        return false;
      }
    },

    /**
     * Get auto-switch settings in the legacy ClaudeAutoSwitchSettings shape.
     */
    getAutoSwitchSettings(): ClaudeAutoSwitchSettings {
      const settings = mgr.getAutoSwitchSettings(PROVIDER);
      return toClaudeAutoSwitchSettings(settings);
    },

    /**
     * Update auto-switch settings. Merges partial updates.
     */
    async updateAutoSwitchSettings(
      settings: Partial<ClaudeAutoSwitchSettings>
    ): Promise<void> {
      await mgr.updateAutoSwitchSettings(PROVIDER, settings);
    },

    /**
     * Whether the underlying manager has been initialized.
     */
    isInitialized(): boolean {
      return mgr.isInitialized();
    },
  };
}

/**
 * Convert unified AutoSwitchSettings to legacy ClaudeAutoSwitchSettings.
 * The shapes are identical, but this function provides explicit mapping
 * to ensure type compatibility.
 */
function toClaudeAutoSwitchSettings(settings: AutoSwitchSettings): ClaudeAutoSwitchSettings {
  return {
    enabled: settings.enabled,
    proactiveSwapEnabled: settings.proactiveSwapEnabled,
    usageCheckInterval: settings.usageCheckInterval,
    sessionThreshold: settings.sessionThreshold,
    weeklyThreshold: settings.weeklyThreshold,
    autoSwitchOnRateLimit: settings.autoSwitchOnRateLimit,
  };
}
