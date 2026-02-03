/**
 * Base provider interface for CLI providers.
 */

import type {
  ProviderType,
  ProviderProfile,
  ProviderCredentials,
  ProviderCapabilities,
  RateLimitInfo,
} from './types';

export interface IAuthHandler {
  authenticate(configDir?: string): Promise<ProviderCredentials>;
  refreshCredentials(credentials: ProviderCredentials): Promise<ProviderCredentials>;
  validateCredentials(credentials: ProviderCredentials): Promise<boolean>;
  revokeCredentials(credentials: ProviderCredentials): Promise<void>;
}

export interface ICredentialManager {
  store(profileId: string, credentials: ProviderCredentials): Promise<void>;
  retrieve(profileId: string): Promise<ProviderCredentials | null>;
  delete(profileId: string): Promise<void>;
  listProfiles(): Promise<string[]>;
}

export interface IRateLimitHandler {
  acquire(tokensEstimate?: number): Promise<void>;
  updateLimits(rateLimitInfo: RateLimitInfo): void;
  getCurrentLimits(): RateLimitInfo;
  onRateLimitExceeded(callback: (info: RateLimitInfo) => void): void;
}

export interface ICLIProvider {
  readonly providerType: ProviderType;
  readonly capabilities: ProviderCapabilities;

  // Lifecycle
  initialize(profile: ProviderProfile): Promise<void>;
  dispose(): Promise<void>;

  // CLI Operations
  getCliCommand(): string[];
  getCliEnvironment(): Record<string, string>;

  // Session management
  resumeSession(sessionId: string): Promise<void>;
  switchProfile(profile: ProviderProfile): Promise<void>;

  // Status
  healthCheck(): Promise<boolean>;
  isAuthenticated(): Promise<boolean>;

  // Handlers
  getAuthHandler(): IAuthHandler;
  getCredentialManager(): ICredentialManager;
  getRateLimitHandler(): IRateLimitHandler;
}
