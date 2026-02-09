/**
 * Unified Auth System
 * Multi-provider authentication management.
 */

// Types
export type {
  UnifiedProfile,
  UnifiedProfileStoreData,
  ProviderProfileData,
  AutoSwitchSettings,
  UsageSnapshot,
  IProviderAuthAdapter,
} from './types';
export {
  UNIFIED_STORE_VERSION,
  DEFAULT_AUTO_SWITCH_SETTINGS,
  getUnifiedKeychainServiceName,
} from './types';

// Store
export {
  loadUnifiedStore,
  saveUnifiedStore,
  migrateV3ToV4,
  createDefaultUnifiedStore,
} from './profile-store';

// Credential Store
export { UnifiedCredentialStore, getUnifiedCredentialStore } from './credential-store';

// Profile Manager
export { UnifiedProfileManager } from './unified-profile-manager';

// Adapters
export { ClaudeAuthAdapter } from './adapters';

// Backward compatibility
export { createClaudeProfileCompat } from './claude-profile-compat';
