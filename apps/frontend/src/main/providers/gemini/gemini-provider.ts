/**
 * Gemini CLI provider for frontend.
 */

import type {
  ICLIProvider,
  IAuthHandler,
  ICredentialManager,
  IRateLimitHandler,
} from '../provider-interface';
import { createGoogleOAuthManager } from '../oauth/google-oauth';
import { OAuthManager } from '../oauth/oauth-manager';
import type {
  ProviderType,
  ProviderProfile,
  ProviderCredentials,
  ProviderCapabilities,
  RateLimitInfo,
} from '../types';
import { ProviderType as PT } from '../types';

class GeminiAuthHandler implements IAuthHandler {
  private oauthManager: OAuthManager;

  constructor() {
    this.oauthManager = createGoogleOAuthManager();
  }

  async authenticate(_configDir?: string): Promise<ProviderCredentials> {
    // Try environment variables first (legacy/dev support)
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      return {
        providerType: PT.GEMINI,
        apiKey,
      };
    }

    try {
      const tokens = await this.oauthManager.startAuthFlow();
      return {
        providerType: PT.GEMINI,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        metadata: {
          scope: tokens.scope,
          tokenType: tokens.tokenType,
        },
      };
    } catch (error) {
      console.error('Gemini OAuth failed:', error);
      throw error;
    }
  }

  async refreshCredentials(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    if (credentials.refreshToken) {
      try {
        const tokens = await this.oauthManager.refreshTokens(credentials.refreshToken);
        return {
          ...credentials,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || credentials.refreshToken,
          expiresAt: tokens.expiresAt,
        };
      } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, we return the old credentials
        // validation will fail if they are expired
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
      // Check if token is expired or about to expire (within 5 mins)
      return Date.now() < credentials.expiresAt - 300000;
    }

    return false;
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
    supportsOAuth: true,
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

    return ['gemini', '--model', this.currentProfile.model || 'gemini-2.0-flash'];
  }

  getCliEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};
    if (this.credentials?.apiKey) {
      env.GEMINI_API_KEY = this.credentials.apiKey;
    }
    if (this.credentials?.accessToken) {
      env.GOOGLE_ACCESS_TOKEN = this.credentials.accessToken;
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
    if (!this.credentials) return false;
    return this.authHandler.validateCredentials(this.credentials);
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
