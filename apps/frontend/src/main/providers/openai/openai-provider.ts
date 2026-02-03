/**
 * OpenAI Codex CLI provider for frontend.
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

class OpenAIAuthHandler implements IAuthHandler {
  async authenticate(_configDir?: string): Promise<ProviderCredentials> {
    const apiKey = process.env.OPENAI_API_KEY;
    return {
      providerType: PT.OPENAI,
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

class OpenAICredentialManager implements ICredentialManager {
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

class OpenAIRateLimitHandler implements IRateLimitHandler {
  private limits: RateLimitInfo = {
    requestsRemaining: 60,
    tokensRemaining: 150000,
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

export class OpenAICLIProvider implements ICLIProvider {
  readonly providerType: ProviderType = PT.OPENAI;

  readonly capabilities: ProviderCapabilities = {
    supportsOAuth: false,
    supportsApiKey: true,
    supportsSessionResume: false,
    supportsProfileSwitch: true,
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini'],
  };

  private authHandler = new OpenAIAuthHandler();
  private credentialManager = new OpenAICredentialManager();
  private rateLimitHandler = new OpenAIRateLimitHandler();
  private currentProfile: ProviderProfile | null = null;
  private credentials: ProviderCredentials | null = null;

  static create(): OpenAICLIProvider {
    return new OpenAICLIProvider();
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

    return ['codex', '--model', this.currentProfile.model || 'gpt-4o'];
  }

  getCliEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};
    if (this.credentials?.apiKey) {
      env.OPENAI_API_KEY = this.credentials.apiKey;
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
      await execAsync('which codex || where codex');
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
