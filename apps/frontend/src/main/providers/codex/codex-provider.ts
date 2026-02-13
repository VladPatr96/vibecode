/**
 * Codex CLI provider for frontend.
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

class CodexAuthHandler implements IAuthHandler {
  async authenticate(_configDir?: string): Promise<ProviderCredentials> {
    const apiKey = process.env.OPENAI_API_KEY;
    return {
      providerType: PT.CODEX,
      apiKey,
    };
  }

  async refreshCredentials(credentials: ProviderCredentials): Promise<ProviderCredentials> {
    return credentials;
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    return !!credentials.apiKey || !!credentials.accessToken;
  }

  async revokeCredentials(_credentials: ProviderCredentials): Promise<void> {}
}

class CodexCredentialManager implements ICredentialManager {
  async store(_profileId: string, _credentials: ProviderCredentials): Promise<void> {}
  async retrieve(_profileId: string): Promise<ProviderCredentials | null> {
    return null;
  }
  async delete(_profileId: string): Promise<void> {}
  async listProfiles(): Promise<string[]> {
    return [];
  }
}

class CodexRateLimitHandler implements IRateLimitHandler {
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

export class CodexCLIProvider implements ICLIProvider {
  readonly providerType: ProviderType = PT.CODEX;

  readonly capabilities: ProviderCapabilities = {
    supportsOAuth: true,
    supportsApiKey: true,
    supportsSessionResume: false,
    supportsProfileSwitch: true,
    supportedModels: ['gpt-4o', 'o3', 'o3-mini', 'gpt-4.1'],
  };

  private authHandler = new CodexAuthHandler();
  private credentialManager = new CodexCredentialManager();
  private rateLimitHandler = new CodexRateLimitHandler();
  private currentProfile: ProviderProfile | null = null;
  private credentials: ProviderCredentials | null = null;

  static create(): CodexCLIProvider {
    return new CodexCLIProvider();
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
    return !!this.credentials?.apiKey || !!this.credentials?.accessToken;
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
