/**
 * IPC handlers for multi-CLI provider operations.
 * Enables the renderer to query available providers, run health checks,
 * and invoke non-Claude CLI tools in terminals.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { providerRegistry } from '../providers/provider-registry';
import { ProviderType } from '../providers/types';
import type { TerminalManager } from '../terminal-manager';
import { debugLog, debugError } from '../../shared/utils/debug-logger';

/**
 * Register provider-related IPC handlers.
 */
export function registerProviderHandlers(
  terminalManager: TerminalManager,
  getMainWindow: () => BrowserWindow | null
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
        const factory = providerRegistry.getAvailableProviders()
          .find((p) => p === providerType);

        if (!factory) {
          return { success: false, error: `Unknown provider: ${providerType}` };
        }

        // Create a temporary provider instance for health check
        const tempProvider = await providerRegistry.createForTerminal(
          `__healthcheck_${Date.now()}`,
          providerType as ProviderType,
          {
            id: '__healthcheck',
            name: 'Health Check',
            providerType: providerType as ProviderType,
            model: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        );

        const healthy = await tempProvider.healthCheck();
        await providerRegistry.disposeTerminal(`__healthcheck_${Date.now()}`);

        return { success: true, healthy };
      } catch (error) {
        debugError('[ProviderHandlers] Health check failed:', error);
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

        if (providerType === 'claude') {
          // Delegate to existing Claude invocation
          await terminalManager.invokeClaudeAsync(terminalId, options?.cwd);
          return { success: true };
        }

        // For non-Claude providers, get CLI command from provider and write to terminal
        const provider = providerRegistry.getAvailableProviders()
          .find((p) => p === providerType);

        if (!provider) {
          return { success: false, error: `Unknown provider: ${providerType}` };
        }

        // Create provider instance to get CLI command
        const cliProvider = await providerRegistry.createForTerminal(
          terminalId,
          providerType as ProviderType,
          {
            id: `${providerType}-default`,
            name: `${providerType} Default`,
            providerType: providerType as ProviderType,
            model: providerType === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        );

        const cliCommand = cliProvider.getCliCommand();
        const cliEnv = cliProvider.getCliEnvironment();

        // Build environment prefix
        const envPrefix = Object.entries(cliEnv)
          .map(([key, value]) => `${key}=${value}`)
          .join(' ');

        const fullCommand = envPrefix
          ? `${envPrefix} ${cliCommand.join(' ')}`
          : cliCommand.join(' ');

        // Write to terminal
        terminalManager.write(terminalId, `${fullCommand}\r`);

        // Notify renderer about provider type change
        const win = getMainWindow();
        if (win) {
          win.webContents.send('terminal:providerChanged', terminalId, providerType);
        }

        return { success: true };
      } catch (error) {
        debugError('[ProviderHandlers] Invoke provider failed:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  debugLog('[ProviderHandlers] Provider IPC handlers registered');
}
