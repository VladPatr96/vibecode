/**
 * Unified Auth System Types
 * Provider-agnostic authentication types for multi-provider profile management.
 */

import type { ProviderType } from '../../shared/types/provider';
import type { ProviderCredentials } from '../providers/types';

export const UNIFIED_STORE_VERSION = 4;

/**
 * Provider-agnostic profile. Replaces ClaudeProfile for new system.
 * Credentials are stored in OS Keychain, NOT in this object.
 */
export interface UnifiedProfile {
  id: string;
  name: string;
  providerType: ProviderType;
  email?: string;
  isDefault: boolean;
  isAuthenticated: boolean;
  configDir?: string;
  description?: string;
  createdAt: number;
  lastUsedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Auto-switch settings per provider.
 */
export interface AutoSwitchSettings {
  enabled: boolean;
  proactiveSwapEnabled: boolean;
  usageCheckInterval: number;
  sessionThreshold: number;
  weeklyThreshold: number;
  autoSwitchOnRateLimit: boolean;
}

export const DEFAULT_AUTO_SWITCH_SETTINGS: AutoSwitchSettings = {
  enabled: false,
  proactiveSwapEnabled: false,
  usageCheckInterval: 30000,
  sessionThreshold: 95,
  weeklyThreshold: 99,
  autoSwitchOnRateLimit: false,
};

/**
 * Per-provider profile data within the unified store.
 */
export interface ProviderProfileData {
  profiles: UnifiedProfile[];
  activeProfileId: string | null;
  autoSwitch: AutoSwitchSettings;
  accountPriorityOrder?: string[];
}

/**
 * Unified profile store format (v4).
 */
export interface UnifiedProfileStoreData {
  version: typeof UNIFIED_STORE_VERSION;
  providers: Record<ProviderType, ProviderProfileData>;
  globalSettings: {
    crossProviderFallback: boolean;
  };
  migratedProfileIds?: string[];
}

/**
 * Usage snapshot — provider-agnostic.
 */
export interface UsageSnapshot {
  profileId: string;
  providerType: ProviderType;
  sessionPercent?: number;
  weeklyPercent?: number;
  requestCount?: number;
  isRateLimited: boolean;
  rateLimitResetAt?: number;
  availabilityScore: number;
  fetchedAt: number;
}

/**
 * Auth adapter interface — one implementation per provider.
 */
export interface IProviderAuthAdapter {
  readonly providerType: ProviderType;
  getNativeCredentialPaths(): string[];
  readNativeCredentials(): Promise<ProviderCredentials | null>;
  getAuthCommandLine(): string;
  getAuthSuccessPatterns(): RegExp[];
  getAuthFailurePatterns(): RegExp[];
  refreshToken(credentials: ProviderCredentials): Promise<ProviderCredentials>;
  validateToken(credentials: ProviderCredentials): Promise<boolean>;
  revokeToken(credentials: ProviderCredentials): Promise<void>;
  getEnvironmentForCLI(credentials: ProviderCredentials): Record<string, string>;
  fetchUsage?(credentials: ProviderCredentials): Promise<UsageSnapshot | null>;
}

/**
 * Keychain service name for a provider + profile combination.
 */
export function getUnifiedKeychainServiceName(
  providerType: ProviderType,
  profileIdHash: string
): string {
  return `Auto-Claude-${providerType}-credentials-${profileIdHash}`;
}
