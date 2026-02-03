/**
 * Claude Code CLI provider for frontend.
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

class ClaudeAuthHandler implements IAuthHandler {
  async authenticate(configDir?: string): Promise<ProviderCredentials> {
    // Get token from environment or keychain
    const token = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN;
    return {
      providerType: PT.CLAUDE,
      accessToken: token,
      configDir,
    };
  }

  async refreshCredentials(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    return this.authenticate(credentials.configDir);
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    return !!credentials.accessToken;
  }

  async revokeCredentials(_credentials: ProviderCredentials): Promise<void> {
    // TODO: Implement
  }
}

class ClaudeCredentialManager implements ICredentialManager {
  async store(
    _profileId: string,
    _credentials: ProviderCredentials
  ): Promise<void> {
    // Delegate to keychain utilities
  }

  async retrieve(_profileId: string): Promise<ProviderCredentials | null> {
    const token = process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_AUTH_TOKEN;
    if (!token) return null;
    return {
      providerType: PT.CLAUDE,
      accessToken: token,
    };
  }

  async delete(_profileId: string): Promise<void> {
    // TODO: Implement
  }

  async listProfiles(): Promise<string[]> {
    return [];
  }
}

class ClaudeRateLimitHandler implements IRateLimitHandler {
  private limits: RateLimitInfo = {
    requestsRemaining: 50,
    tokensRemaining: 100000,
    resetAt: 0,
  };
  private callbacks: ((info: RateLimitInfo) => void)[] = [];

  async acquire(_tokensEstimate?: number): Promise<void> {
    // Claude CLI handles rate limiting
  }

  updateLimits(rateLimitInfo: RateLimitInfo): void {
    this.limits = rateLimitInfo;
    if (rateLimitInfo.requestsRemaining === 0) {
      this.callbacks.forEach((cb) => cb(rateLimitInfo));
    }
  }

  getCurrentLimits(): RateLimitInfo {
    return this.limits;
  }

  onRateLimitExceeded(callback: (info: RateLimitInfo) => void): void {
    this.callbacks.push(callback);
  }
}

export class ClaudeCLIProvider implements ICLIProvider {
  readonly providerType: ProviderType = PT.CLAUDE;

  readonly capabilities: ProviderCapabilities = {
    supportsOAuth: true,
    supportsApiKey: true,
    supportsSessionResume: true,
    supportsProfileSwitch: true,
    supportedModels: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-haiku-20241022',
    ],
  };

  private authHandler = new ClaudeAuthHandler();
  private credentialManager = new ClaudeCredentialManager();
  private rateLimitHandler = new ClaudeRateLimitHandler();
  private currentProfile: ProviderProfile | null = null;
  private credentials: ProviderCredentials | null = null;

  static create(): ClaudeCLIProvider {
    return new ClaudeCLIProvider();
  }

  async initialize(profile: ProviderProfile): Promise<void> {
    this.currentProfile = profile;
    this.credentials = await this.credentialManager.retrieve(profile.id);

    if (!this.credentials) {
      this.credentials = await this.authHandler.authenticate(profile.configDir);
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

    const cmd = ['claude'];

    if (this.currentProfile.model) {
      cmd.push('--model', this.currentProfile.model);
    }

    if (this.currentProfile.maxTokens) {
      cmd.push('--max-tokens', String(this.currentProfile.maxTokens));
    }

    return cmd;
  }

  getCliEnvironment(): Record<string, string> {
    const env: Record<string, string> = {
      CLAUDE_CODE_ENTRYPOINT: 'auto-claude',
    };

    if (this.credentials?.configDir) {
      env.CLAUDE_CONFIG_DIR = this.credentials.configDir;
    }

    return env;
  }

  async resumeSession(_sessionId: string): Promise<void> {
    // Handled by terminal layer with --continue
  }

  async switchProfile(profile: ProviderProfile): Promise<void> {
    await this.initialize(profile);
  }

  async healthCheck(): Promise<boolean> {
    // Check if claude CLI is available
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('which claude || where claude');
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
