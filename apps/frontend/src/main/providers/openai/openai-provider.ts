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
import { createOpenAIOAuthManager } from '../oauth/openai-oauth';

class OpenAIAuthHandler implements IAuthHandler {
  private oauthManager = createOpenAIOAuthManager();

  async authenticate(_configDir?: string): Promise<ProviderCredentials> {
    // Prioritize environment variable if present
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      return {
        providerType: PT.OPENAI,
        apiKey,
      };
    }

    // Fallback to OAuth flow
    const tokens = await this.oauthManager.startAuthFlow();
    return {
      providerType: PT.OPENAI,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      metadata: {
        scopes: tokens.scope?.split(' '),
      },
    };
  }

  async refreshCredentials(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    if (credentials.apiKey) {
      return credentials;
    }

    if (credentials.refreshToken) {
      try {
        const newTokens = await this.oauthManager.refreshTokens(credentials.refreshToken);
        return {
          ...credentials,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken || credentials.refreshToken,
          expiresAt: newTokens.expiresAt,
        };
      } catch (error) {
        console.error('Failed to refresh OpenAI tokens:', error);
        return credentials;
      }
    }

    return credentials;
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    if (credentials.apiKey) {
      return true;
    }

    if (credentials.accessToken && credentials.expiresAt) {
      // Check if token is expired (with 5 minute buffer)
      return Date.now() < (credentials.expiresAt - 5 * 60 * 1000);
    }

    return false;
  }

  async revokeCredentials(_credentials: ProviderCredentials): Promise<void> {
    // OpenAI doesn't have a standard revocation endpoint for OAuth tokens
    // created via this flow that we need to call from the client
  }
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
    supportsOAuth: true,
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

    // Try to retrieve stored credentials first
    this.credentials = await this.credentialManager.retrieve(profile.id);

    // If no credentials or expired/invalid, start auth flow
    if (!this.credentials || !(await this.authHandler.validateCredentials(this.credentials))) {
      this.credentials = await this.authHandler.authenticate();
      await this.credentialManager.store(profile.id, this.credentials);
    }
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
    } else if (this.credentials?.accessToken) {
      env.OPENAI_ACCESS_TOKEN = this.credentials.accessToken;
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
    return !!(this.credentials?.apiKey || this.credentials?.accessToken);
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
