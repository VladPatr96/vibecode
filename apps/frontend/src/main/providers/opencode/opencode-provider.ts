/**
 * Opencode CLI provider for frontend.
 * Opencode (https://opencode.ai) is an open-source AI coding agent
 * supporting 75+ LLM providers via Models.dev.
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

/**
 * Models supported by Opencode CLI.
 * Opencode supports 75+ providers via Models.dev, these are the most common.
 */
export const OPENCODE_MODELS = [
  'claude-sonnet-4',
  'claude-opus-4',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'o1',
  'o3-mini',
] as const;

export type OpencodeModel = (typeof OPENCODE_MODELS)[number];

class OpencodeAuthHandler implements IAuthHandler {
  async authenticate(configDir?: string): Promise<ProviderCredentials> {
    // Opencode supports GitHub (Copilot) or OpenAI (ChatGPT Plus/Pro) authentication
    const apiKey = process.env.OPENCODE_API_KEY || process.env.OPENAI_API_KEY;
    return {
      providerType: PT.OPENCODE,
      apiKey,
      configDir,
    };
  }

  async refreshCredentials(
    credentials: ProviderCredentials
  ): Promise<ProviderCredentials> {
    return this.authenticate(credentials.configDir);
  }

  async validateCredentials(credentials: ProviderCredentials): Promise<boolean> {
    // Opencode can work with API key or OAuth via GitHub/OpenAI
    return !!credentials.apiKey || !!credentials.accessToken;
  }

  async revokeCredentials(_credentials: ProviderCredentials): Promise<void> {
    // TODO: Implement credential revocation
  }
}

class OpencodeCredentialManager implements ICredentialManager {
  async store(
    _profileId: string,
    _credentials: ProviderCredentials
  ): Promise<void> {
    // Delegate to keychain utilities
  }

  async retrieve(_profileId: string): Promise<ProviderCredentials | null> {
    const apiKey = process.env.OPENCODE_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return {
      providerType: PT.OPENCODE,
      apiKey,
    };
  }

  async delete(_profileId: string): Promise<void> {
    // TODO: Implement credential deletion
  }

  async listProfiles(): Promise<string[]> {
    return [];
  }
}

class OpencodeRateLimitHandler implements IRateLimitHandler {
  private limits: RateLimitInfo = {
    requestsRemaining: 50,
    tokensRemaining: 100000,
    resetAt: 0,
  };
  private callbacks: ((info: RateLimitInfo) => void)[] = [];

  async acquire(_tokensEstimate?: number): Promise<void> {
    // Opencode CLI handles rate limiting internally
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

export class OpencodeCLIProvider implements ICLIProvider {
  readonly providerType: ProviderType = PT.OPENCODE;

  readonly capabilities: ProviderCapabilities = {
    supportsOAuth: true,
    supportsApiKey: true,
    supportsSessionResume: false,
    supportsProfileSwitch: true,
    supportedModels: [...OPENCODE_MODELS],
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
    const cmd = ['opencode'];

    if (this.currentProfile?.model) {
      cmd.push('--model', this.currentProfile.model);
    }

    return cmd;
  }

  getCliEnvironment(): Record<string, string> {
    const env: Record<string, string> = {};

    if (this.currentProfile?.model) {
      env.OPENCODE_MODEL = this.currentProfile.model;
    }

    if (this.credentials?.apiKey) {
      env.OPENCODE_API_KEY = this.credentials.apiKey;
    }

    if (this.credentials?.configDir) {
      env.OPENCODE_CONFIG_DIR = this.credentials.configDir;
    }

    return env;
  }

  async resumeSession(_sessionId: string): Promise<void> {
    throw new Error('Session resume is not supported by Opencode provider');
  }

  async switchProfile(profile: ProviderProfile): Promise<void> {
    await this.initialize(profile);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync('opencode --version');
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
