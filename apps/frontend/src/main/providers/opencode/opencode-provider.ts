/**
 * Opencode CLI provider for frontend.
 */

import type {
  ICLIProvider,
  IAuthHandler,
  ICredentialManager,
  IRateLimitHandler,
} from '../provider-interface';
import type {
  ProviderType,
  ProviderProfile,
  ProviderCredentials,
  ProviderCapabilities,
  RateLimitInfo,
} from '../types';
import { ProviderType as PT } from '../types';

class OpencodeAuthHandler implements IAuthHandler {
  async authenticate(_configDir?: string): Promise<ProviderCredentials> {
    const apiKey = process.env.OPENCODE_API_KEY;
    return {
      providerType: PT.OPENCODE,
      apiKey,
    };
  }

  async refreshCredentials(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    return credentials;
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    return !!credentials.apiKey;
  }

  async revokeCredentials(_credentials: ProviderCredentials): Promise<void> {}
}

class OpencodeCredentialManager implements ICredentialManager {
  async store(
    _profileId: string,
    _credentials: ProviderCredentials
  ): Promise<void> {}

  async retrieve(_profileId: string): Promise<ProviderCredentials | null> {
    return null;
  }

  async delete(_profileId: string): Promise<void> {}

  async listProfiles(): Promise<string[]> {
    return [];
  }
}

class OpencodeRateLimitHandler implements IRateLimitHandler {
  private limits: RateLimitInfo = {
    requestsRemaining: 60,
    tokensRemaining: 1000000,
    resetAt: 0,
  };

  async acquire(_tokensEstimate?: number): Promise<void> {}

  updateLimits(rateLimitInfo: RateLimitInfo): void {
    this.limits = rateLimitInfo;
  }

  getCurrentLimits(): RateLimitInfo {
    return this.limits;
  }

  onRateLimitExceeded(_callback: (info: RateLimitInfo) => void): void {}
}

export class OpencodeCLIProvider implements ICLIProvider {
  readonly providerType: ProviderType = PT.OPENCODE;

  readonly capabilities: ProviderCapabilities = {
    supportsOAuth: false,
    supportsApiKey: true,
    supportsSessionResume: false,
    supportsProfileSwitch: true,
    supportedModels: ['deepseek-v3', 'deepseek-v2', 'deepseek-coder'],
  };

  private authHandler = new OpencodeAuthHandler();
  private credentialManager = new OpencodeCredentialManager();
  private rateLimitHandler = new OpencodeRateLimitHandler();
  private currentProfile: ProviderProfile | null = null;
  private credentials: ProviderCredentials | null = null;

  static create(): OpencodeCLIProvider {
    return new OpencodeCLIProvider();
  }

  async initialize(profile: ProviderProfile): Promise<void> {
    this.currentProfile = profile;
    this.credentials = await this.authHandler.authenticate();
  }

  async dispose(): Promise<void> {
    this.currentProfile = null;
    this.credentials = null;
  }

  getCliCommand(): string[] {
    if (!this.currentProfile) {
      throw new Error('Provider not initialized');
    }

    return ['opencode', '--model', this.currentProfile.model || 'deepseek-v3'];
  }

  getCliEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};
    if (this.credentials?.apiKey) {
      env.OPENCODE_API_KEY = this.credentials.apiKey;
    }
    return env;
  }

  async resumeSession(_sessionId: string): Promise<void> {}

  async switchProfile(profile: ProviderProfile): Promise<void> {
    await this.initialize(profile);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('which opencode || where opencode');
      return true;
    } catch {
      return false;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    return !!this.credentials?.apiKey;
  }

  getAuthHandler(): IAuthHandler {
    return this.authHandler;
  }

  getCredentialManager(): ICredentialManager {
    return this.credentialManager;
  }

  getRateLimitHandler(): IRateLimitHandler {
    return this.rateLimitHandler;
  }
}
