/**
 * Claude Auth Adapter
 *
 * Wraps existing credential-utils and token-refresh modules into the
 * IProviderAuthAdapter interface for the unified auth system.
 *
 * Claude uses OS-native secure storage (Keychain / Credential Manager / Secret Service)
 * rather than file-based credential paths, so getNativeCredentialPaths() returns [].
 */

import { ProviderType, type ProviderCredentials } from '../../providers/types';
import type { IProviderAuthAdapter, UsageSnapshot } from '../types';
import type { ProviderType as SharedProviderType } from '../../../shared/types/provider';

export class ClaudeAuthAdapter implements IProviderAuthAdapter {
  readonly providerType: SharedProviderType = 'claude';

  /**
   * Claude uses OS keychain / credential manager, not file-based credential paths.
   */
  getNativeCredentialPaths(): string[] {
    return [];
  }

  /**
   * Read credentials from the platform-specific secure storage.
   * Delegates to getFullCredentialsFromKeychain() from credential-utils.
   */
  async readNativeCredentials(): Promise<ProviderCredentials | null> {
    const { getFullCredentialsFromKeychain } = await import(
      '../../claude-profile/credential-utils'
    );

    const creds = await getFullCredentialsFromKeychain();

    if (!creds.token) {
      return null;
    }

    return {
      providerType: ProviderType.CLAUDE,
      accessToken: creds.token,
      refreshToken: creds.refreshToken ?? undefined,
      expiresAt: creds.expiresAt ?? undefined,
      metadata: {
        email: creds.email ?? undefined,
        subscriptionType: creds.subscriptionType ?? undefined,
        rateLimitTier: creds.rateLimitTier ?? undefined,
        scopes: creds.scopes ?? undefined,
      },
    };
  }

  /**
   * The CLI command to initiate Claude OAuth login.
   */
  getAuthCommandLine(): string {
    return 'claude login';
  }

  /**
   * Regex patterns that indicate successful authentication in terminal output.
   */
  getAuthSuccessPatterns(): RegExp[] {
    return [
      /Successfully authenticated/i,
      /Logged in as/i,
      /Authentication successful/i,
      /You are now logged in/i,
    ];
  }

  /**
   * Regex patterns that indicate authentication failure in terminal output.
   */
  getAuthFailurePatterns(): RegExp[] {
    return [
      /Authentication failed/i,
      /Invalid token/i,
      /Login failed/i,
      /Access denied/i,
      /Unauthorized/i,
      /invalid_grant/i,
    ];
  }

  /**
   * Refresh the OAuth token using the existing reactiveTokenRefresh mechanism.
   * Uses dynamic import to avoid circular dependency issues.
   */
  async refreshToken(credentials: ProviderCredentials): Promise<ProviderCredentials> {
    const { reactiveTokenRefresh } = await import('../../claude-profile/token-refresh');

    const result = await reactiveTokenRefresh(credentials.configDir);

    if (result.token) {
      return {
        ...credentials,
        providerType: ProviderType.CLAUDE,
        accessToken: result.token,
      };
    }

    // Refresh failed or was not needed; return credentials unchanged
    return {
      ...credentials,
      providerType: ProviderType.CLAUDE,
    };
  }

  /**
   * Validate whether the credential has a non-empty accessToken.
   * A more thorough check (e.g., hitting the Anthropic API) can be added later.
   */
  async validateToken(credentials: ProviderCredentials): Promise<boolean> {
    return !!credentials.accessToken;
  }

  /**
   * Revoke token -- no-op for Claude. The Claude CLI handles its own revocation
   * and tokens are automatically invalidated on refresh.
   */
  async revokeToken(_credentials: ProviderCredentials): Promise<void> {
    // No-op: Claude CLI handles token revocation
  }

  /**
   * Build the environment variables required to launch Claude CLI with the
   * correct profile and authentication context.
   */
  getEnvironmentForCLI(credentials: ProviderCredentials): Record<string, string> {
    const env: Record<string, string> = {
      CLAUDE_CODE_ENTRYPOINT: 'auto-claude',
    };

    if (credentials.configDir) {
      env.CLAUDE_CONFIG_DIR = credentials.configDir;
    }

    if (credentials.accessToken) {
      env.CLAUDE_CODE_OAUTH_TOKEN = credentials.accessToken;
    }

    return env;
  }

  /**
   * Fetch usage snapshot for this provider.
   * Will be wired to the usage-monitor in Phase 4.
   */
  async fetchUsage(_credentials: ProviderCredentials): Promise<UsageSnapshot | null> {
    return null;
  }
}
