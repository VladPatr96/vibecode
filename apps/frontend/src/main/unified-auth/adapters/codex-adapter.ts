/**
 * Codex Auth Adapter
 */

import { ProviderType, type ProviderCredentials } from '../../providers/types';
import type { IProviderAuthAdapter, UsageSnapshot } from '../types';
import type { ProviderType as SharedProviderType } from '../../../shared/types/provider';

export class CodexAuthAdapter implements IProviderAuthAdapter {
  readonly providerType: SharedProviderType = 'codex';

  getNativeCredentialPaths(): string[] {
    return [];
  }

  async readNativeCredentials(): Promise<ProviderCredentials | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }
    return {
      providerType: ProviderType.CODEX,
      apiKey,
    };
  }

  getAuthCommandLine(): string {
    return 'codex login';
  }

  getAuthSuccessPatterns(): RegExp[] {
    return [/success/i, /authenticated/i, /logged in/i];
  }

  getAuthFailurePatterns(): RegExp[] {
    return [/failed/i, /invalid/i, /unauthorized/i, /error/i];
  }

  async refreshToken(credentials: ProviderCredentials): Promise<ProviderCredentials> {
    return { ...credentials, providerType: ProviderType.CODEX };
  }

  async validateToken(credentials: ProviderCredentials): Promise<boolean> {
    return !!credentials.apiKey || !!credentials.accessToken;
  }

  async revokeToken(_credentials: ProviderCredentials): Promise<void> {}

  getEnvironmentForCLI(credentials: ProviderCredentials): Record<string, string> {
    const env: Record<string, string> = {};
    const apiKey = credentials.apiKey || credentials.accessToken;
    if (apiKey) {
      env.OPENAI_API_KEY = apiKey;
    }
    return env;
  }

  async fetchUsage(_credentials: ProviderCredentials): Promise<UsageSnapshot | null> {
    return null;
  }
}
