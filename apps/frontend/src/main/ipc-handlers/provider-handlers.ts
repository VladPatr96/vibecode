/**
 * IPC handlers for multi-CLI provider operations.
 * Enables the renderer to query available providers, run health checks,
 * and invoke non-Claude CLI tools in terminals.
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import '../providers';
import { providerRegistry } from '../providers/provider-registry';
import { ProviderType } from '../providers/types';
import type { TerminalManager } from '../terminal-manager';
import { getClaudeProfileManager } from '../claude-profile-manager';
import { GeminiAuthAdapter } from '../unified-auth/adapters/gemini-adapter';
import { CodexAuthAdapter } from '../unified-auth/adapters/codex-adapter';
import { OpencodeAuthAdapter } from '../unified-auth/adapters/opencode-adapter';
import { debugLog, debugError } from '../../shared/utils/debug-logger';

interface ProviderStatusResult {
  provider: ProviderType;
  installed: boolean;
  authenticated: boolean;
  accountLabel?: string;
  authMethod?: 'oauth' | 'apiKey' | 'token' | 'unknown';
  rateLimitStatus: 'ok' | 'limited' | 'unknown';
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '***';
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

async function runProviderHealthCheck(providerType: ProviderType): Promise<boolean> {
  const healthTerminalId = `__healthcheck_${providerType}_${Date.now()}`;
  try {
    const tempProvider = await providerRegistry.createForTerminal(
      healthTerminalId,
      providerType,
      {
        id: '__healthcheck',
        name: 'Health Check',
        providerType,
        model: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    );

    return await tempProvider.healthCheck();
  } finally {
    await providerRegistry.disposeTerminal(healthTerminalId).catch(() => undefined);
  }
}

async function resolveProviderAuth(providerType: ProviderType): Promise<{
  authenticated: boolean;
  accountLabel?: string;
  authMethod?: 'oauth' | 'apiKey' | 'token' | 'unknown';
}> {
  if (providerType === ProviderType.CLAUDE) {
    try {
      const profileManager = getClaudeProfileManager();
      const settings = profileManager.getSettings();
      const activeProfile =
        settings.profiles.find((profile) => profile.id === settings.activeProfileId) ??
        settings.profiles[0];
      return {
        authenticated: Boolean(activeProfile?.isAuthenticated),
        accountLabel: activeProfile?.email || activeProfile?.name,
        authMethod: 'oauth',
      };
    } catch {
      return { authenticated: false };
    }
  }

  const adapter =
    providerType === ProviderType.GEMINI
      ? new GeminiAuthAdapter()
      : providerType === ProviderType.OPENAI || providerType === ProviderType.CODEX
        ? new CodexAuthAdapter()
        : providerType === ProviderType.OPENCODE
          ? new OpencodeAuthAdapter()
          : null;

  if (!adapter) {
    return { authenticated: false };
  }

  const credentials = await adapter.readNativeCredentials();
  if (!credentials) {
    return { authenticated: false };
  }

  const authenticated = await adapter.validateToken(credentials);
  const metadataEmail =
    credentials.metadata && typeof credentials.metadata.email === 'string'
      ? credentials.metadata.email
      : undefined;
  const accountLabel =
    metadataEmail ||
    (credentials.apiKey
      ? `API key ${maskSecret(credentials.apiKey)}`
      : credentials.accessToken
        ? `Token ${maskSecret(credentials.accessToken)}`
        : undefined);
  const authMethod = credentials.apiKey
    ? 'apiKey'
    : credentials.accessToken
      ? 'token'
      : 'unknown';

  return {
    authenticated,
    accountLabel,
    authMethod,
  };
}

/**
 * Register provider-related IPC handlers.
 */
export function registerProviderHandlers(
  terminalManager: TerminalManager
): void {
  // List available providers
  ipcMain.handle(IPC_CHANNELS.PROVIDER_LIST, async () => {
    try {
      const providers = providerRegistry.getAvailableProviders();
      return {
        success: true,
        providers: providers.map((p) => ({
          type: p,
          displayName: p === ProviderType.CLAUDE ? 'Claude Code'
            : p === ProviderType.GEMINI ? 'Gemini CLI'
            : p === ProviderType.OPENAI ? 'OpenAI Codex'
            : p === ProviderType.CODEX ? 'Codex CLI'
            : p === ProviderType.OPENCODE ? 'OpenCode CLI'
            : p,
        })),
      };
    } catch (error) {
      debugError('[ProviderHandlers] Failed to list providers:', error);
      return { success: false, error: String(error) };
    }
  });

  // Health check for a specific provider
  ipcMain.handle(
    IPC_CHANNELS.PROVIDER_HEALTH_CHECK,
    async (_event, providerType: string) => {
      try {
        debugLog('[ProviderHandlers] Health check for:', providerType);
        const provider = providerRegistry.getAvailableProviders().find((p) => p === providerType);

        if (!provider) {
          return { success: false, error: `Unknown provider: ${providerType}` };
        }

        const healthy = await runProviderHealthCheck(provider as ProviderType);

        return { success: true, healthy };
      } catch (error) {
        debugError('[ProviderHandlers] Health check failed:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Full provider status (installation + authentication/account)
  ipcMain.handle(
    IPC_CHANNELS.PROVIDER_GET_STATUS,
    async (_event, providerType: string) => {
      try {
        debugLog('[ProviderHandlers] Get provider status for:', providerType);
        const provider = providerRegistry.getAvailableProviders().find((p) => p === providerType);
        if (!provider) {
          return { success: false, error: `Unknown provider: ${providerType}` };
        }

        const installed = await runProviderHealthCheck(provider as ProviderType);
        const auth = installed
          ? await resolveProviderAuth(provider as ProviderType)
          : { authenticated: false as const };

        const status: ProviderStatusResult = {
          provider: provider as ProviderType,
          installed,
          authenticated: Boolean(auth.authenticated),
          accountLabel: auth.accountLabel,
          authMethod: auth.authMethod,
          rateLimitStatus: 'unknown',
        };

        return { success: true, status };
      } catch (error) {
        debugError('[ProviderHandlers] Get provider status failed:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Invoke a provider CLI in a terminal
  ipcMain.handle(
    IPC_CHANNELS.TERMINAL_INVOKE_PROVIDER,
    async (_event, terminalId: string, providerType: string, options?: { cwd?: string }) => {
      try {
        debugLog('[ProviderHandlers] Invoking provider:', providerType, 'in terminal:', terminalId);

        if (!providerRegistry.getAvailableProviders().includes(providerType as ProviderType)) {
          return { success: false, error: `Unknown provider: ${providerType}` };
        }

        await terminalManager.invokeProvider(
          terminalId,
          providerType as 'claude' | 'gemini' | 'openai' | 'codex' | 'opencode',
          options?.cwd
        );

        return { success: true };
      } catch (error) {
        debugError('[ProviderHandlers] Invoke provider failed:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  debugLog('[ProviderHandlers] Provider IPC handlers registered');
}
