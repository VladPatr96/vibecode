/**
 * Gemini CLI provider for frontend.
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

class GeminiAuthHandler implements IAuthHandler {
  async authenticate(_configDir?: string): Promise<ProviderCredentials> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    return {
      providerType: PT.GEMINI,
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

class GeminiCredentialManager implements ICredentialManager {
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

class GeminiRateLimitHandler implements IRateLimitHandler {
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

export class GeminiCLIProvider implements ICLIProvider {
  readonly providerType: ProviderType = PT.GEMINI;

  readonly capabilities: ProviderCapabilities = {
    supportsOAuth: false,
    supportsApiKey: true,
    supportsSessionResume: false,
    supportsProfileSwitch: true,
    supportedModels: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  };

  private authHandler = new GeminiAuthHandler();
  private credentialManager = new GeminiCredentialManager();
  private rateLimitHandler = new GeminiRateLimitHandler();
  private currentProfile: ProviderProfile | null = null;
  private credentials: ProviderCredentials | null = null;

  static create(): GeminiCLIProvider {
    return new GeminiCLIProvider();
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

    return ['gemini', '--model', this.currentProfile.model || 'gemini-2.0-flash'];
  }

  getCliEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};
    if (this.credentials?.apiKey) {
      env.GEMINI_API_KEY = this.credentials.apiKey;
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
      await execAsync('which gemini || where gemini');
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
